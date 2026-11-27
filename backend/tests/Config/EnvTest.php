<?php

declare(strict_types=1);

namespace Tests\Config;

use App\Config\Env;
use PHPUnit\Framework\TestCase;

final class EnvTest extends TestCase
{
    public function testLoadsDotEnvFileAndParsesTypedValues(): void
    {
        $tmpFile = sys_get_temp_dir() . '/gta6map_env_' . uniqid('', true) . '.env';
        file_put_contents($tmpFile, implode("\n", [
            '# Comment line',
            'APP_ENV=production',
            'APP_DEBUG="false"',
            "export DB_NAME='gta6map_prod'",
            'DB_PORT=3307 # inline comment',
            'SLOW_THRESHOLD=200.5',
        ]));

        try {
            $env = Env::load($tmpFile);
            self::assertSame('production', $env->getString('APP_ENV'));
            self::assertTrue($env->isProduction());
            self::assertFalse($env->isDebug());
            self::assertSame('gta6map_prod', $env->getString('DB_NAME'));
            self::assertSame(3307, $env->getInt('DB_PORT'));
            self::assertSame(200.5, $env->getFloat('SLOW_THRESHOLD'));
            self::assertSame('fallback', $env->getString('MISSING_KEY', 'fallback'));
        } finally {
            @unlink($tmpFile);
        }
    }

    public function testFromArrayHandlesDefaultsAndBooleans(): void
    {
        $env = Env::fromArray([
            'APP_ENV' => 'local',
            'APP_DEBUG' => '1',
            'INVALID_INT' => 'abc',
        ]);

        self::assertFalse($env->isProduction());
        self::assertTrue($env->isDebug());
        self::assertSame(3306, $env->getInt('INVALID_INT', 3306));
    }
}
