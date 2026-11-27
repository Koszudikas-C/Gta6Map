<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Immutable JSON HTTP response value object.
 */
final class JsonResponse implements ResponseInterface
{
    public const SECURITY_HEADERS = ResponseInterface::SECURITY_HEADERS;

    /**
     * @param array<string, mixed> $data
     * @param array<string, string> $headers
     */
    public function __construct(
        private readonly int $statusCode,
        private readonly array $data,
        private readonly array $headers = [],
    ) {
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    /**
     * @return array<string, mixed>
     */
    public function getData(): array
    {
        return $this->data;
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

        return new self($this->statusCode, $this->data, $headers);
    }

    public function toJson(): string
    {
        if ($this->statusCode === 204) {
            return '';
        }

        return json_encode(
            $this->data,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );
    }

    public function emit(): void
    {
        http_response_code($this->statusCode);
        header('Content-Type: application/json; charset=utf-8');

        $mergedHeaders = array_merge(self::SECURITY_HEADERS, $this->headers);
        foreach ($mergedHeaders as $name => $value) {
            header(sprintf('%s: %s', $name, $value));
        }

        $body = $this->toJson();
        if ($body !== '') {
            echo $body;
        }
    }
}
