<?php

declare(strict_types=1);

namespace App\Repository;

/**
 * Persistence contract for VIP custom map pins.
 */
interface CustomPinRepositoryInterface
{
    /**
     * @return list<CustomPinRecord>
     */
    public function findByUser(string $userId): array;

    public function findById(string $pinId): ?CustomPinRecord;

    public function create(
        string $id,
        string $userId,
        string $title,
        ?string $notes,
        float $coordX,
        float $coordY,
        string $colorHex,
    ): CustomPinRecord;

    public function deleteByIdForUser(string $pinId, string $userId): bool;
}
