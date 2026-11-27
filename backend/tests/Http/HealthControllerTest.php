<?php

declare(strict_types=1);

namespace Tests\Http;

use App\Http\Controller\HealthController;
use App\Http\Request;
use PDO;
use PDOException;
use PDOStatement;
use PHPUnit\Framework\TestCase;

final class HealthControllerTest extends TestCase
{
    public function testReturns200WhenDatabaseIsUpAndPoiCacheIsWarm(): void
    {
        $tmpDir = sys_get_temp_dir() . '/gta6map_health_' . uniqid('', true);
        mkdir($tmpDir, 0750, true);
        $cacheFile = $tmpDir . '/pois.json';
        file_put_contents($cacheFile, '{"pois":[]}');

        $stmt = $this->createStub(PDOStatement::class);
        $stmt->method('fetchColumn')->willReturn(1);

        $pdo = $this->createStub(PDO::class);
        $pdo->method('query')->willReturn($stmt);

        try {
            $controller = new HealthController(
                static fn (): PDO => $pdo,
                $tmpDir,
                $cacheFile,
                'test'
            );

            $response = $controller->handle(new Request('GET', '/api/health', requestId: 'req-health-01'));
            $data = $response->getData();

            self::assertSame(200, $response->getStatusCode());
            self::assertSame('ok', $data['status']);
            self::assertSame('up', $data['checks']['database']['status']);
            self::assertSame('warm', $data['checks']['poi_cache']['status']);
            self::assertSame('ok', $data['checks']['storage']['status']);
        } finally {
            @unlink($cacheFile);
            @rmdir($tmpDir);
        }
    }

    public function testReturns503WhenDatabaseConnectionFails(): void
    {
        $controller = new HealthController(
            static function (): PDO {
                throw new PDOException('Connection refused');
            },
            sys_get_temp_dir(),
            sys_get_temp_dir() . '/missing-pois-cache.json',
            'production'
        );

        $response = $controller->handle(new Request('GET', '/api/health', requestId: 'req-health-02'));
        $data = $response->getData();

        self::assertSame(503, $response->getStatusCode());
        self::assertSame('degraded', $data['status']);
        self::assertSame('down', $data['checks']['database']['status']);
        self::assertSame('cold', $data['checks']['poi_cache']['status']);
    }
}
