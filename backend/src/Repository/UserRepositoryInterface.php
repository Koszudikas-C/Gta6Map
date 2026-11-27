<?php

declare(strict_types=1);

namespace App\Repository;

/**
 * Persistence contract for user accounts, referrals, and profile data.
 */
interface UserRepositoryInterface
{
    public function findByGoogleId(string $googleId): ?UserRecord;

    public function findById(string $id): ?UserRecord;

    public function findByReferralCode(string $referralCode): ?UserRecord;

    public function countReferrals(string $userId): int;

    public function createWithReferralCode(
        string $id,
        string $googleId,
        string $name,
        string $email,
        ?string $avatarUrl,
        string $referralCode,
        ?string $referredByUserId,
    ): UserRecord;

    public function updateGoogleIdentity(
        string $id,
        string $name,
        string $email,
        ?string $avatarUrl,
    ): UserRecord;

    public function updateProfile(string $id, ?string $psnId): ?UserRecord;
}
