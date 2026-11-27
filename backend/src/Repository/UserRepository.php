<?php

declare(strict_types=1);

namespace App\Repository;

use App\Database\Connection;
use Closure;
use PDO;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * PDO_MYSQL user repository using exclusive native prepared statements.
 */
final class UserRepository implements UserRepositoryInterface
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

    public function findByGoogleId(string $googleId): ?UserRecord
    {
        $stmt = Connection::executeTimed(
            $this->getPdo(),
            'SELECT id, google_id, name, email, avatar_url, psn_id, cpf, role, is_vip, referral_code, referred_by_user_id, created_at FROM users WHERE google_id = :google_id LIMIT 1',
            [':google_id' => $googleId],
            $this->slowQueryLogger
        );

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? UserRecord::fromRow($row) : null;
    }

    public function findById(string $id): ?UserRecord
    {
        $stmt = Connection::executeTimed(
            $this->getPdo(),
            'SELECT id, google_id, name, email, avatar_url, psn_id, cpf, role, is_vip, referral_code, referred_by_user_id, created_at FROM users WHERE id = :id LIMIT 1',
            [':id' => $id],
            $this->slowQueryLogger
        );

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? UserRecord::fromRow($row) : null;
    }

    public function findByReferralCode(string $referralCode): ?UserRecord
    {
        $stmt = Connection::executeTimed(
            $this->getPdo(),
            'SELECT id, google_id, name, email, avatar_url, psn_id, cpf, role, is_vip, referral_code, referred_by_user_id, created_at FROM users WHERE referral_code = :referral_code LIMIT 1',
            [':referral_code' => strtoupper(trim($referralCode))],
            $this->slowQueryLogger
        );

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? UserRecord::fromRow($row) : null;
    }

    public function countReferrals(string $userId): int
    {
        $stmt = Connection::executeTimed(
            $this->getPdo(),
            'SELECT COUNT(*) FROM users WHERE referred_by_user_id = :user_id',
            [':user_id' => $userId],
            $this->slowQueryLogger
        );

        return (int) $stmt->fetchColumn();
    }

    public function createWithReferralCode(
        string $id,
        string $googleId,
        string $name,
        string $email,
        ?string $avatarUrl,
        string $referralCode,
        ?string $referredByUserId,
    ): UserRecord {
        Connection::executeTimed(
            $this->getPdo(),
            'INSERT INTO users (id, google_id, name, email, avatar_url, role, is_vip, referral_code, referred_by_user_id) VALUES (:id, :google_id, :name, :email, :avatar_url, :role, :is_vip, :referral_code, :referred_by_user_id)',
            [
                ':id' => $id,
                ':google_id' => $googleId,
                ':name' => $name,
                ':email' => $email,
                ':avatar_url' => $avatarUrl,
                ':role' => 'USER',
                ':is_vip' => 0,
                ':referral_code' => strtoupper(trim($referralCode)),
                ':referred_by_user_id' => $referredByUserId,
            ],
            $this->slowQueryLogger
        );

        $created = $this->findById($id);
        if ($created === null) {
            throw new RuntimeException('Failed to reload created user.');
        }

        return $created;
    }

    public function updateGoogleIdentity(
        string $id,
        string $name,
        string $email,
        ?string $avatarUrl,
    ): UserRecord {
        Connection::executeTimed(
            $this->getPdo(),
            'UPDATE users SET name = :name, email = :email, avatar_url = :avatar_url WHERE id = :id',
            [
                ':id' => $id,
                ':name' => $name,
                ':email' => $email,
                ':avatar_url' => $avatarUrl,
            ],
            $this->slowQueryLogger
        );

        $updated = $this->findById($id);
        if ($updated === null) {
            throw new RuntimeException('Failed to reload updated user.');
        }

        return $updated;
    }

    public function updateProfile(string $id, ?string $psnId): ?UserRecord
    {
        Connection::executeTimed(
            $this->getPdo(),
            'UPDATE users SET psn_id = :psn_id WHERE id = :id',
            [
                ':id' => $id,
                ':psn_id' => $psnId,
            ],
            $this->slowQueryLogger
        );

        return $this->findById($id);
    }

    private function getPdo(): PDO
    {
        if ($this->pdo === null) {
            $this->pdo = ($this->pdoFactory)();
        }

        return $this->pdo;
    }
}
