<?php

declare(strict_types=1);

namespace App\Repository;

/**
 * Persistence contract for VIP cloud POI progress checklists.
 */
interface ProgressRepositoryInterface
{
    /**
     * @return list<int>
     */
    public function findPoiIdsByUserAndSlot(string $userId, string $saveSlot): array;

    /**
     * @param list<int> $poiIds
     * @return list<int>
     */
    public function syncProgress(string $userId, string $saveSlot, array $poiIds, bool $replace = true): array;
}
