<?php

declare(strict_types=1);

namespace App\Repository;

use JsonException;

/**
 * Immutable published POI record with category details and JSON metadata.
 */
final readonly class PoiRecord
{
    /**
     * @param array<string, mixed> $metadata
     */
    public function __construct(
        public int $id,
        public int $categoryId,
        public string $categorySlug,
        public string $categoryName,
        public string $title,
        public ?string $description,
        public float $coordX,
        public float $coordY,
        public ?string $imageUrl,
        public ?string $panoramaUrl,
        public array $metadata,
        public string $status,
        public string $createdAt,
        public string $updatedAt,
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        $metadata = self::decodeMetadata($row['metadata'] ?? []);

        return new self(
            id: (int) ($row['id'] ?? 0),
            categoryId: (int) ($row['category_id'] ?? 0),
            categorySlug: (string) ($row['category_slug'] ?? ''),
            categoryName: (string) ($row['category_name'] ?? ''),
            title: (string) ($row['title'] ?? ''),
            description: isset($row['description']) && is_string($row['description']) ? $row['description'] : null,
            coordX: (float) ($row['coord_x'] ?? 0.0),
            coordY: (float) ($row['coord_y'] ?? 0.0),
            imageUrl: isset($row['image_url']) && is_string($row['image_url']) ? $row['image_url'] : null,
            panoramaUrl: isset($row['panorama_url']) && is_string($row['panorama_url']) ? $row['panorama_url'] : null,
            metadata: $metadata,
            status: (string) ($row['status'] ?? 'PUBLISHED'),
            createdAt: (string) ($row['created_at'] ?? ''),
            updatedAt: (string) ($row['updated_at'] ?? ''),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->categoryId,
            'category_slug' => $this->categorySlug,
            'category_name' => $this->categoryName,
            'title' => $this->title,
            'description' => $this->description,
            'coord_x' => $this->coordX,
            'coord_y' => $this->coordY,
            'image_url' => $this->imageUrl,
            'panorama_url' => $this->panoramaUrl,
            'metadata' => $this->metadata,
            'status' => $this->status,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function decodeMetadata(mixed $raw): array
    {
        if (is_array($raw)) {
            /** @var array<string, mixed> $raw */
            return $raw;
        }

        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }

        try {
            $decoded = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return [];
        }

        if (!is_array($decoded)) {
            return [];
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }
}
