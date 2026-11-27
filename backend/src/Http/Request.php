<?php

declare(strict_types=1);

namespace App\Http;

use App\Auth\AuthenticatedUser;
use JsonException;

/**
 * Immutable HTTP request abstraction compatible with Apache/Nginx shared hosting and unit tests.
 */
final class Request
{
    /**
     * @param array<string, string> $headers
     * @param array<string, string> $query
     * @param array<string, string> $routeParams
     */
    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $headers = [],
        private readonly array $query = [],
        private readonly string $rawBody = '',
        private readonly string $requestId = '',
        private readonly string $clientIp = '127.0.0.1',
        private readonly ?AuthenticatedUser $authenticatedUser = null,
        private readonly array $routeParams = [],
    ) {
    }

    public static function fromGlobals(string $requestId): self
    {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $rawUri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $parsedPath = parse_url($rawUri, PHP_URL_PATH);
        $path = is_string($parsedPath) && $parsedPath !== '' ? $parsedPath : '/';

        $headers = self::extractHeadersFromServer($_SERVER);
        $query = [];
        foreach ($_GET as $key => $val) {
            if (is_string($key) && is_scalar($val)) {
                $query[$key] = (string) $val;
            }
        }

        $rawBody = file_get_contents('php://input');
        $clientIp = self::resolveClientIp($_SERVER);

        return new self(
            method: $method,
            path: self::normalizePath($path),
            headers: $headers,
            query: $query,
            rawBody: $rawBody !== false ? $rawBody : '',
            requestId: $requestId,
            clientIp: $clientIp,
        );
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function getHeader(string $name, string $default = ''): string
    {
        $lower = strtolower($name);
        foreach ($this->headers as $key => $value) {
            if (strtolower($key) === $lower) {
                return $value;
            }
        }

        return $default;
    }

    /**
     * @return array<string, string>
     */
    public function getQuery(): array
    {
        return $this->query;
    }

    public function getRawBody(): string
    {
        return $this->rawBody;
    }

    public function getRequestId(): string
    {
        return $this->requestId;
    }

    public function getClientIp(): string
    {
        return $this->clientIp;
    }

    public function getAuthenticatedUser(): ?AuthenticatedUser
    {
        return $this->authenticatedUser;
    }

    public function withAuthenticatedUser(AuthenticatedUser $user): self
    {
        return new self(
            method: $this->method,
            path: $this->path,
            headers: $this->headers,
            query: $this->query,
            rawBody: $this->rawBody,
            requestId: $this->requestId,
            clientIp: $this->clientIp,
            authenticatedUser: $user,
            routeParams: $this->routeParams,
        );
    }

    public function getRouteParam(string $name, string $default = ''): string
    {
        return $this->routeParams[$name] ?? $default;
    }

    /**
     * @param array<string, string> $routeParams
     */
    public function withRouteParams(array $routeParams): self
    {
        return new self(
            method: $this->method,
            path: $this->path,
            headers: $this->headers,
            query: $this->query,
            rawBody: $this->rawBody,
            requestId: $this->requestId,
            clientIp: $this->clientIp,
            authenticatedUser: $this->authenticatedUser,
            routeParams: $routeParams,
        );
    }

    /**
     * Decode JSON request body or return null if empty/invalid.
     *
     * @return array<mixed>|null
     */
    public function getJsonBody(): ?array
    {
        if (trim($this->rawBody) === '') {
            return null;
        }

        try {
            $decoded = json_decode($this->rawBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        return is_array($decoded) ? $decoded : null;
    }

    public static function normalizePath(string $path): string
    {
        $trimmed = '/' . trim($path, '/');

        return $trimmed === '//' ? '/' : $trimmed;
    }

    /**
     * @param array<string, mixed> $server
     * @return array<string, string>
     */
    private static function extractHeadersFromServer(array $server): array
    {
        $headers = [];
        foreach ($server as $key => $value) {
            if (!is_string($value)) {
                continue;
            }
            if (str_starts_with($key, 'HTTP_')) {
                $headerName = str_replace('_', '-', strtolower(substr($key, 5)));
                $headers[$headerName] = $value;
            } elseif ($key === 'REDIRECT_HTTP_AUTHORIZATION' && !isset($headers['authorization'])) {
                $headers['authorization'] = $value;
            } elseif (in_array($key, ['CONTENT_TYPE', 'CONTENT_LENGTH'], true)) {
                $headerName = str_replace('_', '-', strtolower($key));
                $headers[$headerName] = $value;
            }
        }

        return $headers;
    }

    /**
     * @param array<string, mixed> $server
     */
    private static function resolveClientIp(array $server): string
    {
        $remoteAddr = $server['REMOTE_ADDR'] ?? '127.0.0.1';

        return is_string($remoteAddr) && $remoteAddr !== '' ? $remoteAddr : '127.0.0.1';
    }
}
