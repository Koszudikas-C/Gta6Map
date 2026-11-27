<?php

declare(strict_types=1);

namespace App\Auth;

/**
 * Contract for verifying Google Identity Services ID tokens.
 */
interface GoogleTokenVerifierInterface
{
    /**
     * @throws InvalidTokenException
     */
    public function verify(string $idToken): GoogleTokenPayload;
}
