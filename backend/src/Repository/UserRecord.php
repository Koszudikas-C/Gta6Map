<?php

declare(strict_types=1);

namespace App\Repository;

/**
 * Immutable representation of a persisted user row without exposing raw sensitive fields.
 */
final readonly class UserRecord
{
    public function __construct(
        public string $id,
        public string $googleId,
        public string $name,
        public string $email,
        public ?string $avatarUrl,
        public ?string $psnId,
        public bool $hasCpf,
        public string $role,
        public bool $isVip,
        public string $referralCode,
        public ?string $referredByUserId,
        public string $createdAt,
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromRow(array $row): self
    {
        $cpf = $row['cpf'] ?? null;

        return new self(
            id: (string) ($row['id'] ?? ''),
            googleId: (string) ($row['google_id'] ?? ''),
            name: (string) ($row['name'] ?? ''),
            email: (string) ($row['email'] ?? ''),
            avatarUrl: isset($row['avatar_url']) && is_string($row['avatar_url']) ? $row['avatar_url'] : null,
            psnId: isset($row['psn_id']) && is_string($row['psn_id']) ? $row['psn_id'] : null,
            hasCpf: is_string($cpf) && trim($cpf) !== '',
            role: (string) ($row['role'] ?? 'USER'),
            isVip: (bool) ((int) ($row['is_vip'] ?? 0)),
            referralCode: (string) ($row['referral_code'] ?? ''),
            referredByUserId: isset($row['referred_by_user_id']) && is_string($row['referred_by_user_id'])
                ? $row['referred_by_user_id']
                : null,
            createdAt: (string) ($row['created_at'] ?? ''),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toPublicArray(?int $referralsCount = null): array
    {
        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatarUrl,
            'psn_id' => $this->psnId,
            'has_cpf' => $this->hasCpf,
            'role' => $this->role,
            'is_vip' => $this->isVip,
            'referral_code' => $this->referralCode,
            'referred_by_user_id' => $this->referredByUserId,
            'created_at' => $this->createdAt,
        ];

        if ($referralsCount !== null) {
            $data['referrals_count'] = $referralsCount;
        }

        return $data;
    }
}
