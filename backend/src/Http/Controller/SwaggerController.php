<?php

declare(strict_types=1);

namespace App\Http\Controller;

use App\Http\HtmlResponse;
use App\Http\JsonResponse;
use App\Http\Request;
use JsonException;

/**
 * Serves OpenAPI 3.0 JSON specification and interactive Swagger UI.
 */
final class SwaggerController
{
    private const SWAGGER_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'";

    public function __construct(
        private readonly string $openApiJsonPath,
        private readonly string $specUrl = '/api/openapi.json',
    ) {
    }

    public function spec(Request $request): JsonResponse
    {
        if (!is_file($this->openApiJsonPath) || !is_readable($this->openApiJsonPath)) {
            return new JsonResponse(500, [
                'error' => 'Internal Server Error',
                'message' => 'OpenAPI specification file is unavailable.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $raw = file_get_contents($this->openApiJsonPath);
        if ($raw === false) {
            return new JsonResponse(500, [
                'error' => 'Internal Server Error',
                'message' => 'Failed to read OpenAPI specification.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return new JsonResponse(500, [
                'error' => 'Internal Server Error',
                'message' => 'Invalid OpenAPI specification JSON.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        if (!is_array($decoded)) {
            return new JsonResponse(500, [
                'error' => 'Internal Server Error',
                'message' => 'Invalid OpenAPI specification structure.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        /** @var array<string, mixed> $decoded */
        return new JsonResponse(200, $decoded);
    }

    public function ui(Request $request): HtmlResponse
    {
        $escapedSpecUrl = htmlspecialchars($this->specUrl, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');

        $html = <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Gta6Map (Leonida) — Swagger API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        body { margin: 0; background: #0B0D12; }
        .swagger-ui .topbar { background-color: #141821; border-bottom: 1px solid rgba(255,255,255,0.08); }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function () {
            window.ui = SwaggerUIBundle({
                url: '{$escapedSpecUrl}',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ]
            });
        };
    </script>
</body>
</html>
HTML;

        return (new HtmlResponse(200, $html))
            ->withHeader('Content-Security-Policy', self::SWAGGER_CSP);
    }
}
