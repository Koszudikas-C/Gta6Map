<?php

declare(strict_types=1);

namespace Tests\Http;

use App\Http\Controller\TelemetryController;
use App\Http\Request;
use App\Logging\LoggerFactory;
use PHPUnit\Framework\TestCase;

final class TelemetryControllerTest extends TestCase
{
    public function testAcceptsFrontendBatchPayloadAndMasksSecretsInLogs(): void
    {
        $logDir = sys_get_temp_dir() . '/gta6map_telemetry_' . uniqid('', true);
        $requestId = 'req-telemetry-1234';

        try {
            $loggerFactory = new LoggerFactory($logDir, $requestId, false, 30);
            $controller = new TelemetryController($loggerFactory->channel(LoggerFactory::CHANNEL_APP));

            $body = json_encode([
                'events' => [
                    [
                        'level' => 'error',
                        'source' => 'webgl',
                        'message' => 'Context lost for CPF 123.456.789-00 with Bearer secret_jwt_token',
                        'stack' => 'Error: WebGL lost at MapService.init',
                        'route' => '/',
                        'deviceType' => 'console',
                        'gamepadConnected' => true,
                        'buildVersion' => '0.1.0-alpha',
                        'timestamp' => '2026-11-27T02:00:00Z',
                    ],
                ],
            ], JSON_THROW_ON_ERROR);

            $request = new Request(
                method: 'POST',
                path: '/api/telemetry/client-error',
                rawBody: $body,
                requestId: $requestId,
            );

            $response = $controller->handle($request);
            self::assertSame(202, $response->getStatusCode());
            self::assertSame(1, $response->getData()['accepted_count']);

            $logFile = $logDir . DIRECTORY_SEPARATOR . 'app-' . date('Y-m-d') . '.log';
            $logContents = file_get_contents($logFile);
            self::assertIsString($logContents);
            self::assertStringNotContainsString('123.456.789-00', $logContents);
            self::assertStringNotContainsString('secret_jwt_token', $logContents);
            self::assertStringContainsString('***.***.***-**', $logContents);
            self::assertStringContainsString('Bearer [REDACTED]', $logContents);
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

    public function testRejectsInvalidJsonAndInvalidPayload(): void
    {
        $logDir = sys_get_temp_dir() . '/gta6map_telemetry_err_' . uniqid('', true);
        $loggerFactory = new LoggerFactory($logDir, 'req-err', false, 30);
        $controller = new TelemetryController($loggerFactory->channel(LoggerFactory::CHANNEL_APP));

        try {
            $badJson = $controller->handle(new Request('POST', '/api/telemetry/client-error', rawBody: '{invalid', requestId: 'req-err'));
            self::assertSame(400, $badJson->getStatusCode());

            $invalidLevel = $controller->handle(new Request(
                'POST',
                '/api/telemetry/client-error',
                rawBody: '{"events":[{"level":"fatal","source":"js","message":"boom"}]}',
                requestId: 'req-err'
            ));
            self::assertSame(422, $invalidLevel->getStatusCode());
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
