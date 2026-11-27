<?php

declare(strict_types=1);

namespace Tests\Http;

use App\Http\Controller\SwaggerController;
use App\Http\Request;
use PHPUnit\Framework\TestCase;

final class SwaggerControllerTest extends TestCase
{
    public function testServesValidOpenApi3SpecCoveringAllPhase1To3Endpoints(): void
    {
        $specPath = dirname(__DIR__, 3) . '/docs/openapi.json';
        $controller = new SwaggerController($specPath);

        $response = $controller->spec(new Request('GET', '/api/openapi.json', requestId: 'req-oas-1'));
        $data = $response->getData();

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('3.0.3', $data['openapi']);
        self::assertIsArray($data['paths']);

        $expectedPaths = [
            '/api/health',
            '/api/telemetry/client-error',
            '/api/auth/google',
            '/api/me',
            '/api/categories',
            '/api/pois',
            '/api/pois/{id}',
            '/api/progress',
            '/api/custom-pins',
            '/api/custom-pins/{id}',
            '/share',
        ];

        foreach ($expectedPaths as $path) {
            self::assertArrayHasKey($path, $data['paths']);
        }
    }

    public function testServesSwaggerUiHtmlWithCompatibleCspHeader(): void
    {
        $specPath = dirname(__DIR__, 3) . '/docs/openapi.json';
        $controller = new SwaggerController($specPath, '/api/openapi.json');

        $response = $controller->ui(new Request('GET', '/api/docs', requestId: 'req-oas-2'));
        $html = $response->getBody();
        $headers = $response->getHeaders();

        self::assertSame(200, $response->getStatusCode());
        self::assertStringContainsString('swagger-ui-dist@5', $html);
        self::assertStringContainsString('/api/openapi.json', $html);
        self::assertArrayHasKey('Content-Security-Policy', $headers);
        self::assertStringContainsString('https://unpkg.com', $headers['Content-Security-Policy']);
    }

    public function testReturns500WhenOpenApiFileIsMissing(): void
    {
        $controller = new SwaggerController(sys_get_temp_dir() . '/missing-openapi-' . uniqid('', true) . '.json');

        $response = $controller->spec(new Request('GET', '/api/openapi.json', requestId: 'req-oas-3'));
        self::assertSame(500, $response->getStatusCode());
    }
}
