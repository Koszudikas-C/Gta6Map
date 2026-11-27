<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Common HTTP response contract for JSON and HTML responses.
 */
interface ResponseInterface
{
    public const SECURITY_HEADERS = [
        'X-Content-Type-Options' => 'nosniff',
        'X-Frame-Options' => 'DENY',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
    ];

    public function getStatusCode(): int;

    /**
     * @return array<string, string>
     */
    public function getHeaders(): array;

    public function withHeader(string $name, string $value): self;

    public function emit(): void;
}
