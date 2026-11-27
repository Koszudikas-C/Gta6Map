<?php

declare(strict_types=1);

namespace Tests\Http;

use App\Http\JsonResponse;
use App\Http\RateLimiter;
use App\Http\Request;
use App\Logging\LoggerFactory;
use PHPUnit\Framework\TestCase;

final class RateLimiterTest extends TestCase
{
    public function testAllowsWithinWindowBlocks429WithRetryAfterAndResetsAfterExpiry(): void
    {
        $baseDir = sys_get_temp_dir() . '/gta6map_rl_' . uniqid('', true);
        $rateDir = $baseDir . '/ratelimit';
        $logDir = $baseDir . '/logs';
        $now = 1_700_000_000;

        $loggerFactory = new LoggerFactory($logDir, 'req-rl-1', false, 30);
        $securityLogger = $loggerFactory->channel(LoggerFactory::CHANNEL_SECURITY);

        $limiter = new RateLimiter(
            $rateDir,
            $securityLogger,
            static function () use (&$now): int {
                return $now;
            }
        );

        $handler = static fn (Request $req): JsonResponse => new JsonResponse(200, ['ok' => true]);
        $request = new Request('POST', '/api/auth/google', requestId: 'req-rl-1', clientIp: '203.0.113.10');

        try {
            $first = $limiter->limit($request, 'auth_google', 2, 60, $handler);
            self::assertSame(200, $first->getStatusCode());
            self::assertSame('1', $first->getHeaders()['X-RateLimit-Remaining'] ?? '');

            $now += 10;
            $second = $limiter->limit($request, 'auth_google', 2, 60, $handler);
            self::assertSame(200, $second->getStatusCode());
            self::assertSame('0', $second->getHeaders()['X-RateLimit-Remaining'] ?? '');

            $now += 5;
            $blocked = $limiter->limit($request, 'auth_google', 2, 60, $handler);
            self::assertSame(429, $blocked->getStatusCode());
            self::assertSame('45', $blocked->getHeaders()['Retry-After'] ?? '');
            self::assertSame(45, $blocked->getData()['retry_after']);

            $secLog = $logDir . DIRECTORY_SEPARATOR . 'security-' . date('Y-m-d') . '.log';
            self::assertFileExists($secLog);
            $logContent = file_get_contents($secLog);
            self::assertIsString($logContent);
            self::assertStringContainsString('Rate limit exceeded', $logContent);
            self::assertStringContainsString('auth_google', $logContent);

            // Advance past the 60s window and verify reset
            $now += 45;
            $afterReset = $limiter->limit($request, 'auth_google', 2, 60, $handler);
            self::assertSame(200, $afterReset->getStatusCode());
            self::assertSame('1', $afterReset->getHeaders()['X-RateLimit-Remaining'] ?? '');
        } finally {
            foreach ([$rateDir, $logDir] as $dir) {
                $files = glob($dir . DIRECTORY_SEPARATOR . '*');
                if (is_array($files)) {
                    foreach ($files as $file) {
                        @unlink($file);
                    }
                }
                @rmdir($dir);
            }
            @rmdir($baseDir);
        }
    }

    public function testJsonResponseDefinesRequiredSecurityHeaders(): void
    {
        self::assertSame([
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
        ], JsonResponse::SECURITY_HEADERS);
    }
}
