<?php

declare(strict_types=1);

namespace App\Auth;

/**
 * Verified Google Identity Services ID token claims.
 */
final readonly class GoogleTokenPayload
{
    public function __construct(
        public string $googleId,
        public string $email,
        public string $name,
        public ?string $avatarUrl,
    ) {
    }
}
