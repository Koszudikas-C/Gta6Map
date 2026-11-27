<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Minimal stateless REST router supporting static and {param} routes with 404/405 responses.
 */
final class Router
{
    /** @var array<string, array<string, callable(Request): ResponseInterface>> */
    private array $staticRoutes = [];

    /**
     * @var list<array{
     *   pattern: string,
     *   regex: string,
     *   methods: array<string, callable(Request): ResponseInterface>
     * }>
     */
    private array $dynamicRoutes = [];

    /**
     * @param callable(Request): ResponseInterface $handler
     */
    public function get(string $path, callable $handler): void
    {
        $this->add('GET', $path, $handler);
    }

    /**
     * @param callable(Request): ResponseInterface $handler
     */
    public function post(string $path, callable $handler): void
    {
        $this->add('POST', $path, $handler);
    }

    /**
     * @param callable(Request): ResponseInterface $handler
     */
    public function put(string $path, callable $handler): void
    {
        $this->add('PUT', $path, $handler);
    }

    /**
     * @param callable(Request): ResponseInterface $handler
     */
    public function patch(string $path, callable $handler): void
    {
        $this->add('PATCH', $path, $handler);
    }

    /**
     * @param callable(Request): ResponseInterface $handler
     */
    public function delete(string $path, callable $handler): void
    {
        $this->add('DELETE', $path, $handler);
    }

    /**
     * @param callable(Request): ResponseInterface $handler
     */
    public function add(string $method, string $path, callable $handler): void
    {
        $normalizedPath = Request::normalizePath($path);
        $upperMethod = strtoupper($method);

        if (!str_contains($normalizedPath, '{')) {
            $this->staticRoutes[$normalizedPath][$upperMethod] = $handler;

            return;
        }

        foreach ($this->dynamicRoutes as $index => $route) {
            if ($route['pattern'] === $normalizedPath) {
                $this->dynamicRoutes[$index]['methods'][$upperMethod] = $handler;

                return;
            }
        }

        $regex = self::compilePattern($normalizedPath);
        $this->dynamicRoutes[] = [
            'pattern' => $normalizedPath,
            'regex' => $regex,
            'methods' => [$upperMethod => $handler],
        ];
    }

    public function dispatch(Request $request): ResponseInterface
    {
        $path = Request::normalizePath($request->getPath());
        $method = strtoupper($request->getMethod());

        if (isset($this->staticRoutes[$path])) {
            return $this->invokeMatchedRoute($this->staticRoutes[$path], $method, $request);
        }

        foreach ($this->dynamicRoutes as $route) {
            if (preg_match($route['regex'], $path, $matches) === 1) {
                $params = [];
                foreach ($matches as $key => $value) {
                    if (is_string($key)) {
                        $params[$key] = urldecode($value);
                    }
                }

                return $this->invokeMatchedRoute(
                    $route['methods'],
                    $method,
                    $request->withRouteParams($params)
                );
            }
        }

        return new JsonResponse(404, [
            'error' => 'Not Found',
            'message' => 'Endpoint not found.',
            'request_id' => $request->getRequestId(),
        ]);
    }

    /**
     * @param array<string, callable(Request): ResponseInterface> $methodsForPath
     */
    private function invokeMatchedRoute(array $methodsForPath, string $method, Request $request): ResponseInterface
    {
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

    private static function compilePattern(string $normalizedPath): string
    {
        $escaped = preg_replace_callback(
            '/\{([a-zA-Z_][a-zA-Z0-9_]*)\}|[^{}]+/',
            static function (array $matches): string {
                if (isset($matches[1])) {
                    return '(?P<' . $matches[1] . '>[^/]+)';
                }

                return preg_quote($matches[0], '#');
            },
            $normalizedPath
        );

        return '#^' . ($escaped ?? '') . '$#';
    }
}
