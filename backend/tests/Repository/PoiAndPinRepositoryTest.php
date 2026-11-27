<?php

declare(strict_types=1);

namespace Tests\Repository;

use App\Repository\CustomPinRepository;
use App\Repository\PoiRepository;
use App\Repository\ProgressRepository;
use PDO;
use PDOStatement;
use PHPUnit\Framework\TestCase;

final class PoiAndPinRepositoryTest extends TestCase
{
    public function testPoiRepositoryQueriesPublishedPoisWithPreparedStatements(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->expects(self::once())->method('execute')->with([':status' => 'PUBLISHED']);
        $stmt->method('fetch')->willReturnOnConsecutiveCalls([
            'id' => 1,
            'category_id' => 2,
            'category_slug' => 'collectibles',
            'category_name' => 'Colecionáveis',
            'title' => 'Golden Flamingo',
            'description' => 'Near Starfish Island',
            'coord_x' => -80.15,
            'coord_y' => 25.77,
            'image_url' => null,
            'panorama_url' => null,
            'metadata' => '{"region":"Starfish Island"}',
            'status' => 'PUBLISHED',
            'created_at' => '2026-11-27 00:00:00',
            'updated_at' => '2026-11-27 00:00:00',
        ], false);

        $pdo = $this->createMock(PDO::class);
        $pdo->expects(self::once())
            ->method('prepare')
            ->with(self::stringContains('WHERE p.status = :status'))
            ->willReturn($stmt);

        $repo = new PoiRepository(static fn (): PDO => $pdo);
        $pois = $repo->findAllPublishedPois();

        self::assertCount(1, $pois);
        self::assertSame('Starfish Island', $pois[0]->metadata['region']);
    }

    public function testProgressRepositoryReadsAndSyncsInTransaction(): void
    {
        $selectStmt = $this->createMock(PDOStatement::class);
        $selectStmt->expects(self::once())
            ->method('execute')
            ->with([':user_id' => 'u-1', ':save_slot' => 'default']);
        $selectStmt->method('fetchColumn')->willReturnOnConsecutiveCalls(10, 25, false);

        $pdo = $this->createMock(PDO::class);
        $pdo->expects(self::once())->method('prepare')->willReturn($selectStmt);

        $repo = new ProgressRepository(static fn (): PDO => $pdo);
        self::assertSame([10, 25], $repo->findPoiIdsByUserAndSlot('u-1', 'default'));
    }

    public function testCustomPinRepositoryDeletesOnlyOwnedPin(): void
    {
        $stmt = $this->createMock(PDOStatement::class);
        $stmt->expects(self::once())
            ->method('execute')
            ->with([':id' => 'pin-1', ':user_id' => 'u-1']);
        $stmt->method('rowCount')->willReturn(1);

        $pdo = $this->createMock(PDO::class);
        $pdo->expects(self::once())
            ->method('prepare')
            ->with(self::stringContains('DELETE FROM user_custom_pins WHERE id = :id AND user_id = :user_id'))
            ->willReturn($stmt);

        $repo = new CustomPinRepository(static fn (): PDO => $pdo);
        self::assertTrue($repo->deleteByIdForUser('pin-1', 'u-1'));
    }
}
