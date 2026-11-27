<?php

declare(strict_types=1);

namespace App\Repository;

use App\Database\Connection;
use Closure;
use PDO;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * PDO_MYSQL repository for VIP custom pins with user_id ownership checks.
 */
final class CustomPinRepository implements CustomPinRepositoryInterface
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

    public function findByUser(string $userId): array
    {
        $stmt = Connection::executeTimed(
            $this->getPdo(),
            'SELECT id, user_id, title, notes, coord_x, coord_y, color_hex, created_at FROM user_custom_pins WHERE user_id = :user_id ORDER BY created_at DESC',
            [':user_id' => $userId],
            $this->slowQueryLogger
        );

        $pins = [];
        while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
            $pins[] = CustomPinRecord::fromRow($row);
        }

        return $pins;
    }

    public function findById(string $pinId): ?CustomPinRecord
    {
        $stmt = Connection::executeTimed(
            $this->getPdo(),
            'SELECT id, user_id, title, notes, coord_x, coord_y, color_hex, created_at FROM user_custom_pins WHERE id = :id LIMIT 1',
            [':id' => $pinId],
            $this->slowQueryLogger
        );

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? CustomPinRecord::fromRow($row) : null;
    }

    public function create(
        string $id,
        string $userId,
        string $title,
        ?string $notes,
        float $coordX,
        float $coordY,
        string $colorHex,
    ): CustomPinRecord {
        Connection::executeTimed(
            $this->getPdo(),
            'INSERT INTO user_custom_pins (id, user_id, title, notes, coord_x, coord_y, color_hex) VALUES (:id, :user_id, :title, :notes, :coord_x, :coord_y, :color_hex)',
            [
                ':id' => $id,
                ':user_id' => $userId,
                ':title' => $title,
                ':notes' => $notes,
                ':coord_x' => $coordX,
                ':coord_y' => $coordY,
                ':color_hex' => strtoupper($colorHex),
            ],
            $this->slowQueryLogger
        );

        $created = $this->findById($id);
        if ($created === null) {
            throw new RuntimeException('Failed to reload created custom pin.');
        }

        return $created;
    }

    public function deleteByIdForUser(string $pinId, string $userId): bool
    {
        $stmt = Connection::executeTimed(
            $this->getPdo(),
            'DELETE FROM user_custom_pins WHERE id = :id AND user_id = :user_id',
            [
                ':id' => $pinId,
                ':user_id' => $userId,
            ],
            $this->slowQueryLogger
        );

        return $stmt->rowCount() > 0;
    }

    private function getPdo(): PDO
    {
        if ($this->pdo === null) {
            $this->pdo = ($this->pdoFactory)();
        }

        return $this->pdo;
    }
}
