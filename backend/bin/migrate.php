#!/usr/bin/env php
<?php

declare(strict_types=1);

use App\Config\Env;
use App\Database\Connection;
use App\Database\MigrationRunner;

$backendRoot = dirname(__DIR__);
$repoRoot = dirname($backendRoot);

require_once $backendRoot . '/vendor/autoload.php';

$options = getopt('', ['migrations-only', 'seeds-only', 'dry-run', 'help']);
if (isset($options['help'])) {
    echo "Usage: php bin/migrate.php [--migrations-only] [--seeds-only] [--dry-run]\n";
    exit(0);
}

$migrationsOnly = isset($options['migrations-only']);
$seedsOnly = isset($options['seeds-only']);
$dryRun = isset($options['dry-run']);

$env = Env::load($backendRoot . '/.env');

try {
    $pdo = Connection::create($env);
    $runner = new MigrationRunner($pdo);
    $runner->ensureMigrationsTable();

    $appliedMigrations = [];
    $appliedSeeds = [];

    if (!$seedsOnly) {
        $appliedMigrations = $runner->runDirectory(
            $repoRoot . '/database/migrations',
            'migration',
            $dryRun
        );
    }

    if (!$migrationsOnly) {
        $appliedSeeds = $runner->runDirectory(
            $repoRoot . '/database/seeds',
            'seed',
            $dryRun
        );
    }

    $prefix = $dryRun ? '[DRY-RUN] Pending' : 'Applied';
    echo sprintf(
        "%s: %d migration(s), %d seed(s).\n",
        $prefix,
        count($appliedMigrations),
        count($appliedSeeds)
    );

    foreach ($appliedMigrations as $file) {
        echo "  [migration] {$file}\n";
    }
    foreach ($appliedSeeds as $file) {
        echo "  [seed]      {$file}\n";
    }
} catch (Throwable $e) {
    fwrite(STDERR, sprintf("Migration failed: %s\n", $e->getMessage()));
    exit(1);
}
