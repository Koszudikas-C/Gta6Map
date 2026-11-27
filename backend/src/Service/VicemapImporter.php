<?php

declare(strict_types=1);

namespace App\Service;

use App\Repository\PoiCategoryRecord;
use App\Repository\PoiRecord;
use JsonException;
use RuntimeException;

/**
 * Imports and calibrates vicemap.online POI data into Leonida WebMercator (lng, lat) coordinates.
 */
final class VicemapImporter
{
    /**
     * Affine WebMercator calibration coefficients fitted against gtadb.org Leonida landmarks:
     * lng = A * vx + B * vy + C
     * mercY = D * vx + E * vy + F ; lat = rad2deg(2 * atan(exp(mercY)) - pi / 2)
     */
    private const COEFF_LNG_X = 0.17035224;
    private const COEFF_LNG_Y = 0.00048026;
    private const COEFF_LNG_C = -125.68716504;

    private const COEFF_MERC_X = -0.00005258;
    private const COEFF_MERC_Y = -0.00293171;
    private const COEFF_MERC_C = 2.21003525;

    /**
     * Clean pt-BR category definitions keyed by slug.
     *
     * @var array<string, array{id: int, name: string, icon: string, color: string, sort: int}>
     */
    private const CATEGORY_DEFINITIONS = [
        'missoes-historia' => ['id' => 101, 'name' => 'Missões da História', 'icon' => 'flag', 'color' => '#00D2D3', 'sort' => 1],
        'missoes-secundarias' => ['id' => 102, 'name' => 'Missões Secundárias', 'icon' => 'compass', 'color' => '#38BDF8', 'sort' => 2],
        'crimes-assaltos' => ['id' => 103, 'name' => 'Crimes e Assaltos', 'icon' => 'skull', 'color' => '#EF4444', 'sort' => 3],
        'cartas-colecionaveis' => ['id' => 104, 'name' => 'Cartas Colecionáveis', 'icon' => 'layers', 'color' => '#FF9E44', 'sort' => 4],
        'revistas-colecionaveis' => ['id' => 105, 'name' => 'Revistas Colecionáveis', 'icon' => 'book-open', 'color' => '#F59E0B', 'sort' => 5],
        'meteoritos' => ['id' => 106, 'name' => 'Fragmentos de Meteorito', 'icon' => 'flame', 'color' => '#F97316', 'sort' => 6],
        'monumentos-waink' => ['id' => 107, 'name' => 'Monumentos WAiNK', 'icon' => 'landmark', 'color' => '#EAB308', 'sort' => 7],
        'flamingos' => ['id' => 108, 'name' => 'Flamingos', 'icon' => 'bird', 'color' => '#EC4899', 'sort' => 8],
        'pontos-meditacao' => ['id' => 109, 'name' => 'Pontos de Meditação', 'icon' => 'sun', 'color' => '#14B8A6', 'sort' => 9],
        'armas' => ['id' => 110, 'name' => 'Armas', 'icon' => 'crosshair', 'color' => '#FF4D6D', 'sort' => 10],
        'armas-unicas' => ['id' => 111, 'name' => 'Armas Únicas', 'icon' => 'target', 'color' => '#FB7185', 'sort' => 11],
        'easter-eggs' => ['id' => 112, 'name' => 'Easter Eggs', 'icon' => 'sparkles', 'color' => '#A855F7', 'sort' => 12],
        'lojas-comercio' => ['id' => 113, 'name' => 'Lojas e Comércio', 'icon' => 'shopping-bag', 'color' => '#22C55E', 'sort' => 13],
        'bancos' => ['id' => 114, 'name' => 'Bancos e Financeiras', 'icon' => 'banknote', 'color' => '#10B981', 'sort' => 14],
        'hoteis' => ['id' => 115, 'name' => 'Hotéis e Resorts', 'icon' => 'bed-double', 'color' => '#F472B6', 'sort' => 15],
        'gastronomia-lazer' => ['id' => 116, 'name' => 'Bares, Cafés e Lazer', 'icon' => 'utensils', 'color' => '#FB923C', 'sort' => 16],
        'veiculos-oficinas' => ['id' => 117, 'name' => 'Veículos e Oficinas', 'icon' => 'car', 'color' => '#60A5FA', 'sort' => 17],
        'servicos-bem-estar' => ['id' => 118, 'name' => 'Serviços e Bem-Estar', 'icon' => 'heart-pulse', 'color' => '#34D399', 'sort' => 18],
        'esconderijos' => ['id' => 119, 'name' => 'Esconderijos', 'icon' => 'home', 'color' => '#A78BFA', 'sort' => 19],
        'transporte' => ['id' => 120, 'name' => 'Transporte, Aeroportos e Marinas', 'icon' => 'plane', 'color' => '#06B6D4', 'sort' => 20],
        'pontos-referencia' => ['id' => 121, 'name' => 'Pontos de Referência', 'icon' => 'map-pin', 'color' => '#94A3B8', 'sort' => 21],
        'seguranca-emergencia' => ['id' => 122, 'name' => 'Polícia e Bombeiros', 'icon' => 'shield', 'color' => '#3B82F6', 'sort' => 22],
    ];

    /** @var array<string, string> */
    private const SOURCE_CATEGORY_MAP = [
        'missao' => 'missoes-historia',
        'secundaria' => 'missoes-secundarias',
        'crime' => 'crimes-assaltos',
        'carta' => 'cartas-colecionaveis',
        'revista' => 'revistas-colecionaveis',
        'meteorito' => 'meteoritos',
        'waink' => 'monumentos-waink',
        'flamingo' => 'flamingos',
        'meditacao' => 'pontos-meditacao',
        'armas' => 'armas',
        'armaunica' => 'armas-unicas',
        'easter' => 'easter-eggs',
        'loja' => 'lojas-comercio',
        'roupa' => 'lojas-comercio',
        'sapato' => 'lojas-comercio',
        'joalheria' => 'lojas-comercio',
        'eletronicos' => 'lojas-comercio',
        'receptador' => 'lojas-comercio',
        'banco' => 'bancos',
        'emprestimo' => 'bancos',
        'hotel' => 'hoteis',
        'restaurante' => 'gastronomia-lazer',
        'bar' => 'gastronomia-lazer',
        'cafe' => 'gastronomia-lazer',
        'bebida' => 'gastronomia-lazer',
        'boate' => 'gastronomia-lazer',
        'lazer' => 'gastronomia-lazer',
        'posto' => 'veiculos-oficinas',
        'paynspray' => 'veiculos-oficinas',
        'oficina' => 'veiculos-oficinas',
        'lavajato' => 'veiculos-oficinas',
        'concessionaria' => 'veiculos-oficinas',
        'garagem' => 'veiculos-oficinas',
        'veiculo' => 'veiculos-oficinas',
        'barbearia' => 'servicos-bem-estar',
        'academia' => 'servicos-bem-estar',
        'saude' => 'servicos-bem-estar',
        'safehouse' => 'esconderijos',
        'transporte' => 'transporte',
        'aeroporto' => 'transporte',
        'marina' => 'transporte',
        'marco' => 'pontos-referencia',
        'policia' => 'seguranca-emergencia',
        'bombeiros' => 'seguranca-emergencia',
    ];

    /**
     * Convert vicemap.online canvas (x, y) coordinates into calibrated Leonida (lng, lat).
     *
     * @return array{lng: float, lat: float}
     */
    public static function convertCoordinates(float $vx, float $vy): array
    {
        $lng = self::COEFF_LNG_X * $vx + self::COEFF_LNG_Y * $vy + self::COEFF_LNG_C;
        $mercY = self::COEFF_MERC_X * $vx + self::COEFF_MERC_Y * $vy + self::COEFF_MERC_C;
        $lat = rad2deg(2.0 * atan(exp($mercY)) - M_PI / 2.0);

        $clampedLng = max(-180.0, min(180.0, $lng));
        $clampedLat = max(-85.0, min(85.0, $lat));

        return [
            'lng' => round($clampedLng, 5),
            'lat' => round($clampedLat, 5),
        ];
    }

    public static function mapCategory(string $rawCategory): PoiCategoryRecord
    {
        $normalized = strtolower(trim($rawCategory));
        $slug = self::SOURCE_CATEGORY_MAP[$normalized] ?? 'pontos-referencia';
        $def = self::CATEGORY_DEFINITIONS[$slug];

        return new PoiCategoryRecord(
            id: $def['id'],
            slug: $slug,
            name: $def['name'],
            iconName: $def['icon'],
            colorHex: $def['color'],
            sortOrder: $def['sort'],
        );
    }

    /**
     * Parse raw vicemap.online JSON payload into calibrated PoiCategoryRecord and PoiRecord lists.
     *
     * @return array{
     *   categories: list<PoiCategoryRecord>,
     *   pois: list<PoiRecord>,
     *   skipped_without_coords: int
     * }
     */
    public function parseJson(string $rawJson, string $timestamp = '2026-11-27 00:00:00'): array
    {
        $cleanJson = ltrim($rawJson, "\xEF\xBB\xBF");
        try {
            $decoded = json_decode($cleanJson, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('Invalid JSON in vicemap data: ' . $exception->getMessage(), 0, $exception);
        }

        if (!is_array($decoded) || !isset($decoded['items']) || !is_array($decoded['items'])) {
            throw new RuntimeException('Vicemap payload missing items array.');
        }

        /** @var array<string, mixed> $sources */
        $sources = isset($decoded['src']) && is_array($decoded['src']) ? $decoded['src'] : [];

        /** @var array<string, PoiCategoryRecord> $usedCategories */
        $usedCategories = [];
        $pois = [];
        $skipped = 0;
        $nextId = 1;

        foreach ($decoded['items'] as $item) {
            if (!is_array($item)) {
                $skipped++;
                continue;
            }

            $rawX = $item[7] ?? null;
            $rawY = $item[8] ?? null;
            if (!is_numeric($rawX) || !is_numeric($rawY)) {
                $skipped++;
                continue;
            }

            $rawCategory = is_string($item[0] ?? null) ? $item[0] : 'marco';
            $title = trim((string) ($item[1] ?? ''));
            if ($title === '') {
                $skipped++;
                continue;
            }

            $vx = (float) $rawX;
            $vy = (float) $rawY;
            $coords = self::convertCoordinates($vx, $vy);
            $category = self::mapCategory($rawCategory);
            $usedCategories[$category->slug] = $category;

            $region = trim((string) ($item[2] ?? ''));
            $breadcrumb = trim((string) ($item[3] ?? ''));
            $description = trim((string) ($item[4] ?? ''));
            $confidence = trim((string) ($item[5] ?? ''));
            $sourceCode = trim((string) ($item[6] ?? ''));
            $precision = trim((string) ($item[9] ?? ''));

            $metadata = [
                'region' => $region !== '' ? $region : 'Leonida',
                'source_category' => $rawCategory,
                'source_coords' => ['x' => $vx, 'y' => $vy],
            ];
            if ($breadcrumb !== '') {
                $metadata['breadcrumb'] = $breadcrumb;
            }
            if ($precision !== '') {
                $metadata['precision'] = $precision;
            }
            if ($confidence !== '') {
                $metadata['confidence'] = $confidence;
            }
            if ($sourceCode !== '' && isset($sources[$sourceCode]) && is_array($sources[$sourceCode])) {
                $metadata['source_ref'] = (string) ($sources[$sourceCode][0] ?? $sourceCode);
            }

            $pois[] = new PoiRecord(
                id: $nextId++,
                categoryId: $category->id,
                categorySlug: $category->slug,
                categoryName: $category->name,
                title: $this->truncate($title, 150),
                description: $description !== '' ? $description : null,
                coordX: $coords['lng'],
                coordY: $coords['lat'],
                imageUrl: null,
                panoramaUrl: null,
                metadata: $metadata,
                status: 'PUBLISHED',
                createdAt: $timestamp,
                updatedAt: $timestamp,
            );
        }

        $categories = array_values($usedCategories);
        usort($categories, static fn (PoiCategoryRecord $a, PoiCategoryRecord $b): int => $a->sortOrder <=> $b->sortOrder);

        return [
            'categories' => $categories,
            'pois' => $pois,
            'skipped_without_coords' => $skipped,
        ];
    }

    /**
     * @param list<PoiCategoryRecord> $categories
     * @param list<PoiRecord> $pois
     */
    public function buildCacheJson(array $categories, array $pois, int $generatedAt): string
    {
        return json_encode([
            'generated_at' => $generatedAt,
            'source' => 'vicemap.online',
            'categories' => array_map(static fn (PoiCategoryRecord $c): array => $c->toPublicArray(), $categories),
            'pois' => array_map(static fn (PoiRecord $p): array => $p->toPublicArray(), $pois),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    /**
     * @param list<PoiCategoryRecord> $categories
     * @param list<PoiRecord> $pois
     */
    public function buildSeedSql(array $categories, array $pois): string
    {
        $lines = [
            '-- Gta6Map (Leonida) - Idempotent Vicemap Calibrated POIs Seed (MySQL 8.0+ InnoDB)',
            '-- Generated by backend/bin/import-vicemap.php',
            '',
            'SET NAMES utf8mb4;',
            '',
            '-- 1. Upsert clean pt-BR categories',
        ];

        foreach ($categories as $category) {
            $lines[] = sprintf(
                "INSERT INTO poi_categories (slug, name, icon_name, color_hex, sort_order) VALUES (%s, %s, %s, %s, %d) ON DUPLICATE KEY UPDATE name = VALUES(name), icon_name = VALUES(icon_name), color_hex = VALUES(color_hex), sort_order = VALUES(sort_order);",
                $this->sqlString($category->slug),
                $this->sqlString($category->name),
                $this->sqlString($category->iconName),
                $this->sqlString($category->colorHex),
                $category->sortOrder
            );
        }

        $lines[] = '';
        $lines[] = '-- 2. Upsert calibrated published POIs';

        foreach ($pois as $poi) {
            $metadataJson = json_encode($poi->metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $descriptionSql = $poi->description !== null ? $this->sqlString($poi->description) : 'NULL';
            $lines[] = sprintf(
                "INSERT INTO pois (id, category_id, title, description, coord_x, coord_y, image_url, panorama_url, metadata, status) VALUES (%d, (SELECT id FROM poi_categories WHERE slug = %s LIMIT 1), %s, %s, %.5F, %.5F, NULL, NULL, %s, 'PUBLISHED') ON DUPLICATE KEY UPDATE category_id = VALUES(category_id), title = VALUES(title), description = VALUES(description), coord_x = VALUES(coord_x), coord_y = VALUES(coord_y), metadata = VALUES(metadata), status = VALUES(status);",
                $poi->id,
                $this->sqlString($poi->categorySlug),
                $this->sqlString($poi->title),
                $descriptionSql,
                $poi->coordX,
                $poi->coordY,
                $this->sqlString($metadataJson)
            );
        }

        $lines[] = '';

        return implode("\n", $lines);
    }

    private function truncate(string $value, int $maxLength): string
    {
        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            return mb_strlen($value, 'UTF-8') > $maxLength
                ? mb_substr($value, 0, $maxLength, 'UTF-8')
                : $value;
        }

        return strlen($value) > $maxLength ? substr($value, 0, $maxLength) : $value;
    }

    private function sqlString(string $value): string
    {
        $escaped = str_replace(
            ['\\', "\0", "\n", "\r", "'", '"', "\x1a"],
            ['\\\\', '\\0', '\\n', '\\r', "\\'", '\\"', '\\Z'],
            $value
        );

        return "'" . $escaped . "'";
    }
}
