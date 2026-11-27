<?php

declare(strict_types=1);

namespace Tests\Auth;

use App\Auth\GoogleTokenVerifier;
use App\Auth\InvalidTokenException;
use PHPUnit\Framework\TestCase;

final class GoogleTokenVerifierTest extends TestCase
{
    private const CLIENT_ID = '123456-leonida.apps.googleusercontent.com';

    public function testVerifiesValidGoogleTokenClaims(): void
    {
        $verifier = new GoogleTokenVerifier(
            self::CLIENT_ID,
            static fn (string $url): string => json_encode([
                'aud' => self::CLIENT_ID,
                'iss' => 'https://accounts.google.com',
                'exp' => (string) (time() + 3600),
                'email_verified' => 'true',
                'sub' => 'google-sub-999',
                'email' => 'jason@leonida.com.br',
                'name' => 'Jason Duval',
                'picture' => 'https://example.com/avatar.jpg',
            ], JSON_THROW_ON_ERROR)
        );

        $payload = $verifier->verify('header.payload.signature');

        self::assertSame('google-sub-999', $payload->googleId);
        self::assertSame('jason@leonida.com.br', $payload->email);
        self::assertSame('Jason Duval', $payload->name);
        self::assertSame('https://example.com/avatar.jpg', $payload->avatarUrl);
    }

    public function testRejectsAudienceMismatch(): void
    {
        $verifier = new GoogleTokenVerifier(
            self::CLIENT_ID,
            static fn (string $url): string => json_encode([
                'aud' => 'wrong-client-id',
                'iss' => 'https://accounts.google.com',
                'exp' => (string) (time() + 3600),
                'email_verified' => 'true',
                'sub' => 'google-sub-999',
                'email' => 'jason@leonida.com.br',
            ], JSON_THROW_ON_ERROR)
        );

        $this->expectException(InvalidTokenException::class);
        $verifier->verify('header.payload.signature');
    }

    public function testRejectsUnverifiedEmailAndExpiredToken(): void
    {
        $verifier = new GoogleTokenVerifier(
            self::CLIENT_ID,
            static fn (string $url): string => json_encode([
                'aud' => self::CLIENT_ID,
                'iss' => 'accounts.google.com',
                'exp' => (string) (time() - 10),
                'email_verified' => 'true',
                'sub' => 'google-sub-999',
                'email' => 'jason@leonida.com.br',
            ], JSON_THROW_ON_ERROR)
        );

        $this->expectException(InvalidTokenException::class);
        $verifier->verify('header.payload.signature');
    }

    public function testRejectsMalformedTokenWithoutCallingNetwork(): void
    {
        $called = false;
        $verifier = new GoogleTokenVerifier(
            self::CLIENT_ID,
            static function () use (&$called): string {
                $called = true;
                return '{}';
            }
        );

        try {
            $verifier->verify('not-a-jwt');
            self::fail('Expected InvalidTokenException');
        } catch (InvalidTokenException) {
            self::assertFalse($called);
        }
    }
}
