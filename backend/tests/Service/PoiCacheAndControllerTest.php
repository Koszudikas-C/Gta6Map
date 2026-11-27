<?php

declare(strict_types=1);

namespace Tests\Service;

use App\Http\Controller\PoiController;
use App\Http\Request;
use App\Http\Router;
use App\Repository\PoiCategoryRecord;
use App\Repository\PoiRecord;
use App\Repository\PoiRepositoryInterface;
use App\Service\PoiCacheService;
use PHPUnit\Framework\TestCase;

final class PoiCacheAndControllerTest extends TestCase
{
    public function testCachesPublishedPoisFiltersByCategoryAndQueryAndInvalidatesCleanly(): void
    {
        $cacheDir = sys_get_temp_dir() . '/gta6map_poicache_' . uniqid('', true);
        $cacheFile = $cacheDir . '/pois.json';
        $now = 1_700_000_000;

        $repo = new class () implements PoiRepositoryInterface {
            public int $poiCalls = 0;

            public function findAllCategories(): array
            {
                return [
                    new PoiCategoryRecord(1, 'weapons', 'Armas', 'crosshair', '#FF4D6D', 1),
                    new PoiCategoryRecord(2, 'collectibles', 'Colecionáveis', 'gem', '#FF9E44', 2),
                ];
            }

            public function findAllPublishedPois(): array
            {
                $this->poiCalls++;

                return [
                    new PoiRecord(
                        id: 10,
                        categoryId: 1,
                        categorySlug: 'weapons',
                        categoryName: 'Armas',
                        title: 'Vice Beach Rifle Crate',
                        description: 'Hidden military crate behind lifeguard tower',
                        coordX: -80.13,
                        coordY: 25.78,
                        imageUrl: 'https://cdn.leonida.com.br/pois/10.webp',
                        panoramaUrl: null,
                        metadata: ['region' => 'Ocean Beach'],
                        status: 'PUBLISHED',
                        createdAt: '2026-11-27 00:00:00',
                        updatedAt: '2026-11-27 00:00:00',
                    ),
                    new PoiRecord(
                        id: 22,
                        categoryId: 2,
                        categorySlug: 'collectibles',
                        categoryName: 'Colecionáveis',
                        title: 'Flamingo Statue',
                        description: 'Neon collectible in Wynwood',
                        coordX: -80.19,
                        coordY: 25.80,
                        imageUrl: null,
                        panoramaUrl: 'https://cdn.leonida.com.br/pano/22.webp',
                        metadata: ['region' => 'Wynwood'],
                        status: 'PUBLISHED',
                        createdAt: '2026-11-27 00:00:00',
                        updatedAt: '2026-11-27 00:00:00',
                    ),
                ];
            }

            public function findPublishedPoiById(int $id): ?PoiRecord
            {
                foreach ($this->findAllPublishedPois() as $poi) {
                    if ($poi->id === $id) {
                        return $poi;
                    }
                }

                return null;
            }
        };

        $cache = new PoiCacheService(
            $repo,
            $cacheFile,
            300,
            static function () use (&$now): int {
                return $now;
            }
        );

        $controller = new PoiController($repo, $cache);
        $router = new Router();
        $router->get('/api/categories', [$controller, 'listCategories']);
        $router->get('/api/pois', [$controller, 'listPois']);
        $router->get('/api/pois/{id}', [$controller, 'getPoi']);

        try {
            $catsRes = $router->dispatch(new Request('GET', '/api/categories', requestId: 'req-poi-1'));
            self::assertSame(200, $catsRes->getStatusCode());
            self::assertCount(2, $catsRes->getData()['categories']);

            // First call populates JSON cache
            $allRes = $router->dispatch(new Request('GET', '/api/pois', requestId: 'req-poi-2'));
            self::assertSame(200, $allRes->getStatusCode());
            self::assertSame(2, $allRes->getData()['total']);
            self::assertSame(1, $repo->poiCalls);
            self::assertFileExists($cacheFile);

            // Second filtered call reads from cache without hitting repository
            $filteredRes = $router->dispatch(new Request(
                'GET',
                '/api/pois',
                query: ['category' => 'collectibles', 'q' => 'wynwood'],
                requestId: 'req-poi-3'
            ));
            self::assertSame(200, $filteredRes->getStatusCode());
            self::assertSame(1, $filteredRes->getData()['total']);
            self::assertSame(22, $filteredRes->getData()['pois'][0]['id']);
            self::assertSame(1, $repo->poiCalls);

            // Dynamic route detail
            $detailRes = $router->dispatch(new Request('GET', '/api/pois/10', requestId: 'req-poi-4'));
            self::assertSame(200, $detailRes->getStatusCode());
            self::assertSame('Vice Beach Rifle Crate', $detailRes->getData()['poi']['title']);

            $notFoundRes = $router->dispatch(new Request('GET', '/api/pois/999', requestId: 'req-poi-5'));
            self::assertSame(404, $notFoundRes->getStatusCode());

            // Invalidation forces fresh repo load
            self::assertTrue($cache->invalidate());
            $cache->getPublishedPois();
            self::assertSame(2, $repo->poiCalls);

            // Expiry forces refresh
            $now += 301;
            $cache->getPublishedPois();
            self::assertSame(3, $repo->poiCalls);
        } finally {
            @unlink($cacheFile);
            @rmdir($cacheDir);
        }
    }
}
