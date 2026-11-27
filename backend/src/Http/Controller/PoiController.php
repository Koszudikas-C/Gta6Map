<?php

declare(strict_types=1);

namespace App\Http\Controller;

use App\Http\JsonResponse;
use App\Http\Request;
use App\Repository\PoiCategoryRecord;
use App\Repository\PoiRecord;
use App\Service\PoiCacheService;

/**
 * Public read endpoints for POI categories and published map POIs.
 */
final class PoiController
{
    public function __construct(
        private readonly PoiCacheService $poiCache,
    ) {
    }

    public function listCategories(Request $request): JsonResponse
    {
        $categories = array_map(
            static fn (PoiCategoryRecord $cat): array => $cat->toPublicArray(),
            $this->poiCache->getCategories()
        );

        return new JsonResponse(200, [
            'categories' => $categories,
            'request_id' => $request->getRequestId(),
        ]);
    }

    public function listPois(Request $request): JsonResponse
    {
        $query = $request->getQuery();
        $category = $query['category'] ?? null;
        $search = $query['q'] ?? null;

        $pois = $this->poiCache->filterPois($category, $search);
        $items = array_map(
            static fn (PoiRecord $poi): array => $poi->toPublicArray(),
            $pois
        );

        return new JsonResponse(200, [
            'pois' => $items,
            'total' => count($items),
            'request_id' => $request->getRequestId(),
        ]);
    }

    public function getPoi(Request $request): JsonResponse
    {
        $rawId = $request->getRouteParam('id');
        if ($rawId === '' || !ctype_digit($rawId) || (int) $rawId <= 0) {
            return new JsonResponse(400, [
                'error' => 'Bad Request',
                'message' => 'POI id must be a positive integer.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $poi = $this->poiCache->getPublishedPoiById((int) $rawId);
        if ($poi === null) {
            return new JsonResponse(404, [
                'error' => 'Not Found',
                'message' => 'POI not found.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        return new JsonResponse(200, [
            'poi' => $poi->toPublicArray(),
            'request_id' => $request->getRequestId(),
        ]);
    }
}
