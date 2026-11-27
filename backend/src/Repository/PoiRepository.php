<?php

declare(strict_types=1);

namespace App\Repository;

use App\Database\Connection;
use Closure;
use PDO;
use Psr\Log\LoggerInterface;

/**
 * PDO_MYSQL repository for POI categories and published POIs.
 */
final class PoiRepository implements PoiRepositoryInterface
{
    private ?PDO $pdo = null;

    /**
     * @param Closure(): PDO $pdoFactory
     */
    public function __construct(
        private readonly Closure $pdoFactory,
        private readonly ?LoggerInterface $slowQueryLogger = null,
    ) {
    }

    public function findAllCategories(): array
    {
        $stmt = Connection::executeTimed(
            $this->getPdo(),
            'SELECT id, slug, name, icon_name, color_hex, sort_order FROM poi_categories ORDER BY sort_order ASC, id ASC',
            [],
            $this->slowQueryLogger
        );

        $categories = [];
        while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
            $categories[] = PoiCategoryRecord::fromRow($row);
        }

        return $categories;
    }

    public function findAllPublishedPois(): array
    {
        $sql = <<<'SQL'
SELECT
    p.id,
    p.category_id,
    c.slug AS category_slug,
    c.name AS category_name,
    p.title,
    p.description,
    p.coord_x,
    p.coord_y,
    p.image_url,
    p.panorama_url,
    p.metadata,
    p.status,
    p.created_at,
    p.updated_at
FROM pois p
INNER JOIN poi_categories c ON c.id = p.category_id
WHERE p.status = :status
ORDER BY p.id ASC
SQL;

        $stmt = Connection::executeTimed(
            $this->getPdo(),
            $sql,
            [':status' => 'PUBLISHED'],
            $this->slowQueryLogger
        );

        $pois = [];
        while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
            $pois[] = PoiRecord::fromRow($row);
        }

        return $pois;
    }

    public function findPublishedPoiById(int $id): ?PoiRecord
    {
        $sql = <<<'SQL'
SELECT
    p.id,
    p.category_id,
    c.slug AS category_slug,
    c.name AS category_name,
    p.title,
    p.description,
    p.coord_x,
    p.coord_y,
    p.image_url,
    p.panorama_url,
    p.metadata,
    p.status,
    p.created_at,
    p.updated_at
FROM pois p
INNER JOIN poi_categories c ON c.id = p.category_id
WHERE p.id = :id AND p.status = :status
LIMIT 1
SQL;

        $stmt = Connection::executeTimed(
            $this->getPdo(),
            $sql,
            [':id' => $id, ':status' => 'PUBLISHED'],
            $this->slowQueryLogger
        );

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? PoiRecord::fromRow($row) : null;
    }

    private function getPdo(): PDO
    {
        if ($this->pdo === null) {
            $this->pdo = ($this->pdoFactory)();
        }

        return $this->pdo;
    }
}
