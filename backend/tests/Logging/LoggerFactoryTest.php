<?php

declare(strict_types=1);

namespace Tests\Logging;

use App\Logging\LgpdSanitizer;
use App\Logging\LoggerFactory;
use PHPUnit\Framework\TestCase;

final class LoggerFactoryTest extends TestCase
{
    public function testLgpdSanitizerMasksCpfSecretsAndContacts(): void
    {
        $sanitized = LgpdSanitizer::sanitizeArray([
            'cpf' => '123.456.789-01',
            'email' => 'lucas.silva@example.com',
            'whatsapp' => '+55 11 99876-5432',
            'asaas_access_token' => 'secret_webhook_token_123',
            'nested' => [
                'authorization' => 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig',
                'note' => 'Customer CPF 12345678901 with Bearer abcdef12345',
            ],
        ]);

        self::assertSame('***.***.***-**', $sanitized['cpf']);
        self::assertSame('l***@example.com', $sanitized['email']);
        self::assertSame('***-****5432', $sanitized['whatsapp']);
        self::assertSame('[REDACTED]', $sanitized['asaas_access_token']);
        self::assertIsArray($sanitized['nested']);
        self::assertSame('[REDACTED]', $sanitized['nested']['authorization']);
        self::assertSame('Customer CPF ***.***.***-** with Bearer [REDACTED]', $sanitized['nested']['note']);
    }

    public function testLoggerFactoryWritesStructuredJsonWithRequestIdAndMasking(): void
    {
        $logDir = sys_get_temp_dir() . '/gta6map_logs_' . uniqid('', true);
        $requestId = '550e8400-e29b-41d4-a716-446655440000';

        try {
            $factory = new LoggerFactory($logDir, $requestId, false, 30);
            $appLogger = $factory->channel(LoggerFactory::CHANNEL_APP);
            $webhookLogger = $factory->channel(LoggerFactory::CHANNEL_ASAAS_WEBHOOK);
            $securityLogger = $factory->channel(LoggerFactory::CHANNEL_SECURITY);
            $slowQueryLogger = $factory->channel(LoggerFactory::CHANNEL_SLOW_QUERY);

            $appLogger->info('Test log with CPF 111.222.333-44', ['token' => 'secret123']);
            $webhookLogger->info('Webhook received', ['asaas_access_token' => 'tok_live_999']);
            $securityLogger->warning('Unauthorized admin access');
            $slowQueryLogger->warning('Slow query');

            $expectedLog = $logDir . DIRECTORY_SEPARATOR . 'app-' . date('Y-m-d') . '.log';
            self::assertFileExists($expectedLog);

            $lines = file($expectedLog, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            self::assertIsArray($lines);
            self::assertNotEmpty($lines);

            $decoded = json_decode($lines[0], true, 512, JSON_THROW_ON_ERROR);
            self::assertIsArray($decoded);
            self::assertSame('app', $decoded['channel']);
            self::assertSame('Test log with CPF ***.***.***-**', $decoded['message']);
            self::assertSame('[REDACTED]', $decoded['context']['token']);
            self::assertSame($requestId, $decoded['extra']['request_id']);

            self::assertFileExists($logDir . DIRECTORY_SEPARATOR . 'asaas-webhook-' . date('Y-m-d') . '.log');
            self::assertFileExists($logDir . DIRECTORY_SEPARATOR . 'security-' . date('Y-m-d') . '.log');
            self::assertFileExists($logDir . DIRECTORY_SEPARATOR . 'slow-query-' . date('Y-m-d') . '.log');
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
