<?php

declare(strict_types=1);

namespace Tests\Repository;

use App\Repository\UserRepository;
use PDO;
use PDOStatement;
use PHPUnit\Framework\TestCase;

final class UserRepositoryTest extends TestCase
{
    public function testUsesPreparedStatementsForLookupAndProfileUpdate(): void
    {
        $selectStmt = $this->createMock(PDOStatement::class);
        $selectStmt->expects(self::once())
            ->method('execute')
            ->with([':referral_code' => 'LEO7X9K2']);
        $selectStmt->method('fetch')->willReturn([
            'id' => 'uuid-1',
            'google_id' => 'g-1',
            'name' => 'Jason',
            'email' => 'jason@leonida.com.br',
            'avatar_url' => null,
            'psn_id' => 'JasonPSN',
            'cpf' => '123.456.789-01',
            'role' => 'USER',
            'is_vip' => 1,
            'referral_code' => 'LEO7X9K2',
            'referred_by_user_id' => null,
            'created_at' => '2026-11-27 00:00:00',
        ]);

        $pdo = $this->createMock(PDO::class);
        $pdo->expects(self::once())
            ->method('prepare')
            ->with(self::stringContains('WHERE referral_code = :referral_code'))
            ->willReturn($selectStmt);

        $repo = new UserRepository(static fn (): PDO => $pdo);
        $found = $repo->findByReferralCode(' leo7x9k2 ');

        self::assertNotNull($found);
        self::assertSame('uuid-1', $found->id);
        self::assertTrue($found->isVip);
        self::assertTrue($found->hasCpf);
    }

    public function testCountReferralsExecutesPreparedCountQuery(): void
    {
        $countStmt = $this->createMock(PDOStatement::class);
        $countStmt->expects(self::once())
            ->method('execute')
            ->with([':user_id' => 'uuid-1']);
        $countStmt->method('fetchColumn')->willReturn('4');

        $pdo = $this->createMock(PDO::class);
        $pdo->expects(self::once())
            ->method('prepare')
            ->with(self::stringContains('SELECT COUNT(*) FROM users WHERE referred_by_user_id = :user_id'))
            ->willReturn($countStmt);

        $repo = new UserRepository(static fn (): PDO => $pdo);
        self::assertSame(4, $repo->countReferrals('uuid-1'));
    }
}
