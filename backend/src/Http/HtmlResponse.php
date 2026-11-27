<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Immutable HTML HTTP response for dynamic OpenGraph / SEO social bot rendering.
 */
final class HtmlResponse implements ResponseInterface
{
    /**
     * @param array<string, string> $headers
     */
    public function __construct(
        private readonly int $statusCode,
        private readonly string $html,
        private readonly array $headers = [],
    ) {
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getBody(): string
    {
        return $this->html;
    }

    /**
     * @return array<string, string>
     */
    public function getHeaders(): array
    {
        return $this->headers;
    }

    public function withHeader(string $name, string $value): self
    {
        $headers = $this->headers;
        $headers[$name] = $value;

        return new self($this->statusCode, $this->html, $headers);
    }

    public function emit(): void
    {
        http_response_code($this->statusCode);
        header('Content-Type: text/html; charset=utf-8');

        $mergedHeaders = array_merge(self::SECURITY_HEADERS, $this->headers);
        foreach ($mergedHeaders as $name => $value) {
            header(sprintf('%s: %s', $name, $value));
        }

        if ($this->statusCode !== 204) {
            echo $this->html;
        }
    }
}
