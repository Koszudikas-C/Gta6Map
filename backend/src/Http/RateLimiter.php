<?php

declare(strict_types=1);

namespace App\Http;

use Closure;
use JsonException;
use Psr\Log\LoggerInterface;

/**
 * Lightweight file-backed fixed-window rate limiter (LOCK_EX) for shared hosting.
 */
final class RateLimiter
{
    /** @var Closure(): int */
    private readonly Closure $clock;

    /**
     * @param (Closure(): int)|null $clock
     */
    public function __construct(
        private readonly string $storageDirectory,
        private readonly ?LoggerInterface $securityLogger = null,
        ?Closure $clock = null,
    ) {
        $this->clock = $clock ?? static fn (): int => time();
    }

    /**
     * Enforce a per-IP rate limit for a named bucket before invoking $next.
     *
     * @param callable(Request): ResponseInterface $next
     */
    public function limit(
        Request $request,
        string $bucket,
        int $maxRequests,
        int $windowSeconds,
        callable $next,
    ): ResponseInterface {
        $this->ensureDirectory();
        $now = ($this->clock)();
        $filePath = $this->bucketFilePath($bucket, $request->getClientIp());

        $handle = @fopen($filePath, 'c+');
        if ($handle === false) {
            return $next($request);
        }

        $allowed = true;
        $remaining = $maxRequests;
        $resetAt = $now + $windowSeconds;
        $retryAfter = 0;

        try {
            if (!flock($handle, LOCK_EX)) {
                return $next($request);
            }

            $state = $this->readState($handle, $now, $windowSeconds);
            $resetAt = $state['window_start'] + $windowSeconds;

            if ($state['count'] >= $maxRequests) {
                $allowed = false;
                $remaining = 0;
                $retryAfter = max(1, $resetAt - $now);
            } else {
                $newCount = $state['count'] + 1;
                $remaining = max(0, $maxRequests - $newCount);
                $this->writeState($handle, $state['window_start'], $newCount);
            }
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }

        if ($now % 100 === 0) {
            $this->cleanupExpired($windowSeconds, $now);
        }

        if (!$allowed) {
            $this->securityLogger?->warning('Rate limit exceeded', [
                'bucket' => $bucket,
                'client_ip' => $request->getClientIp(),
                'limit' => $maxRequests,
                'window_seconds' => $windowSeconds,
                'retry_after' => $retryAfter,
                'path' => $request->getPath(),
                'request_id' => $request->getRequestId(),
            ]);

            return (new JsonResponse(429, [
                'error' => 'Too Many Requests',
                'message' => 'Rate limit exceeded. Please retry later.',
                'retry_after' => $retryAfter,
                'request_id' => $request->getRequestId(),
            ]))
                ->withHeader('Retry-After', (string) $retryAfter)
                ->withHeader('X-RateLimit-Limit', (string) $maxRequests)
                ->withHeader('X-RateLimit-Remaining', '0')
                ->withHeader('X-RateLimit-Reset', (string) $resetAt);
        }

        return $next($request)
            ->withHeader('X-RateLimit-Limit', (string) $maxRequests)
            ->withHeader('X-RateLimit-Remaining', (string) $remaining)
            ->withHeader('X-RateLimit-Reset', (string) $resetAt);
    }

    /**
     * Remove expired rate-limit files whose modification time exceeds maxAgeSeconds.
     */
    public function cleanupExpired(int $maxAgeSeconds, ?int $now = null): int
    {
        if (!is_dir($this->storageDirectory)) {
            return 0;
        }

        $currentTime = $now ?? ($this->clock)();
        $files = glob(rtrim($this->storageDirectory, '/\\') . DIRECTORY_SEPARATOR . '*.json');
        if ($files === false) {
            return 0;
        }

        $removed = 0;
        foreach ($files as $file) {
            $mtime = @filemtime($file);
            if ($mtime !== false && ($currentTime - $mtime) > $maxAgeSeconds) {
                if (@unlink($file)) {
                    $removed++;
                }
            }
        }

        return $removed;
    }

    private function ensureDirectory(): void
    {
        if (!is_dir($this->storageDirectory)) {
            @mkdir($this->storageDirectory, 0750, true);
        }
    }

    private function bucketFilePath(string $bucket, string $clientIp): string
    {
        $key = hash('sha256', $bucket . '|' . $clientIp);

        return rtrim($this->storageDirectory, '/\\') . DIRECTORY_SEPARATOR . $key . '.json';
    }

    /**
     * @param resource $handle
     * @return array{window_start: int, count: int}
     */
    private function readState($handle, int $now, int $windowSeconds): array
    {
        rewind($handle);
        $raw = stream_get_contents($handle);
        if (!is_string($raw) || trim($raw) === '') {
            return ['window_start' => $now, 'count' => 0];
        }

        try {
            $decoded = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return ['window_start' => $now, 'count' => 0];
        }

        if (
            !is_array($decoded)
            || !isset($decoded['window_start'], $decoded['count'])
            || !is_int($decoded['window_start'])
            || !is_int($decoded['count'])
        ) {
            return ['window_start' => $now, 'count' => 0];
        }

        if (($now - $decoded['window_start']) >= $windowSeconds) {
            return ['window_start' => $now, 'count' => 0];
        }

        return [
            'window_start' => $decoded['window_start'],
            'count' => max(0, $decoded['count']),
        ];
    }

    /**
     * @param resource $handle
     */
    private function writeState($handle, int $windowStart, int $count): void
    {
        $encoded = json_encode([
            'window_start' => $windowStart,
            'count' => $count,
        ], JSON_THROW_ON_ERROR);

        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, $encoded);
        fflush($handle);
    }
}
