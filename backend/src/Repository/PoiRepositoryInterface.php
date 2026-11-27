<?php

declare(strict_types=1);

namespace App\Repository;

/**
 * Persistence contract for POI categories and published POIs.
 */
interface PoiRepositoryInterface
{
    /**
     * @return list<PoiCategoryRecord>
     */
    public function findAllCategories(): array;

    /**
     * @return list<PoiRecord>
     */
    public function findAllPublishedPois(): array;

    public function findPublishedPoiById(int $id): ?PoiRecord;
}
