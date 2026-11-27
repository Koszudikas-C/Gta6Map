<?php

declare(strict_types=1);

namespace App\Auth;

use Closure;
use JsonException;

/**
 * Verifies Google OAuth 2.0 ID tokens via Google tokeninfo endpoint with strict claim checks.
 */
final class GoogleTokenVerifier implements GoogleTokenVerifierInterface
{
    private const TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo?id_token=';

    /** @var list<string> */
    private const ALLOWED_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

    /** @var Closure(string): (string|false) */
    private readonly Closure $httpFetcher;

    /**
     * @param (Closure(string): (string|false))|null $httpFetcher
     */
    public function __construct(
        private readonly string $expectedClientId,
        ?Closure $httpFetcher = null,
    ) {
        $this->httpFetcher = $httpFetcher ?? self::defaultFetcher();
    }

    public function verify(string $idToken): GoogleTokenPayload
    {
        $trimmed = trim($idToken);
        if ($trimmed === '' || substr_count($trimmed, '.') !== 2) {
            throw new InvalidTokenException('Malformed Google ID token.');
        }

        if ($this->expectedClientId === '') {
            throw new InvalidTokenException('Google Client ID is not configured.');
        }

        $url = self::TOKENINFO_ENDPOINT . rawurlencode($trimmed);
        $rawResponse = ($this->httpFetcher)($url);
        if ($rawResponse === false || trim($rawResponse) === '') {
            throw new InvalidTokenException('Unable to validate Google ID token.');
        }

        $claims = $this->decodeClaims($rawResponse);
        $this->assertValidClaims($claims);

        $googleId = (string) $claims['sub'];
        $email = (string) $claims['email'];
        $fallbackName = strstr($email, '@', true);
        $name = isset($claims['name']) && is_string($claims['name']) && trim($claims['name']) !== ''
            ? trim($claims['name'])
            : ($fallbackName !== false && $fallbackName !== '' ? $fallbackName : 'Leonida Player');
        $avatarUrl = isset($claims['picture']) && is_string($claims['picture']) && trim($claims['picture']) !== ''
            ? trim($claims['picture'])
            : null;

        return new GoogleTokenPayload(
            googleId: $googleId,
            email: $email,
            name: $name,
            avatarUrl: $avatarUrl,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeClaims(string $rawResponse): array
    {
        try {
            $decoded = json_decode($rawResponse, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new InvalidTokenException('Invalid response from Google tokeninfo.');
        }

        if (!is_array($decoded)) {
            throw new InvalidTokenException('Invalid claims structure from Google.');
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }

    /**
     * @param array<string, mixed> $claims
     */
    private function assertValidClaims(array $claims): void
    {
        if (isset($claims['error']) || isset($claims['error_description'])) {
            throw new InvalidTokenException('Google rejected the ID token.');
        }

        $aud = $claims['aud'] ?? null;
        if (!is_string($aud) || !hash_equals($this->expectedClientId, $aud)) {
            throw new InvalidTokenException('Google ID token audience mismatch.');
        }

        $iss = $claims['iss'] ?? null;
        if (!is_string($iss) || !in_array($iss, self::ALLOWED_ISSUERS, true)) {
            throw new InvalidTokenException('Google ID token issuer mismatch.');
        }

        $exp = $claims['exp'] ?? null;
        if (!is_numeric($exp) || (int) $exp <= time()) {
            throw new InvalidTokenException('Google ID token has expired.');
        }

        $emailVerified = $claims['email_verified'] ?? false;
        if ($emailVerified !== true && $emailVerified !== 'true' && $emailVerified !== 1 && $emailVerified !== '1') {
            throw new InvalidTokenException('Google account email is not verified.');
        }

        $sub = $claims['sub'] ?? null;
        $email = $claims['email'] ?? null;
        if (!is_string($sub) || trim($sub) === '' || !is_string($email) || trim($email) === '') {
            throw new InvalidTokenException('Google ID token missing required subject or email.');
        }
    }

    /**
     * @return Closure(string): (string|false)
     */
    private static function defaultFetcher(): Closure
    {
        return static function (string $url): string|false {
            if (function_exists('curl_init')) {
                $ch = curl_init($url);
                if ($ch === false) {
                    return false;
                }
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 5,
                    CURLOPT_CONNECTTIMEOUT => 3,
                    CURLOPT_SSL_VERIFYPEER => true,
                    CURLOPT_SSL_VERIFYHOST => 2,
                ]);
                $result = curl_exec($ch);
                $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
                if (!is_string($result) || $httpCode !== 200) {
                    return false;
                }

                return $result;
            }

            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 5,
                    'ignore_errors' => false,
                ],
            ]);

            return @file_get_contents($url, false, $context);
        };
    }
}
