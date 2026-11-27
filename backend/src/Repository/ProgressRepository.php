<?php

declare(strict_types=1);

namespace App\Repository;

use App\Database\Connection;
use Closure;
use PDO;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * PDO_MYSQL repository for VIP user POI checklist progress.
 */
final class ProgressRepository implements ProgressRepositoryInterface
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

    public function findPoiIdsByUserAndSlot(string $userId, string $saveSlot): array
    {
        $stmt = Connection::executeTimed(
            $this->getPdo(),
            'SELECT poi_id FROM user_poi_progress WHERE user_id = :user_id AND save_slot = :save_slot ORDER BY poi_id ASC',
            [
                ':user_id' => $userId,
                ':save_slot' => $saveSlot,
            ],
            $this->slowQueryLogger
        );

        $ids = [];
        while (($col = $stmt->fetchColumn()) !== false) {
            $ids[] = (int) $col;
        }

        return $ids;
    }

    public function syncProgress(string $userId, string $saveSlot, array $poiIds, bool $replace = true): array
    {
        $pdo = $this->getPdo();
        $uniqueIds = array_values(array_unique(array_filter($poiIds, static fn (int $id): bool => $id > 0)));

        $pdo->beginTransaction();
        try {
            if ($replace) {
                Connection::executeTimed(
                    $pdo,
                    'DELETE FROM user_poi_progress WHERE user_id = :user_id AND save_slot = :save_slot',
                    [
                        ':user_id' => $userId,
                        ':save_slot' => $saveSlot,
                    ],
                    $this->slowQueryLogger
                );
            }

            if ($uniqueIds !== []) {
                $validPoiIds = $this->filterExistingPoiIds($pdo, $uniqueIds);
                $insertSql = 'INSERT IGNORE INTO user_poi_progress (user_id, save_slot, poi_id) VALUES (:user_id, :save_slot, :poi_id)';
                foreach ($validPoiIds as $poiId) {
                    Connection::executeTimed(
                        $pdo,
                        $insertSql,
                        [
                            ':user_id' => $userId,
                            ':save_slot' => $saveSlot,
                            ':poi_id' => $poiId,
                        ],
                        $this->slowQueryLogger
                    );
                }
            }

            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        return $this->findPoiIdsByUserAndSlot($userId, $saveSlot);
    }

    /**
     * @param list<int> $poiIds
     * @return list<int>
     */
    private function filterExistingPoiIds(PDO $pdo, array $poiIds): array
    {
        $placeholders = [];
        $params = [];
        foreach ($poiIds as $index => $poiId) {
            $key = ':p_' . $index;
            $placeholders[] = $key;
            $params[$key] = $poiId;
        }

        $sql = sprintf(
            'SELECT id FROM pois WHERE status = :status AND id IN (%s)',
            implode(', ', $placeholders)
        );
        $params[':status'] = 'PUBLISHED';

        $stmt = Connection::executeTimed($pdo, $sql, $params, $this->slowQueryLogger);
        $existing = [];
        while (($col = $stmt->fetchColumn()) !== false) {
            $existing[] = (int) $col;
        }

        return $existing;
    }

    private function getPdo(): PDO
    {
        if ($this->pdo === null) {
            $this->pdo = ($this->pdoFactory)();
        }

        return $this->pdo;
    }
}
