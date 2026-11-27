<?php

declare(strict_types=1);

namespace App\Repository;

/**
 * Immutable POI category record.
 */
final readonly class PoiCategoryRecord
{
    public function __construct(
        public int $id,
        public string $slug,
        public string $name,
        public string $iconName,
        public string $colorHex,
        public int $sortOrder,
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            id: (int) ($row['id'] ?? 0),
            slug: (string) ($row['slug'] ?? ''),
            name: (string) ($row['name'] ?? ''),
            iconName: (string) ($row['icon_name'] ?? 'map-pin'),
            colorHex: (string) ($row['color_hex'] ?? '#FF4D6D'),
            sortOrder: (int) ($row['sort_order'] ?? 0),
        );
    }

    /**
     * @return array<string, int|string>
     */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'icon_name' => $this->iconName,
            'color_hex' => $this->colorHex,
            'sort_order' => $this->sortOrder,
        ];
    }
}
