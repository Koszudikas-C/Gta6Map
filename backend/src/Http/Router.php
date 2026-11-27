<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Minimal stateless REST router with automatic 404 and 405 responses.
 */
final class Router
{
    /** @var array<string, array<string, callable(Request): JsonResponse>> */
    private array $routes = [];

    /**
     * @param callable(Request): JsonResponse $handler
     */
    public function get(string $path, callable $handler): void
    {
        $this->add('GET', $path, $handler);
    }

    /**
     * @param callable(Request): JsonResponse $handler
     */
    public function post(string $path, callable $handler): void
    {
        $this->add('POST', $path, $handler);
    }

    /**
     * @param callable(Request): JsonResponse $handler
     */
    public function patch(string $path, callable $handler): void
    {
        $this->add('PATCH', $path, $handler);
    }

    /**
     * @param callable(Request): JsonResponse $handler
     */
    public function add(string $method, string $path, callable $handler): void
    {
        $normalizedPath = Request::normalizePath($path);
        $upperMethod = strtoupper($method);
        $this->routes[$normalizedPath][$upperMethod] = $handler;
    }

    public function dispatch(Request $request): JsonResponse
    {
        $path = Request::normalizePath($request->getPath());
        $method = strtoupper($request->getMethod());

        if (!isset($this->routes[$path])) {
            return new JsonResponse(404, [
                'error' => 'Not Found',
                'message' => 'Endpoint not found.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $methodsForPath = $this->routes[$path];
        if (!isset($methodsForPath[$method])) {
            $allowed = implode(', ', array_keys($methodsForPath));

            return (new JsonResponse(405, [
                'error' => 'Method Not Allowed',
                'message' => sprintf('Allowed methods: %s', $allowed),
                'request_id' => $request->getRequestId(),
            ]))->withHeader('Allow', $allowed);
        }

        return ($methodsForPath[$method])($request);
    }
}
