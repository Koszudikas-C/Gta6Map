<?php

declare(strict_types=1);

namespace App\Database;

use App\Config\Env;
use App\Logging\LgpdSanitizer;
use PDO;
use PDOStatement;
use Psr\Log\LoggerInterface;

/**
 * PDO_MYSQL factory enforcing native prepared statements and slow-query (>200ms) logging.
 */
final class Connection
{
    public const DEFAULT_SLOW_QUERY_MS = 200.0;

    /**
     * Build a hardened PDO_MYSQL connection with native prepares enabled.
     */
    public static function create(Env $env): PDO
    {
        $host = $env->getString('DB_HOST', '127.0.0.1');
        $port = $env->getInt('DB_PORT', 3306);
        $name = $env->getString('DB_NAME', 'gta6map');
        $user = $env->getString('DB_USER', 'root');
        $pass = $env->getString('DB_PASS', '');

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $name);

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ];

        $pdo = new PDO($dsn, $user, $pass, $options);
        $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

        return $pdo;
    }

    /**
     * Execute a prepared SQL statement and log to slow-query channel if elapsed > thresholdMs.
     *
     * @param array<int|string, mixed> $params
     */
    public static function executeTimed(
        PDO $pdo,
        string $sql,
        array $params = [],
        ?LoggerInterface $slowQueryLogger = null,
        float $thresholdMs = self::DEFAULT_SLOW_QUERY_MS,
    ): PDOStatement {
        $startNs = hrtime(true);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $elapsedMs = (hrtime(true) - $startNs) / 1_000_000;

        if ($slowQueryLogger !== null && $elapsedMs > $thresholdMs) {
            $slowQueryLogger->warning('Slow SQL query detected', [
                'elapsed_ms' => round($elapsedMs, 2),
                'threshold_ms' => $thresholdMs,
                'sql' => self::normalizeSqlForLog($sql),
                'params_shape' => self::anonymizeParams($params),
            ]);
        }

        return $stmt;
    }

    private static function normalizeSqlForLog(string $sql): string
    {
        $collapsed = preg_replace('/\s+/', ' ', trim($sql));

        return LgpdSanitizer::sanitizeString($collapsed ?? $sql);
    }

    /**
     * @param array<int|string, mixed> $params
     * @return array<int|string, string>
     */
    private static function anonymizeParams(array $params): array
    {
        $shape = [];
        foreach ($params as $key => $value) {
            $shape[$key] = sprintf('[%s]', get_debug_type($value));
        }

        return $shape;
    }
}
