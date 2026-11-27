<?php

declare(strict_types=1);

namespace App\Http\Controller;

use App\Http\JsonResponse;
use App\Http\Request;
use Closure;
use PDO;
use Throwable;

/**
 * Healthcheck endpoint (GET /api/health) for UptimeRobot and shared hosting monitoring.
 */
final class HealthController
{
    private const MIN_FREE_DISK_BYTES = 104_857_600; // 100 MB

    /**
     * @param Closure(): PDO $pdoFactory
     */
    public function __construct(
        private readonly Closure $pdoFactory,
        private readonly string $storagePath,
        private readonly string $poiCacheFile,
        private readonly string $environment,
    ) {
    }

    public function handle(Request $request): JsonResponse
    {
        $dbCheck = $this->checkDatabase();
        $diskCheck = $this->checkStorageDisk();
        $cacheCheck = $this->checkPoiCache();

        $isHealthy = $dbCheck['status'] === 'up';
        $statusCode = $isHealthy ? 200 : 503;

        return new JsonResponse($statusCode, [
            'status' => $isHealthy ? 'ok' : 'degraded',
            'service' => 'gta6map-api',
            'environment' => $this->environment,
            'request_id' => $request->getRequestId(),
            'timestamp' => gmdate('c'),
            'checks' => [
                'database' => $dbCheck,
                'storage' => $diskCheck,
                'poi_cache' => $cacheCheck,
            ],
        ]);
    }

    /**
     * @return array{status: string, latency_ms?: float}
     */
    private function checkDatabase(): array
    {
        $startNs = hrtime(true);
        try {
            $pdo = ($this->pdoFactory)();
            $stmt = $pdo->query('SELECT 1');
            if ($stmt !== false) {
                $stmt->fetchColumn();
            }
            $latencyMs = round((hrtime(true) - $startNs) / 1_000_000, 2);

            return [
                'status' => 'up',
                'latency_ms' => $latencyMs,
            ];
        } catch (Throwable) {
            return [
                'status' => 'down',
            ];
        }
    }

    /**
     * @return array{status: string, free_mb: float|null}
     */
    private function checkStorageDisk(): array
    {
        $targetPath = is_dir($this->storagePath) ? $this->storagePath : dirname($this->storagePath);
        if (!is_dir($targetPath)) {
            return ['status' => 'unknown', 'free_mb' => null];
        }

        $freeBytes = @disk_free_space($targetPath);
        if ($freeBytes === false) {
            return ['status' => 'unknown', 'free_mb' => null];
        }

        $freeMb = round($freeBytes / 1_048_576, 2);
        $status = $freeBytes >= self::MIN_FREE_DISK_BYTES ? 'ok' : 'low_disk';

        return [
            'status' => $status,
            'free_mb' => $freeMb,
        ];
    }

    /**
     * @return array{status: string, size_bytes?: int}
     */
    private function checkPoiCache(): array
    {
        if (!is_file($this->poiCacheFile) || !is_readable($this->poiCacheFile)) {
            return ['status' => 'cold'];
        }

        $size = filesize($this->poiCacheFile);
        if ($size === false || $size === 0) {
            return ['status' => 'cold'];
        }

        return [
            'status' => 'warm',
            'size_bytes' => $size,
        ];
    }
}
