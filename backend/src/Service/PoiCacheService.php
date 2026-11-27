<?php

declare(strict_types=1);

namespace App\Service;

use App\Repository\PoiCategoryRecord;
use App\Repository\PoiRecord;
use App\Repository\PoiRepositoryInterface;
use Closure;
use JsonException;
use Throwable;

/**
 * File-backed JSON cache for published POIs and categories (backend/storage/cache/pois.json).
 * Falls back cleanly to existing cache data when MySQL is unavailable or empty.
 */
final class PoiCacheService
{
    /** @var Closure(): int */
    private readonly Closure $clock;

    /**
     * @param (Closure(): int)|null $clock
     */
    public function __construct(
        private readonly PoiRepositoryInterface $poiRepository,
        private readonly string $cacheFilePath,
        private readonly int $ttlSeconds = 300,
        ?Closure $clock = null,
    ) {
        $this->clock = $clock ?? static fn (): int => time();
    }

    /**
     * @return list<PoiCategoryRecord>
     */
    public function getCategories(): array
    {
        try {
            $fromDb = $this->poiRepository->findAllCategories();
            if ($fromDb !== []) {
                return $fromDb;
            }
        } catch (Throwable) {
            // Fall back to cache file categories when MySQL is unavailable locally
        }

        $decoded = $this->readDecodedCacheFile();
        if ($decoded === null) {
            return [];
        }

        if (isset($decoded['categories']) && is_array($decoded['categories'])) {
            $categories = [];
            foreach ($decoded['categories'] as $row) {
                if (is_array($row)) {
                    /** @var array<string, mixed> $row */
                    $categories[] = PoiCategoryRecord::fromRow($row);
                }
            }
            if ($categories !== []) {
                usort($categories, static fn (PoiCategoryRecord $a, PoiCategoryRecord $b): int => $a->sortOrder <=> $b->sortOrder);

                return $categories;
            }
        }

        return $this->deriveCategoriesFromPois($this->extractPoisFromDecoded($decoded));
    }

    /**
     * @return list<PoiRecord>
     */
    public function getPublishedPois(): array
    {
        $decoded = $this->readDecodedCacheFile();
        if ($decoded !== null && $this->isFresh($decoded)) {
            return $this->extractPoisFromDecoded($decoded);
        }

        try {
            $pois = $this->poiRepository->findAllPublishedPois();
            if ($pois !== []) {
                $this->writeCache($pois);

                return $pois;
            }
        } catch (Throwable) {
            // Fall back to stale cache file when MySQL is unavailable locally
        }

        if ($decoded !== null) {
            return $this->extractPoisFromDecoded($decoded);
        }

        return [];
    }

    /**
     * @return list<PoiRecord>
     */
    public function filterPois(?string $categoryFilter = null, ?string $searchQuery = null): array
    {
        $pois = $this->getPublishedPois();
        $normalizedCat = $categoryFilter !== null ? strtolower(trim($categoryFilter)) : '';
        $normalizedQuery = $searchQuery !== null ? trim($searchQuery) : '';

        if ($normalizedCat === 'all' || $normalizedCat === 'todas') {
            $normalizedCat = '';
        }

        if ($normalizedCat === '' && $normalizedQuery === '') {
            return $pois;
        }

        $filtered = [];
        foreach ($pois as $poi) {
            if ($normalizedCat !== '') {
                $matchesSlug = strtolower($poi->categorySlug) === $normalizedCat;
                $matchesId = ctype_digit($normalizedCat) && $poi->categoryId === (int) $normalizedCat;
                if (!$matchesSlug && !$matchesId) {
                    continue;
                }
            }

            if ($normalizedQuery !== '' && !$this->matchesQuery($poi, $normalizedQuery)) {
                continue;
            }

            $filtered[] = $poi;
        }

        return $filtered;
    }

    public function getPublishedPoiById(int $id): ?PoiRecord
    {
        if ($id <= 0) {
            return null;
        }

        foreach ($this->getPublishedPois() as $poi) {
            if ($poi->id === $id) {
                return $poi;
            }
        }

        return null;
    }

    public function invalidate(): bool
    {
        if (!is_file($this->cacheFilePath)) {
            return true;
        }

        return @unlink($this->cacheFilePath);
    }

    private function matchesQuery(PoiRecord $poi, string $query): bool
    {
        if ($this->containsInsensitive($poi->title, $query)) {
            return true;
        }

        if ($poi->description !== null && $this->containsInsensitive($poi->description, $query)) {
            return true;
        }

        if ($this->containsInsensitive($poi->categoryName, $query)) {
            return true;
        }

        $region = $poi->metadata['region'] ?? null;
        if (is_string($region) && $this->containsInsensitive($region, $query)) {
            return true;
        }

        return false;
    }

    private function containsInsensitive(string $haystack, string $needle): bool
    {
        if (function_exists('mb_stripos')) {
            return mb_stripos($haystack, $needle, 0, 'UTF-8') !== false;
        }

        return stripos($haystack, $needle) !== false;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function readDecodedCacheFile(): ?array
    {
        if (!is_file($this->cacheFilePath) || !is_readable($this->cacheFilePath)) {
            return null;
        }

        $raw = @file_get_contents($this->cacheFilePath);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }

        try {
            $decoded = json_decode($raw, true, 128, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        if (!is_array($decoded) || !isset($decoded['pois']) || !is_array($decoded['pois'])) {
            return null;
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }

    /**
     * @param array<string, mixed> $decoded
     */
    private function isFresh(array $decoded): bool
    {
        if ($this->ttlSeconds <= 0 || !isset($decoded['generated_at']) || !is_int($decoded['generated_at'])) {
            return false;
        }

        return (($this->clock)() - $decoded['generated_at']) < $this->ttlSeconds;
    }

    /**
     * @param array<string, mixed> $decoded
     * @return list<PoiRecord>
     */
    private function extractPoisFromDecoded(array $decoded): array
    {
        $records = [];
        $poisRaw = $decoded['pois'] ?? [];
        if (!is_array($poisRaw)) {
            return [];
        }

        foreach ($poisRaw as $item) {
            if (is_array($item)) {
                /** @var array<string, mixed> $item */
                $records[] = PoiRecord::fromRow($item);
            }
        }

        return $records;
    }

    /**
     * @param list<PoiRecord> $pois
     * @return list<PoiCategoryRecord>
     */
    private function deriveCategoriesFromPois(array $pois): array
    {
        /** @var array<string, PoiCategoryRecord> $map */
        $map = [];
        $order = 1;
        foreach ($pois as $poi) {
            if ($poi->categorySlug !== '' && !isset($map[$poi->categorySlug])) {
                $map[$poi->categorySlug] = new PoiCategoryRecord(
                    id: $poi->categoryId,
                    slug: $poi->categorySlug,
                    name: $poi->categoryName !== '' ? $poi->categoryName : $poi->categorySlug,
                    iconName: 'map-pin',
                    colorHex: '#FF4D6D',
                    sortOrder: $order++,
                );
            }
        }

        return array_values($map);
    }

    /**
     * @param list<PoiRecord> $pois
     */
    private function writeCache(array $pois): void
    {
        if ($this->ttlSeconds <= 0) {
            return;
        }

        $dir = dirname($this->cacheFilePath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }

        $categories = $this->deriveCategoriesFromPois($pois);
        $payload = [
            'generated_at' => ($this->clock)(),
            'categories' => array_map(static fn (PoiCategoryRecord $c): array => $c->toPublicArray(), $categories),
            'pois' => array_map(static fn (PoiRecord $poi): array => $poi->toPublicArray(), $pois),
        ];

        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $tmpFile = $this->cacheFilePath . '.tmp.' . bin2hex(random_bytes(4));
        if (@file_put_contents($tmpFile, $encoded, LOCK_EX) !== false) {
            @rename($tmpFile, $this->cacheFilePath);
        }
    }
}
