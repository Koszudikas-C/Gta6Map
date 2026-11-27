<?php

declare(strict_types=1);

namespace App\Service;

use App\Auth\GoogleTokenPayload;
use App\Auth\GoogleTokenVerifierInterface;
use App\Auth\JwtService;
use App\Http\RequestIdGenerator;
use App\Repository\UserRecord;
use App\Repository\UserRepositoryInterface;

/**
 * Coordinates Google OAuth login, unique referral code generation, anti-self-referral, and JWT issuance.
 */
final class AuthService
{
    public function __construct(
        private readonly GoogleTokenVerifierInterface $googleVerifier,
        private readonly JwtService $jwtService,
        private readonly UserRepositoryInterface $users,
        private readonly ReferralCodeGenerator $referralGenerator = new ReferralCodeGenerator(),
    ) {
    }

    /**
     * @return array{token: string, expires_in: int, user: UserRecord}
     */
    public function authenticateWithGoogle(string $idToken, ?string $referralCode = null): array
    {
        $googlePayload = $this->googleVerifier->verify($idToken);
        $existingUser = $this->users->findByGoogleId($googlePayload->googleId);

        if ($existingUser !== null) {
            $user = $this->users->updateGoogleIdentity(
                $existingUser->id,
                $googlePayload->name,
                $googlePayload->email,
                $googlePayload->avatarUrl,
            );
        } else {
            $newUserId = RequestIdGenerator::generateUuidV4();
            $referredByUserId = $this->resolveReferrerId($referralCode, $newUserId, $googlePayload);
            $generatedCode = $this->referralGenerator->generateUnique($this->users);

            $user = $this->users->createWithReferralCode(
                id: $newUserId,
                googleId: $googlePayload->googleId,
                name: $googlePayload->name,
                email: $googlePayload->email,
                avatarUrl: $googlePayload->avatarUrl,
                referralCode: $generatedCode,
                referredByUserId: $referredByUserId,
            );
        }

        $jwt = $this->jwtService->issue($user->id, $user->role, $user->isVip);

        return [
            'token' => $jwt,
            'expires_in' => $this->jwtService->getTtlSeconds(),
            'user' => $user,
        ];
    }

    private function resolveReferrerId(
        ?string $referralCode,
        string $newUserId,
        GoogleTokenPayload $googlePayload,
    ): ?string {
        if ($referralCode === null) {
            return null;
        }

        $normalized = strtoupper(trim($referralCode));
        if ($normalized === '' || preg_match('/^[A-Z0-9\-]{4,20}$/', $normalized) !== 1) {
            return null;
        }

        $referrer = $this->users->findByReferralCode($normalized);
        if ($referrer === null) {
            return null;
        }

        if (
            $referrer->id === $newUserId
            || $referrer->googleId === $googlePayload->googleId
            || strtolower($referrer->email) === strtolower($googlePayload->email)
        ) {
            return null;
        }

        return $referrer->id;
    }
}
