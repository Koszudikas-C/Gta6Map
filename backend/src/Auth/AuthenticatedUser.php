<?php

declare(strict_types=1);

namespace App\Auth;

/**
 * Authenticated principal extracted from a verified JWT access token.
 */
final readonly class AuthenticatedUser
{
    public function __construct(
        public string $userId,
        public string $role,
        public bool $isVip,
    ) {
    }
}
