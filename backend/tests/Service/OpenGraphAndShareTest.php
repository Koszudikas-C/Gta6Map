<?php

declare(strict_types=1);

namespace Tests\Service;

use App\Http\Controller\ShareController;
use App\Http\Request;
use App\Repository\PoiRecord;
use App\Repository\PoiRepositoryInterface;
use App\Service\OpenGraphService;
use App\Service\PoiCacheService;
use PHPUnit\Framework\TestCase;

final class OpenGraphAndShareTest extends TestCase
{
    public function testDetectsSocialBotsAndEscapesXssInMetaTags(): void
    {
        $og = new OpenGraphService();

        self::assertTrue($og->isSocialBot('WhatsApp/2.23.20.0 A'));
        self::assertTrue($og->isSocialBot('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'));
        self::assertTrue($og->isSocialBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'));
        self::assertFalse($og->isSocialBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'));

        $repo = new class () implements PoiRepositoryInterface {
            public function findAllCategories(): array
            {
                return [];
            }

            public function findAllPublishedPois(): array
            {
                return [
                    new PoiRecord(
                        id: 77,
                        categoryId: 5,
                        categorySlug: 'easter-eggs',
                        categoryName: 'Easter Eggs',
                        title: 'Vice Pier <script>alert("xss")</script>',
                        description: 'Spot "secret" & <img src=x onerror=alert(1)>',
                        coordX: -80.12,
                        coordY: 25.76,
                        imageUrl: 'javascript:alert(1)',
                        panoramaUrl: null,
                        metadata: [],
                        status: 'PUBLISHED',
                        createdAt: '2026-11-27 00:00:00',
                        updatedAt: '2026-11-27 00:00:00',
                    ),
                ];
            }

            public function findPublishedPoiById(int $id): ?PoiRecord
            {
                return null;
            }
        };

        $cacheFile = sys_get_temp_dir() . '/gta6map_og_' . uniqid('', true) . '.json';
        try {
            $poiCache = new PoiCacheService($repo, $cacheFile, 0);
            $controller = new ShareController(
                $poiCache,
                $og,
                'https://gta6map.com.br',
                'https://gta6map.com.br/assets/og-leonida.webp'
            );

            $response = $controller->handle(new Request(
                'GET',
                '/share',
                headers: ['user-agent' => 'WhatsApp/2.24'],
                query: ['poi' => '77'],
                requestId: 'req-og-1'
            ));

            $html = $response->getBody();
            self::assertSame(200, $response->getStatusCode());
            self::assertStringContainsString('<meta property="og:title" content="Vice Pier &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; — Easter Eggs | Leonida Map">', $html);
            self::assertStringContainsString('&lt;img src=x onerror=alert(1)&gt;', $html);
            self::assertStringNotContainsString('<script>alert', $html);
            self::assertStringNotContainsString('javascript:alert', $html);
            self::assertStringContainsString('https://gta6map.com.br/assets/og-leonida.webp', $html);
            self::assertStringContainsString('https://gta6map.com.br/?poi=77', $html);
        } finally {
            @unlink($cacheFile);
        }
    }
}
