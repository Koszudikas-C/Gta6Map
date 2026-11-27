<?php

declare(strict_types=1);

namespace App\Repository;

/**
 * Immutable VIP user custom map pin record.
 */
final readonly class CustomPinRecord
{
    public function __construct(
        public string $id,
        public string $userId,
        public string $title,
        public ?string $notes,
        public float $coordX,
        public float $coordY,
        public string $colorHex,
        public string $createdAt,
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            id: (string) ($row['id'] ?? ''),
            userId: (string) ($row['user_id'] ?? ''),
            title: (string) ($row['title'] ?? ''),
            notes: isset($row['notes']) && is_string($row['notes']) ? $row['notes'] : null,
            coordX: (float) ($row['coord_x'] ?? 0.0),
            coordY: (float) ($row['coord_y'] ?? 0.0),
            colorHex: (string) ($row['color_hex'] ?? '#00D2D3'),
            createdAt: (string) ($row['created_at'] ?? ''),
        );
    }

    /**
     * @return array<string, float|string|null>
     */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->userId,
            'title' => $this->title,
            'notes' => $this->notes,
            'coord_x' => $this->coordX,
            'coord_y' => $this->coordY,
            'color_hex' => $this->colorHex,
            'created_at' => $this->createdAt,
        ];
    }
}
