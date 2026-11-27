<?php

declare(strict_types=1);

namespace Tests\Http;

use App\Auth\AuthenticatedUser;
use App\Http\Controller\ProfileController;
use App\Http\Request;
use App\Repository\UserRecord;
use App\Repository\UserRepositoryInterface;
use PHPUnit\Framework\TestCase;

final class ProfileControllerTest extends TestCase
{
    public function testGetMeReturnsProfileWithReferralCodeAndReferralCount(): void
    {
        $repo = $this->createRepoWithUser(new UserRecord(
            id: 'user-1',
            googleId: 'g-1',
            name: 'Lucas Mendes',
            email: 'lucas@leonida.com.br',
            avatarUrl: 'https://example.com/a.png',
            psnId: 'LucasVice_BR',
            hasCpf: true,
            role: 'USER',
            isVip: true,
            referralCode: 'LEOLUCAS',
            referredByUserId: null,
            createdAt: '2026-11-27 00:00:00',
        ), referralsCount: 3);

        $controller = new ProfileController($repo);
        $request = (new Request('GET', '/api/me', requestId: 'req-me-1'))
            ->withAuthenticatedUser(new AuthenticatedUser('user-1', 'USER', true));

        $response = $controller->getMe($request);
        $data = $response->getData();

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('LEOLUCAS', $data['user']['referral_code']);
        self::assertSame(3, $data['user']['referrals_count']);
        self::assertTrue($data['user']['has_cpf']);
        self::assertArrayNotHasKey('cpf', $data['user']);
    }

    public function testPatchMeSanitizesAndUpdatesPsnIdAndRejectsInvalidInput(): void
    {
        $repo = $this->createRepoWithUser(new UserRecord(
            id: 'user-1',
            googleId: 'g-1',
            name: 'Lucas Mendes',
            email: 'lucas@leonida.com.br',
            avatarUrl: null,
            psnId: null,
            hasCpf: false,
            role: 'USER',
            isVip: false,
            referralCode: 'LEOLUCAS',
            referredByUserId: null,
            createdAt: '2026-11-27 00:00:00',
        ), referralsCount: 0);

        $controller = new ProfileController($repo);
        $auth = new AuthenticatedUser('user-1', 'USER', false);

        $validRequest = (new Request(
            'PATCH',
            '/api/me',
            rawBody: '{"psn_id":"  <b>Jason_Vice6</b>  "}',
            requestId: 'req-me-2'
        ))->withAuthenticatedUser($auth);

        $validResponse = $controller->updateMe($validRequest);
        self::assertSame(200, $validResponse->getStatusCode());
        self::assertSame('Jason_Vice6', $validResponse->getData()['user']['psn_id']);

        $invalidChars = (new Request(
            'PATCH',
            '/api/me',
            rawBody: '{"psn_id":"bad$handle;drop"}',
            requestId: 'req-me-3'
        ))->withAuthenticatedUser($auth);

        $invalidResponse = $controller->updateMe($invalidChars);
        self::assertSame(422, $invalidResponse->getStatusCode());

        $clearRequest = (new Request(
            'PATCH',
            '/api/me',
            rawBody: '{"psn_id":""}',
            requestId: 'req-me-4'
        ))->withAuthenticatedUser($auth);

        $clearResponse = $controller->updateMe($clearRequest);
        self::assertSame(200, $clearResponse->getStatusCode());
        self::assertNull($clearResponse->getData()['user']['psn_id']);
    }

    private function createRepoWithUser(UserRecord $user, int $referralsCount): UserRepositoryInterface
    {
        return new class ($user, $referralsCount) implements UserRepositoryInterface {
            private UserRecord $user;

            public function __construct(UserRecord $user, private readonly int $referralsCount)
            {
                $this->user = $user;
            }

            public function findByGoogleId(string $googleId): ?UserRecord
            {
                return $this->user->googleId === $googleId ? $this->user : null;
            }

            public function findById(string $id): ?UserRecord
            {
                return $this->user->id === $id ? $this->user : null;
            }

            public function findByReferralCode(string $referralCode): ?UserRecord
            {
                return $this->user->referralCode === strtoupper($referralCode) ? $this->user : null;
            }

            public function countReferrals(string $userId): int
            {
                return $this->user->id === $userId ? $this->referralsCount : 0;
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
                return $this->user;
            }

            public function updateGoogleIdentity(string $id, string $name, string $email, ?string $avatarUrl): UserRecord
            {
                return $this->user;
            }

            public function updateProfile(string $id, ?string $psnId): ?UserRecord
            {
                if ($this->user->id !== $id) {
                    return null;
                }

                $this->user = new UserRecord(
                    id: $this->user->id,
                    googleId: $this->user->googleId,
                    name: $this->user->name,
                    email: $this->user->email,
                    avatarUrl: $this->user->avatarUrl,
                    psnId: $psnId,
                    hasCpf: $this->user->hasCpf,
                    role: $this->user->role,
                    isVip: $this->user->isVip,
                    referralCode: $this->user->referralCode,
                    referredByUserId: $this->user->referredByUserId,
                    createdAt: $this->user->createdAt,
                );

                return $this->user;
            }
        };
    }
}
