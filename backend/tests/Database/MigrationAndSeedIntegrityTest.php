<?php

declare(strict_types=1);

namespace Tests\Database;

use App\Database\MigrationRunner;
use PDO;
use PDOStatement;
use PHPUnit\Framework\TestCase;

final class MigrationAndSeedIntegrityTest extends TestCase
{
    public function testInitialSchemaDefinesAllRequiredMySqlInnoDbTables(): void
    {
        $schemaPath = dirname(__DIR__, 3) . '/database/migrations/001_initial_schema.sql';
        self::assertFileExists($schemaPath);

        $sql = file_get_contents($schemaPath);
        self::assertIsString($sql);

        $expectedTables = [
            'users',
            'poi_categories',
            'pois',
            'user_poi_progress',
            'user_custom_pins',
            'payments',
            'raffle_quotas',
            'campaign_settings',
            'audit_logs',
        ];

        foreach ($expectedTables as $table) {
            self::assertStringContainsString("CREATE TABLE IF NOT EXISTS {$table}", $sql);
        }

        self::assertStringContainsString('ENGINE=InnoDB', $sql);
        self::assertStringContainsString('utf8mb4_unicode_ci', $sql);
        self::assertStringContainsString('CHAR(36)', $sql);
        self::assertStringContainsString('USING BTREE', $sql);
        self::assertStringContainsString('CHECK (quota_number <= 999)', $sql);

        $statements = MigrationRunner::splitSqlStatements($sql);
        self::assertCount(11, $statements); // 2 SET statements + 9 CREATE TABLE statements
    }

    public function testInitialSeedDefinesQuotas000To999CategoriesAndPs5Goal(): void
    {
        $seedPath = dirname(__DIR__, 3) . '/database/seeds/001_initial_seed.sql';
        self::assertFileExists($seedPath);

        $sql = file_get_contents($seedPath);
        self::assertIsString($sql);

        self::assertStringContainsString('INSERT IGNORE INTO raffle_quotas', $sql);
        self::assertStringContainsString("<= 799 THEN 'PAID'", $sql);
        self::assertStringContainsString("ELSE 'REFERRAL_BONUS'", $sql);
        self::assertStringContainsString('INSERT IGNORE INTO poi_categories', $sql);
        self::assertStringContainsString('INSERT IGNORE INTO campaign_settings', $sql);
        self::assertStringContainsString('1200000', $sql);
        self::assertStringContainsString('800', $sql);

        $statements = MigrationRunner::splitSqlStatements($sql);
        self::assertCount(3, $statements);
    }

    public function testSplitSqlStatementsHandlesStringsAndComments(): void
    {
        $sql = <<<'SQL'
-- Line comment with ; inside
SELECT 'value;with;semicolons';
/* Block comment ; */
INSERT INTO t (a) VALUES ("hello;world");
SQL;

        $statements = MigrationRunner::splitSqlStatements($sql);
        self::assertCount(2, $statements);
        self::assertSame("SELECT 'value;with;semicolons'", $statements[0]);
        self::assertSame('INSERT INTO t (a) VALUES ("hello;world")', $statements[1]);
    }

    public function testMigrationRunnerIsIdempotentAndSkipsAppliedFiles(): void
    {
        $tmpDir = sys_get_temp_dir() . '/gta6map_mig_' . uniqid('', true);
        mkdir($tmpDir, 0750, true);
        file_put_contents($tmpDir . '/001_test.sql', 'SELECT 1;');
        file_put_contents($tmpDir . '/002_test.sql', 'SELECT 2;');

        $queryStmt = $this->createStub(PDOStatement::class);
        $queryStmt->method('fetch')->willReturnOnConsecutiveCalls(
            ['migration' => '001_test.sql', 'checksum' => 'abc'],
            false
        );

        $insertStmt = $this->createMock(PDOStatement::class);
        $insertStmt->expects(self::once())->method('execute')->with(self::callback(
            static fn (array $params): bool => ($params[':migration'] ?? '') === '002_test.sql'
        ));

        $pdo = $this->createMock(PDO::class);
        $pdo->method('query')->willReturn($queryStmt);
        $pdo->expects(self::once())->method('exec')->with('SELECT 2');
        $pdo->expects(self::once())->method('prepare')->willReturn($insertStmt);

        try {
            $runner = new MigrationRunner($pdo);
            $applied = $runner->runDirectory($tmpDir, 'migration');

            self::assertSame(['002_test.sql'], $applied);
        } finally {
            @unlink($tmpDir . '/001_test.sql');
            @unlink($tmpDir . '/002_test.sql');
            @rmdir($tmpDir);
        }
    }
}
