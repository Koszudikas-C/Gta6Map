<?php

declare(strict_types=1);

namespace Tests\Auth;

use App\Auth\AuthMiddleware;
use App\Auth\JwtService;
use App\Http\JsonResponse;
use App\Http\Request;
use App\Logging\LoggerFactory;
use PHPUnit\Framework\TestCase;

final class AuthMiddlewareTest extends TestCase
{
    private const SECRET = 'test_super_secret_jwt_key_32_chars_min';

    public function testAttachesAuthenticatedUserWhenBearerTokenIsValid(): void
    {
        $jwt = new JwtService(self::SECRET, 3600);
        $token = $jwt->issue('user-uuid-42', 'USER', true);
        $middleware = new AuthMiddleware($jwt);

        $request = new Request(
            method: 'GET',
            path: '/api/me',
            headers: ['authorization' => 'Bearer ' . $token],
            requestId: 'req-auth-1'
        );

        $response = $middleware->authenticate($request, static function (Request $authed): JsonResponse {
            $user = $authed->getAuthenticatedUser();
            self::assertNotNull($user);

            return new JsonResponse(200, [
                'sub' => $user->userId,
                'is_vip' => $user->isVip,
            ]);
        });

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('user-uuid-42', $response->getData()['sub']);
        self::assertTrue($response->getData()['is_vip']);
    }

    public function testReturns401AndLogsSecurityWarningWhenTokenInvalid(): void
    {
        $logDir = sys_get_temp_dir() . '/gta6map_sec_' . uniqid('', true);
        $loggerFactory = new LoggerFactory($logDir, 'req-auth-2', false, 30);
        $securityLogger = $loggerFactory->channel(LoggerFactory::CHANNEL_SECURITY);

        $jwt = new JwtService(self::SECRET, 3600);
        $middleware = new AuthMiddleware($jwt, $securityLogger);

        try {
            $request = new Request(
                method: 'GET',
                path: '/api/me',
                headers: ['authorization' => 'Bearer invalid.jwt.token'],
                requestId: 'req-auth-2'
            );

            $response = $middleware->authenticate($request, static fn (): JsonResponse => new JsonResponse(200, []));
            self::assertSame(401, $response->getStatusCode());

            $secLog = $logDir . DIRECTORY_SEPARATOR . 'security-' . date('Y-m-d') . '.log';
            self::assertFileExists($secLog);
            $logContents = file_get_contents($secLog);
            self::assertIsString($logContents);
            self::assertStringNotContainsString('invalid.jwt.token', $logContents);
        } finally {
            $files = glob($logDir . DIRECTORY_SEPARATOR . '*');
            if (is_array($files)) {
                foreach ($files as $file) {
                    @unlink($file);
                }
            }
            @rmdir($logDir);
        }
    }
}
