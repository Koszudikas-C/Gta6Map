<?php

declare(strict_types=1);

namespace Tests\Http;

use App\Http\JsonResponse;
use App\Http\Request;
use App\Http\RequestIdGenerator;
use App\Http\Router;
use PHPUnit\Framework\TestCase;

final class RouterAndRequestIdTest extends TestCase
{
    public function testGeneratesValidUuidV4AndAcceptsSafeIncomingRequestId(): void
    {
        $generated = RequestIdGenerator::resolve(null);
        self::assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $generated
        );

        $preserved = RequestIdGenerator::resolve('req-client-12345678');
        self::assertSame('req-client-12345678', $preserved);

        $fallback = RequestIdGenerator::resolve('bad header!@#');
        self::assertNotSame('bad header!@#', $fallback);
    }

    public function testRouterDispatchesAndHandles404And405(): void
    {
        $router = new Router();
        $router->get('/api/health', static fn (Request $req): JsonResponse => new JsonResponse(200, [
            'ok' => true,
            'request_id' => $req->getRequestId(),
        ]));

        $okResponse = $router->dispatch(new Request('GET', '/api/health', requestId: 'req-12345678'));
        self::assertSame(200, $okResponse->getStatusCode());
        self::assertTrue($okResponse->getData()['ok']);

        $notFound = $router->dispatch(new Request('GET', '/api/unknown', requestId: 'req-12345678'));
        self::assertSame(404, $notFound->getStatusCode());

        $methodNotAllowed = $router->dispatch(new Request('POST', '/api/health', requestId: 'req-12345678'));
        self::assertSame(405, $methodNotAllowed->getStatusCode());
        self::assertSame('GET', $methodNotAllowed->getHeaders()['Allow'] ?? '');
    }
}
