<?php

declare(strict_types=1);

namespace Tests\Database;

use App\Database\Connection;
use App\Logging\LoggerFactory;
use PDO;
use PDOStatement;
use PHPUnit\Framework\TestCase;

final class ConnectionSlowQueryTest extends TestCase
{
    public function testExecuteTimedLogsSlowQueriesWithoutLeakingParamValues(): void
    {
        $logDir = sys_get_temp_dir() . '/gta6map_slow_' . uniqid('', true);
        $loggerFactory = new LoggerFactory($logDir, 'req-slow-01', false, 30);
        $slowLogger = $loggerFactory->channel(LoggerFactory::CHANNEL_SLOW_QUERY);

        $stmt = $this->createMock(PDOStatement::class);
        $stmt->expects(self::once())->method('execute')->with([
            ':cpf' => '123.456.789-01',
            ':limit' => 25,
        ]);

        $pdo = $this->createMock(PDO::class);
        $pdo->expects(self::once())->method('prepare')->willReturn($stmt);

        try {
            Connection::executeTimed(
                $pdo,
                'SELECT id FROM users WHERE cpf = :cpf LIMIT :limit',
                [':cpf' => '123.456.789-01', ':limit' => 25],
                $slowLogger,
                0.0
            );

            $logFile = $logDir . DIRECTORY_SEPARATOR . 'slow-query-' . date('Y-m-d') . '.log';
            self::assertFileExists($logFile);

            $content = file_get_contents($logFile);
            self::assertIsString($content);
            self::assertStringNotContainsString('123.456.789-01', $content);
            self::assertStringContainsString('***.***.***-**', $content);
            self::assertStringContainsString('[int]', $content);
            self::assertStringContainsString('Slow SQL query detected', $content);
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
