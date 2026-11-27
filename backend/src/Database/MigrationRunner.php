<?php

declare(strict_types=1);

namespace App\Database;

use PDO;
use RuntimeException;

/**
 * Idempotent SQL migration and seed runner backed by the schema_migrations table.
 */
final class MigrationRunner
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function ensureMigrationsTable(): void
    {
        $sql = <<<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    migration VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_schema_migrations_name (migration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL;

        $this->pdo->exec($sql);
    }

    /**
     * Apply all pending .sql files in the given directory sorted alphabetically.
     *
     * @return list<string> Filenames applied during this run
     */
    public function runDirectory(string $directory, string $type, bool $dryRun = false): array
    {
        $files = $this->listSqlFiles($directory);
        $applied = $this->getAppliedMigrations();
        $executed = [];

        foreach ($files as $filePath) {
            $name = basename($filePath);
            $content = file_get_contents($filePath);
            if ($content === false) {
                throw new RuntimeException(sprintf('Unable to read SQL file: %s', $filePath));
            }

            $checksum = hash('sha256', $content);
            if (isset($applied[$name])) {
                continue;
            }

            if ($dryRun) {
                $executed[] = $name;
                continue;
            }

            foreach (self::splitSqlStatements($content) as $statement) {
                $this->pdo->exec($statement);
            }

            $stmt = $this->pdo->prepare(
                'INSERT INTO schema_migrations (migration, type, checksum) VALUES (:migration, :type, :checksum)'
            );
            $stmt->execute([
                ':migration' => $name,
                ':type' => $type,
                ':checksum' => $checksum,
            ]);

            $executed[] = $name;
        }

        return $executed;
    }

    /**
     * Split multi-statement SQL scripts cleanly, respecting string literals and comments.
     *
     * @return list<string>
     */
    public static function splitSqlStatements(string $sql): array
    {
        $statements = [];
        $buffer = '';
        $length = strlen($sql);
        $inSingleQuote = false;
        $inDoubleQuote = false;
        $inLineComment = false;
        $inBlockComment = false;

        for ($i = 0; $i < $length; $i++) {
            $char = $sql[$i];
            $next = $i + 1 < $length ? $sql[$i + 1] : '';

            if ($inLineComment) {
                if ($char === "\n") {
                    $inLineComment = false;
                }
                continue;
            }

            if ($inBlockComment) {
                if ($char === '*' && $next === '/') {
                    $inBlockComment = false;
                    $i++;
                }
                continue;
            }

            if (!$inSingleQuote && !$inDoubleQuote) {
                if ($char === '-' && $next === '-') {
                    $inLineComment = true;
                    $i++;
                    continue;
                }

                if ($char === '#') {
                    $inLineComment = true;
                    continue;
                }

                if ($char === '/' && $next === '*') {
                    $inBlockComment = true;
                    $i++;
                    continue;
                }
            }

            if ($char === "'" && !$inDoubleQuote && !self::isEscaped($sql, $i)) {
                $inSingleQuote = !$inSingleQuote;
            } elseif ($char === '"' && !$inSingleQuote && !self::isEscaped($sql, $i)) {
                $inDoubleQuote = !$inDoubleQuote;
            }

            if ($char === ';' && !$inSingleQuote && !$inDoubleQuote) {
                $trimmed = trim($buffer);
                if ($trimmed !== '') {
                    $statements[] = $trimmed;
                }
                $buffer = '';
                continue;
            }

            $buffer .= $char;
        }

        $trimmed = trim($buffer);
        if ($trimmed !== '') {
            $statements[] = $trimmed;
        }

        return $statements;
    }

    /**
     * @return list<string>
     */
    private function listSqlFiles(string $directory): array
    {
        if (!is_dir($directory)) {
            return [];
        }

        $matches = glob(rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . '*.sql');
        if ($matches === false) {
            return [];
        }

        sort($matches, SORT_STRING);

        return $matches;
    }

    /**
     * @return array<string, string>
     */
    private function getAppliedMigrations(): array
    {
        $stmt = $this->pdo->query('SELECT migration, checksum FROM schema_migrations');
        if ($stmt === false) {
            return [];
        }

        $map = [];
        while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
            if (isset($row['migration'], $row['checksum'])) {
                $map[(string) $row['migration']] = (string) $row['checksum'];
            }
        }

        return $map;
    }

    private static function isEscaped(string $sql, int $index): bool
    {
        $backslashes = 0;
        for ($i = $index - 1; $i >= 0 && $sql[$i] === '\\'; $i--) {
            $backslashes++;
        }

        return ($backslashes % 2) === 1;
    }
}
