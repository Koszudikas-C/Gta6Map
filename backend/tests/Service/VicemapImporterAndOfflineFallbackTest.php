<?php

declare(strict_types=1);

namespace Tests\Service;

use App\Http\Controller\PoiController;
use App\Http\Request;
use App\Repository\PoiRepositoryInterface;
use App\Service\PoiCacheService;
use App\Service\VicemapImporter;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class VicemapImporterAndOfflineFallbackTest extends TestCase
{
    public function testCalibratesVicemapCoordinatesAndMapsCategoriesToPtBr(): void
    {
        $viceBeach = VicemapImporter::convertCoordinates(867.40, 720.87);
        self::assertGreaterThan(15.0, $viceBeach['lng']);
        self::assertLessThan(30.0, $viceBeach['lng']);
        self::assertGreaterThan(-5.0, $viceBeach['lat']);
        self::assertLessThan(15.0, $viceBeach['lat']);

        $keyLento = VicemapImporter::convertCoordinates(570.68, 1132.39);
        self::assertLessThan(-20.0, $keyLento['lng']);
        self::assertLessThan(-45.0, $keyLento['lat']);

        $portGellhorn = VicemapImporter::convertCoordinates(299.95, 594.58);
        self::assertLessThan(-65.0, $portGellhorn['lng']);
        self::assertGreaterThan(18.0, $portGellhorn['lat']);

        $missionCat = VicemapImporter::mapCategory('missao');
        self::assertSame('missoes-historia', $missionCat->slug);
        self::assertSame('Missões da História', $missionCat->name);

        $weaponCat = VicemapImporter::mapCategory('armaunica');
        self::assertSame('armas-unicas', $weaponCat->slug);
        self::assertSame('Armas Únicas', $weaponCat->name);

        $importer = new VicemapImporter();
        $sampleJson = json_encode([
            'src' => ['G' => ['GTA6-Maps.net', 'https://gta6-maps.net']],
            'items' => [
                ['missao', 'Cartel Heist', 'Tequesta', 'Tequesta › Vice City', 'Desc', 'c', 'G', 673.63, 820.28, 'bairro', 0],
                ['armas', 'Missing Coords Weapon', '', '', '', 'c', 'G', null, null, 'none', 0],
            ],
        ], JSON_THROW_ON_ERROR);

        $parsed = $importer->parseJson($sampleJson);
        self::assertCount(1, $parsed['pois']);
        self::assertSame(1, $parsed['skipped_without_coords']);
        self::assertSame('missoes-historia', $parsed['pois'][0]->categorySlug);
        self::assertSame('Tequesta', $parsed['pois'][0]->metadata['region']);

        $seedSql = $importer->buildSeedSql($parsed['categories'], $parsed['pois']);
        self::assertStringContainsString('INSERT INTO poi_categories', $seedSql);
        self::assertStringContainsString('ON DUPLICATE KEY UPDATE', $seedSql);
        self::assertStringContainsString('Cartel Heist', $seedSql);
    }

    public function testPoiCacheServiceServesCacheFileWhenDatabaseIsUnavailable(): void
    {
        $cacheDir = sys_get_temp_dir() . '/gta6map_offline_' . uniqid('', true);
        mkdir($cacheDir, 0750, true);
        $cacheFile = $cacheDir . '/pois.json';

        $importer = new VicemapImporter();
        $parsed = $importer->parseJson(json_encode([
            'src' => ['G' => ['GTA6-Maps.net', 'https://gta6-maps.net']],
            'items' => [
                ['carta', 'Carta #1', 'Ocean Beach', 'Ocean Beach › Vice Beach', 'Carta rara', 'c', 'G', 864.0, 710.0, 'bairro', 0],
                ['easter', 'Skunk Ape', 'Grassrivers', 'Grassrivers', 'Monstro do pantano', 'c', 'G', 470.0, 950.0, 'regiao', 0],
            ],
        ], JSON_THROW_ON_ERROR));

        // Intentionally write an expired timestamp (generated_at = 1) to verify fallback even past TTL
        file_put_contents($cacheFile, $importer->buildCacheJson($parsed['categories'], $parsed['pois'], 1));

        $failingRepo = new class () implements PoiRepositoryInterface {
            public function findAllCategories(): array
            {
                throw new RuntimeException('MySQL offline');
            }

            public function findAllPublishedPois(): array
            {
                throw new RuntimeException('MySQL offline');
            }

            public function findPublishedPoiById(int $id): ?\App\Repository\PoiRecord
            {
                throw new RuntimeException('MySQL offline');
            }
        };

        try {
            $cache = new PoiCacheService($failingRepo, $cacheFile, 300, static fn (): int => 1_700_000_000);
            $controller = new PoiController($cache);

            $catsRes = $controller->listCategories(new Request('GET', '/api/categories', requestId: 'req-off-1'));
            self::assertSame(200, $catsRes->getStatusCode());
            self::assertCount(2, $catsRes->getData()['categories']);

            $poisRes = $controller->listPois(new Request(
                'GET',
                '/api/pois',
                query: ['category' => 'easter-eggs', 'q' => 'grassrivers'],
                requestId: 'req-off-2'
            ));
            self::assertSame(200, $poisRes->getStatusCode());
            self::assertSame(1, $poisRes->getData()['total']);
            self::assertSame('Skunk Ape', $poisRes->getData()['pois'][0]['title']);
        } finally {
            @unlink($cacheFile);
            @rmdir($cacheDir);
        }
    }
}
