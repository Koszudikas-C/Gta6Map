<?php

declare(strict_types=1);

namespace Tests\Http;

use App\Auth\AuthMiddleware;
use App\Auth\JwtService;
use App\Http\Controller\CustomPinController;
use App\Http\Controller\ProgressController;
use App\Http\Request;
use App\Http\ResponseInterface;
use App\Http\Router;
use App\Repository\CustomPinRecord;
use App\Repository\CustomPinRepositoryInterface;
use App\Repository\ProgressRepositoryInterface;
use PHPUnit\Framework\TestCase;

final class VipProgressAndCustomPinsTest extends TestCase
{
    private const JWT_SECRET = 'test_super_secret_jwt_key_32_chars_min';

    public function testBlocksNonVipUserWith403OnCloudProgressAndCustomPins(): void
    {
        $jwt = new JwtService(self::JWT_SECRET, 3600);
        $freeToken = $jwt->issue('free-user-1', 'USER', false);
        $authMiddleware = new AuthMiddleware($jwt);

        $progressController = new ProgressController($this->createProgressRepo());
        $pinController = new CustomPinController($this->createPinRepo());

        $router = new Router();
        $router->get('/api/progress', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
            $req,
            [$progressController, 'getProgress']
        ));
        $router->post('/api/custom-pins', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
            $req,
            [$pinController, 'createPin']
        ));

        $progressRes = $router->dispatch(new Request(
            'GET',
            '/api/progress',
            headers: ['authorization' => 'Bearer ' . $freeToken],
            requestId: 'req-vip-1'
        ));
        self::assertSame(403, $progressRes->getStatusCode());

        $pinRes = $router->dispatch(new Request(
            'POST',
            '/api/custom-pins',
            headers: ['authorization' => 'Bearer ' . $freeToken],
            rawBody: '{"title":"Stash","coord_x":-80.1,"coord_y":25.8}',
            requestId: 'req-vip-2'
        ));
        self::assertSame(403, $pinRes->getStatusCode());
    }

    public function testVipUserCanSyncProgressAndCrudCustomPinsWithOwnershipCheck(): void
    {
        $jwt = new JwtService(self::JWT_SECRET, 3600);
        $vipTokenA = $jwt->issue('vip-user-a', 'USER', true);
        $vipTokenB = $jwt->issue('vip-user-b', 'USER', true);
        $authMiddleware = new AuthMiddleware($jwt);

        $progressController = new ProgressController($this->createProgressRepo());
        $pinController = new CustomPinController($this->createPinRepo());

        $router = new Router();
        $router->get('/api/progress', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
            $req,
            [$progressController, 'getProgress']
        ));
        $router->put('/api/progress', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
            $req,
            [$progressController, 'syncProgress']
        ));
        $router->get('/api/custom-pins', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
            $req,
            [$pinController, 'listPins']
        ));
        $router->post('/api/custom-pins', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
            $req,
            [$pinController, 'createPin']
        ));
        $router->delete('/api/custom-pins/{id}', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
            $req,
            [$pinController, 'deletePin']
        ));

        // Sync progress (replace)
        $syncRes = $router->dispatch(new Request(
            'PUT',
            '/api/progress',
            headers: ['authorization' => 'Bearer ' . $vipTokenA],
            rawBody: '{"save_slot":"platina","poi_ids":[5,12,5]}',
            requestId: 'req-sync-1'
        ));
        self::assertSame(200, $syncRes->getStatusCode());
        self::assertSame([5, 12], $syncRes->getData()['poi_ids']);

        // Get progress
        $getRes = $router->dispatch(new Request(
            'GET',
            '/api/progress',
            headers: ['authorization' => 'Bearer ' . $vipTokenA],
            query: ['save_slot' => 'platina'],
            requestId: 'req-sync-2'
        ));
        self::assertSame(200, $getRes->getStatusCode());
        self::assertSame([5, 12], $getRes->getData()['poi_ids']);

        // Create custom pin
        $createRes = $router->dispatch(new Request(
            'POST',
            '/api/custom-pins',
            headers: ['authorization' => 'Bearer ' . $vipTokenA],
            rawBody: '{"title":"<b>Secret Boat</b>","notes":"Check at night","coord_x":-80.15,"coord_y":25.77,"color_hex":"#ff4d6d"}',
            requestId: 'req-pin-1'
        ));
        self::assertSame(201, $createRes->getStatusCode());
        $pinId = $createRes->getData()['pin']['id'];
        self::assertSame('Secret Boat', $createRes->getData()['pin']['title']);
        self::assertSame('#FF4D6D', $createRes->getData()['pin']['color_hex']);

        // User B cannot delete User A's pin -> 403
        $forbiddenDelete = $router->dispatch(new Request(
            'DELETE',
            '/api/custom-pins/' . $pinId,
            headers: ['authorization' => 'Bearer ' . $vipTokenB],
            requestId: 'req-pin-2'
        ));
        self::assertSame(403, $forbiddenDelete->getStatusCode());

        // User A deletes own pin -> 200
        $ownerDelete = $router->dispatch(new Request(
            'DELETE',
            '/api/custom-pins/' . $pinId,
            headers: ['authorization' => 'Bearer ' . $vipTokenA],
            requestId: 'req-pin-3'
        ));
        self::assertSame(200, $ownerDelete->getStatusCode());
        self::assertTrue($ownerDelete->getData()['deleted']);
    }

    private function createProgressRepo(): ProgressRepositoryInterface
    {
        return new class () implements ProgressRepositoryInterface {
            /** @var array<string, list<int>> */
            private array $slots = [];

            public function findPoiIdsByUserAndSlot(string $userId, string $saveSlot): array
            {
                return $this->slots[$userId . ':' . $saveSlot] ?? [];
            }

            public function syncProgress(string $userId, string $saveSlot, array $poiIds, bool $replace = true): array
            {
                $key = $userId . ':' . $saveSlot;
                $existing = $replace ? [] : ($this->slots[$key] ?? []);
                $merged = array_values(array_unique(array_merge($existing, $poiIds)));
                sort($merged);
                $this->slots[$key] = $merged;

                return $merged;
            }
        };
    }

    private function createPinRepo(): CustomPinRepositoryInterface
    {
        return new class () implements CustomPinRepositoryInterface {
            /** @var array<string, CustomPinRecord> */
            private array $pins = [];

            public function findByUser(string $userId): array
            {
                $result = [];
                foreach ($this->pins as $pin) {
                    if ($pin->userId === $userId) {
                        $result[] = $pin;
                    }
                }

                return $result;
            }

            public function findById(string $pinId): ?CustomPinRecord
            {
                return $this->pins[$pinId] ?? null;
            }

            public function create(
                string $id,
                string $userId,
                string $title,
                ?string $notes,
                float $coordX,
                float $coordY,
                string $colorHex,
            ): CustomPinRecord {
                $record = new CustomPinRecord(
                    id: $id,
                    userId: $userId,
                    title: $title,
                    notes: $notes,
                    coordX: $coordX,
                    coordY: $coordY,
                    colorHex: $colorHex,
                    createdAt: '2026-11-27 00:00:00',
                );
                $this->pins[$id] = $record;

                return $record;
            }

            public function deleteByIdForUser(string $pinId, string $userId): bool
            {
                if (!isset($this->pins[$pinId]) || $this->pins[$pinId]->userId !== $userId) {
                    return false;
                }
                unset($this->pins[$pinId]);

                return true;
            }
        };
    }
}
