<?php

declare(strict_types=1);

namespace Tests\Auth;

use App\Auth\InvalidTokenException;
use App\Auth\JwtService;
use PHPUnit\Framework\TestCase;

final class JwtServiceTest extends TestCase
{
    private const SECRET = 'test_super_secret_jwt_key_32_chars_min';

    public function testIssuesAndVerifiesValidJwtToken(): void
    {
        $jwt = new JwtService(self::SECRET, 3600);
        $now = 1_700_000_000;

        $token = $jwt->issue('user-uuid-123', 'ADMIN', true, $now);
        $user = $jwt->verify($token, $now + 100);

        self::assertSame('user-uuid-123', $user->userId);
        self::assertSame('ADMIN', $user->role);
        self::assertTrue($user->isVip);
    }

    public function testRejectsTamperedExpiredAndMalformedTokens(): void
    {
        $jwt = new JwtService(self::SECRET, 60);
        $now = 1_700_000_000;
        $token = $jwt->issue('user-1', 'USER', false, $now);

        $parts = explode('.', $token);
        $tampered = $parts[0] . '.' . $parts[1] . '.tampered_sig';

        $this->expectException(InvalidTokenException::class);
        $jwt->verify($tampered, $now + 10);
    }

    public function testRejectsExpiredToken(): void
    {
        $jwt = new JwtService(self::SECRET, 60);
        $now = 1_700_000_000;
        $token = $jwt->issue('user-1', 'USER', false, $now);

        $this->expectException(InvalidTokenException::class);
        $jwt->verify($token, $now + 61);
    }

    public function testRejectsTokenSignedWithDifferentSecret(): void
    {
        $issuer = new JwtService(self::SECRET, 60);
        $verifier = new JwtService('another_completely_different_secret_key', 60);
        $now = 1_700_000_000;

        $token = $issuer->issue('user-1', 'USER', false, $now);

        $this->expectException(InvalidTokenException::class);
        $verifier->verify($token, $now + 5);
    }
}
