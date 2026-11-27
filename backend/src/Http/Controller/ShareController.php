<?php

declare(strict_types=1);

namespace App\Http\Controller;

use App\Http\HtmlResponse;
use App\Http\Request;
use App\Service\OpenGraphService;
use App\Service\PoiCacheService;

/**
 * Dynamic OpenGraph deep-link handler for WhatsApp, Discord, and search bots (RF05).
 */
final class ShareController
{
    public function __construct(
        private readonly PoiCacheService $poiCache,
        private readonly OpenGraphService $openGraphService,
        private readonly string $appBaseUrl,
        private readonly string $defaultImageUrl,
    ) {
    }

    public function handle(Request $request): HtmlResponse
    {
        $rawPoiId = $request->getRouteParam('id');
        if ($rawPoiId === '') {
            $rawPoiId = $request->getQuery()['poi'] ?? '';
        }

        $poi = null;
        $poiId = null;
        if ($rawPoiId !== '' && ctype_digit($rawPoiId) && (int) $rawPoiId > 0) {
            $poiId = (int) $rawPoiId;
            $poi = $this->poiCache->getPublishedPoiById($poiId);
        }

        $baseUrl = rtrim($this->appBaseUrl, '/');
        $canonicalUrl = $poiId !== null ? $baseUrl . '/?poi=' . $poiId : $baseUrl . '/';

        $html = $this->openGraphService->renderPoiShareHtml(
            poi: $poi,
            canonicalUrl: $canonicalUrl,
            defaultImageUrl: $this->defaultImageUrl,
            redirectUrl: $canonicalUrl,
        );

        return new HtmlResponse(200, $html);
    }

    public function isSocialBotRequest(Request $request): bool
    {
        return $this->openGraphService->isSocialBot($request->getHeader('User-Agent'));
    }
}
