#!/usr/bin/env php
<?php

declare(strict_types=1);

use App\Service\VicemapImporter;

$backendRoot = dirname(__DIR__);
$repoRoot = dirname($backendRoot);

require_once $backendRoot . '/vendor/autoload.php';

$options = getopt('', ['file::', 'help']);
if (isset($options['help'])) {
    echo "Usage: php bin/import-vicemap.php [--file=/path/to/data.json]\n";
    exit(0);
}

$sourceUrl = 'https://vicemap.online/data.json';
$localFile = isset($options['file']) && is_string($options['file']) ? trim($options['file']) : '';

try {
    if ($localFile !== '') {
        if (!is_file($localFile) || !is_readable($localFile)) {
            throw new RuntimeException(sprintf('Local file not readable: %s', $localFile));
        }
        $rawJson = file_get_contents($localFile);
        if ($rawJson === false) {
            throw new RuntimeException(sprintf('Unable to read file: %s', $localFile));
        }
    } else {
        $rawJson = fetchRemoteJson($sourceUrl);
    }

    $importer = new VicemapImporter();
    $parsed = $importer->parseJson($rawJson, gmdate('Y-m-d H:i:s'));

    $cacheFile = $backendRoot . '/storage/cache/pois.json';
    $cacheDir = dirname($cacheFile);
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0750, true);
    }

    $cacheJson = $importer->buildCacheJson($parsed['categories'], $parsed['pois'], time());
    if (file_put_contents($cacheFile, $cacheJson, LOCK_EX) === false) {
        throw new RuntimeException(sprintf('Failed to write cache file: %s', $cacheFile));
    }

    $seedFile = $repoRoot . '/database/seeds/002_vicemap_pois.sql';
    $seedDir = dirname($seedFile);
    if (!is_dir($seedDir)) {
        mkdir($seedDir, 0750, true);
    }

    $seedSql = $importer->buildSeedSql($parsed['categories'], $parsed['pois']);
    if (file_put_contents($seedFile, $seedSql, LOCK_EX) === false) {
        throw new RuntimeException(sprintf('Failed to write seed SQL: %s', $seedFile));
    }

    echo sprintf(
        "Imported %d POIs across %d categories (skipped %d items without coordinates).\nCache: %s\nSeed:  %s\n",
        count($parsed['pois']),
        count($parsed['categories']),
        $parsed['skipped_without_coords'],
        $cacheFile,
        $seedFile
    );
} catch (Throwable $e) {
    fwrite(STDERR, sprintf("Import failed: %s\n", $e->getMessage()));
    exit(1);
}

function fetchRemoteJson(string $url): string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('Failed to initialize cURL.');
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        if (!is_string($body) || $httpCode !== 200) {
            throw new RuntimeException(sprintf(
                'Failed to fetch %s (HTTP %d%s).',
                $url,
                $httpCode,
                $curlError !== '' ? ': ' . $curlError : ''
            ));
        }

        return $body;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 20,
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    if (!is_string($body) || $body === '') {
        throw new RuntimeException(sprintf('Failed to fetch %s.', $url));
    }

    return $body;
}
