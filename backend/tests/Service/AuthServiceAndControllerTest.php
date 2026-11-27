<?php

declare(strict_types=1);

namespace Tests\Service;

use App\Auth\GoogleTokenPayload;
use App\Auth\GoogleTokenVerifierInterface;
use App\Auth\InvalidTokenException;
use App\Auth\JwtService;
use App\Http\Controller\AuthController;
use App\Http\Request;
use App\Repository\UserRecord;
use App\Repository\UserRepositoryInterface;
use App\Service\AuthService;
use PHPUnit\Framework\TestCase;

final class AuthServiceAndControllerTest extends TestCase
{
    private const JWT_SECRET = 'test_super_secret_jwt_key_32_chars_min';

    public function testCreatesNewUserWithUniqueReferralCodeAndLinksValidReferrer(): void
    {
        $repo = $this->createInMemoryRepo([
            new UserRecord(
                id: 'referrer-uuid-1',
                googleId: 'g-ref-1',
                name: 'Lucia Caminos',
                email: 'lucia@leonida.com.br',
                avatarUrl: null,
                psnId: 'Lucia_BR',
                hasCpf: true,
                role: 'USER',
                isVip: true,
                referralCode: 'LEOREF99',
                referredByUserId: null,
                createdAt: '2026-11-27 00:00:00',
            ),
        ]);

        $verifier = new class () implements GoogleTokenVerifierInterface {
            public function verify(string $idToken): GoogleTokenPayload
            {
                return new GoogleTokenPayload(
                    googleId: 'g-new-2',
                    email: 'jason@leonida.com.br',
                    name: 'Jason Duval',
                    avatarUrl: 'https://example.com/jason.png',
                );
            }
        };

        $jwt = new JwtService(self::JWT_SECRET, 3600);
        $service = new AuthService($verifier, $jwt, $repo);
        $controller = new AuthController($service, $repo);

        $request = new Request(
            method: 'POST',
            path: '/api/auth/google',
            rawBody: '{"id_token":"valid.google.jwt","ref":"leoref99"}',
            requestId: 'req-google-1',
        );

        $response = $controller->googleLogin($request);
        $data = $response->getData();

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('Bearer', $data['token_type']);
        self::assertIsString($data['token']);
        self::assertSame('referrer-uuid-1', $data['user']['referred_by_user_id']);
        self::assertMatchesRegularExpression('/^LEO[A-Z0-9]{5}$/', $data['user']['referral_code']);
        self::assertSame(0, $data['user']['referrals_count']);

        $authed = $jwt->verify($data['token']);
        self::assertSame($data['user']['id'], $authed->userId);
    }

    public function testPreventsSelfReferralOnSignup(): void
    {
        $repo = $this->createInMemoryRepo([
            new UserRecord(
                id: 'existing-uuid-1',
                googleId: 'g-other',
                name: 'Same Email Account',
                email: 'player@leonida.com.br',
                avatarUrl: null,
                psnId: null,
                hasCpf: false,
                role: 'USER',
                isVip: false,
                referralCode: 'LEOSELF1',
                referredByUserId: null,
                createdAt: '2026-11-27 00:00:00',
            ),
        ]);

        $verifier = new class () implements GoogleTokenVerifierInterface {
            public function verify(string $idToken): GoogleTokenPayload
            {
                return new GoogleTokenPayload(
                    googleId: 'g-brand-new',
                    email: 'PLAYER@leonida.com.br',
                    name: 'Player',
                    avatarUrl: null,
                );
            }
        };

        $service = new AuthService($verifier, new JwtService(self::JWT_SECRET, 3600), $repo);
        $result = $service->authenticateWithGoogle('valid.token.here', 'LEOSELF1');

        self::assertNull($result['user']->referredByUserId);
    }

    public function testReturns401OnInvalidGoogleTokenAnd422WhenMissingIdToken(): void
    {
        $repo = $this->createInMemoryRepo([]);
        $verifier = new class () implements GoogleTokenVerifierInterface {
            public function verify(string $idToken): GoogleTokenPayload
            {
                throw new InvalidTokenException('Bad Google token');
            }
        };

        $controller = new AuthController(
            new AuthService($verifier, new JwtService(self::JWT_SECRET, 3600), $repo),
            $repo
        );

        $missing = $controller->googleLogin(new Request('POST', '/api/auth/google', rawBody: '{}', requestId: 'req-1'));
        self::assertSame(422, $missing->getStatusCode());

        $unauthorized = $controller->googleLogin(new Request(
            'POST',
            '/api/auth/google',
            rawBody: '{"id_token":"bad.token.here"}',
            requestId: 'req-2'
        ));
        self::assertSame(401, $unauthorized->getStatusCode());
    }

    /**
     * @param list<UserRecord> $seedUsers
     */
    private function createInMemoryRepo(array $seedUsers): UserRepositoryInterface
    {
        return new class ($seedUsers) implements UserRepositoryInterface {
            /** @var array<string, UserRecord> */
            private array $byId = [];

            /**
             * @param list<UserRecord> $seedUsers
             */
            public function __construct(array $seedUsers)
            {
                foreach ($seedUsers as $user) {
                    $this->byId[$user->id] = $user;
                }
            }

            public function findByGoogleId(string $googleId): ?UserRecord
            {
                foreach ($this->byId as $user) {
                    if ($user->googleId === $googleId) {
                        return $user;
                    }
                }

                return null;
            }

            public function findById(string $id): ?UserRecord
            {
                return $this->byId[$id] ?? null;
            }

            public function findByReferralCode(string $referralCode): ?UserRecord
            {
                $upper = strtoupper(trim($referralCode));
                foreach ($this->byId as $user) {
                    if ($user->referralCode === $upper) {
                        return $user;
                    }
                }

                return null;
            }

            public function countReferrals(string $userId): int
            {
                $count = 0;
                foreach ($this->byId as $user) {
                    if ($user->referredByUserId === $userId) {
                        $count++;
                    }
                }

                return $count;
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
                $user = new UserRecord(
                    id: $id,
                    googleId: $googleId,
                    name: $name,
                    email: $email,
                    avatarUrl: $avatarUrl,
                    psnId: null,
                    hasCpf: false,
                    role: 'USER',
                    isVip: false,
                    referralCode: strtoupper($referralCode),
                    referredByUserId: $referredByUserId,
                    createdAt: '2026-11-27 00:00:00',
                );
                $this->byId[$id] = $user;

                return $user;
            }

            public function updateGoogleIdentity(string $id, string $name, string $email, ?string $avatarUrl): UserRecord
            {
                $existing = $this->byId[$id];
                $updated = new UserRecord(
                    id: $existing->id,
                    googleId: $existing->googleId,
                    name: $name,
                    email: $email,
                    avatarUrl: $avatarUrl,
                    psnId: $existing->psnId,
                    hasCpf: $existing->hasCpf,
                    role: $existing->role,
                    isVip: $existing->isVip,
                    referralCode: $existing->referralCode,
                    referredByUserId: $existing->referredByUserId,
                    createdAt: $existing->createdAt,
                );
                $this->byId[$id] = $updated;

                return $updated;
            }

            public function updateProfile(string $id, ?string $psnId): ?UserRecord
            {
                $existing = $this->byId[$id] ?? null;
                if ($existing === null) {
                    return null;
                }

                $updated = new UserRecord(
                    id: $existing->id,
                    googleId: $existing->googleId,
                    name: $existing->name,
                    email: $existing->email,
                    avatarUrl: $existing->avatarUrl,
                    psnId: $psnId,
                    hasCpf: $existing->hasCpf,
                    role: $existing->role,
                    isVip: $existing->isVip,
                    referralCode: $existing->referralCode,
                    referredByUserId: $existing->referredByUserId,
                    createdAt: $existing->createdAt,
                );
                $this->byId[$id] = $updated;

                return $updated;
            }
        };
    }
}
