<?php

declare(strict_types=1);

namespace App\Auth;

use JsonException;

/**
 * Stateless HS256 JWT issuer and verifier with zero external dependencies.
 */
final class JwtService
{
    private const MIN_SECRET_LENGTH = 16;

    public function __construct(
        private readonly string $secret,
        private readonly int $ttlSeconds = 604800,
        private readonly string $issuer = 'gta6map-api',
    ) {
    }

    public function getTtlSeconds(): int
    {
        return $this->ttlSeconds;
    }

    public function issue(string $userId, string $role, bool $isVip, ?int $now = null): string
    {
        $this->assertValidSecret();
        $issuedAt = $now ?? time();

        $header = $this->base64UrlEncode(json_encode([
            'alg' => 'HS256',
            'typ' => 'JWT',
        ], JSON_THROW_ON_ERROR));

        $payload = $this->base64UrlEncode(json_encode([
            'sub' => $userId,
            'role' => $role,
            'is_vip' => $isVip,
            'iss' => $this->issuer,
            'iat' => $issuedAt,
            'exp' => $issuedAt + $this->ttlSeconds,
        ], JSON_THROW_ON_ERROR));

        $signingInput = $header . '.' . $payload;
        $signature = $this->base64UrlEncode(hash_hmac('sha256', $signingInput, $this->secret, true));

        return $signingInput . '.' . $signature;
    }

    public function verify(string $token, ?int $now = null): AuthenticatedUser
    {
        $this->assertValidSecret();

        $parts = explode('.', trim($token));
        if (count($parts) !== 3) {
            throw new InvalidTokenException('Malformed JWT token.');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

        $header = $this->decodeSegment($encodedHeader);
        if (($header['alg'] ?? null) !== 'HS256' || ($header['typ'] ?? null) !== 'JWT') {
            throw new InvalidTokenException('Unsupported JWT header.');
        }

        $expectedSignature = $this->base64UrlEncode(
            hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $this->secret, true)
        );

        if (!hash_equals($expectedSignature, $encodedSignature)) {
            throw new InvalidTokenException('Invalid JWT signature.');
        }

        $payload = $this->decodeSegment($encodedPayload);
        $currentTime = $now ?? time();

        $exp = $payload['exp'] ?? null;
        if (!is_int($exp) && !is_float($exp)) {
            throw new InvalidTokenException('JWT missing expiration.');
        }
        if ((int) $exp <= $currentTime) {
            throw new InvalidTokenException('JWT token has expired.');
        }

        if (($payload['iss'] ?? null) !== $this->issuer) {
            throw new InvalidTokenException('JWT issuer mismatch.');
        }

        $sub = $payload['sub'] ?? null;
        $role = $payload['role'] ?? null;
        $isVip = $payload['is_vip'] ?? null;

        if (!is_string($sub) || trim($sub) === '' || !is_string($role) || !is_bool($isVip)) {
            throw new InvalidTokenException('JWT payload missing required claims.');
        }

        return new AuthenticatedUser(
            userId: $sub,
            role: $role,
            isVip: $isVip,
        );
    }

    private function assertValidSecret(): void
    {
        if (strlen($this->secret) < self::MIN_SECRET_LENGTH) {
            throw new InvalidTokenException('JWT_SECRET must be at least 16 characters.');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeSegment(string $segment): array
    {
        $raw = $this->base64UrlDecode($segment);
        if ($raw === null) {
            throw new InvalidTokenException('Invalid base64url JWT segment.');
        }

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new InvalidTokenException('Invalid JSON inside JWT segment.');
        }

        if (!is_array($decoded)) {
            throw new InvalidTokenException('Invalid JWT segment structure.');
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): ?string
    {
        $remainder = strlen($data) % 4;
        if ($remainder > 0) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        $decoded = base64_decode(strtr($data, '-_', '+/'), true);

        return $decoded !== false ? $decoded : null;
    }
}
