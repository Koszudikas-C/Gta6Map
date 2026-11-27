<?php

declare(strict_types=1);

namespace App\Service;

use App\Repository\UserRepositoryInterface;
use RuntimeException;

/**
 * Generates collision-free uppercase referral codes (e.g., LEO7X9K2).
 */
final class ReferralCodeGenerator
{
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    private const PREFIX = 'LEO';
    private const RANDOM_LENGTH = 5;
    private const MAX_ATTEMPTS = 12;

    public function generateUnique(UserRepositoryInterface $users): string
    {
        for ($attempt = 0; $attempt < self::MAX_ATTEMPTS; $attempt++) {
            $candidate = $this->generateCandidate();
            if ($users->findByReferralCode($candidate) === null) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate unique referral code.');
    }

    public function generateCandidate(): string
    {
        $maxIndex = strlen(self::ALPHABET) - 1;
        $suffix = '';
        for ($i = 0; $i < self::RANDOM_LENGTH; $i++) {
            $suffix .= self::ALPHABET[random_int(0, $maxIndex)];
        }

        return self::PREFIX . $suffix;
    }
}
