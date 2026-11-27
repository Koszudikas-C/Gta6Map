<?php

declare(strict_types=1);

namespace App\Auth;

use App\Http\JsonResponse;
use App\Http\Request;
use Psr\Log\LoggerInterface;

/**
 * Stateless Bearer JWT middleware that attaches AuthenticatedUser to Request.
 */
final class AuthMiddleware
{
    public function __construct(
        private readonly JwtService $jwtService,
        private readonly ?LoggerInterface $securityLogger = null,
    ) {
    }

    /**
     * @param callable(Request): JsonResponse $next
     */
    public function authenticate(Request $request, callable $next): JsonResponse
    {
        $token = $this->extractBearerToken($request->getHeader('Authorization'));
        if ($token === null) {
            return $this->unauthorized($request, 'Missing or malformed Bearer token.');
        }

        try {
            $user = $this->jwtService->verify($token);
        } catch (InvalidTokenException $exception) {
            $this->securityLogger?->warning('JWT authentication rejected', [
                'reason' => $exception->getMessage(),
                'path' => $request->getPath(),
                'client_ip' => $request->getClientIp(),
                'request_id' => $request->getRequestId(),
            ]);

            return $this->unauthorized($request, 'Invalid or expired access token.');
        }

        return $next($request->withAuthenticatedUser($user));
    }

    private function extractBearerToken(string $authorizationHeader): ?string
    {
        if (preg_match('/^\s*Bearer\s+([A-Za-z0-9\-._~+\/]+=*)\s*$/i', $authorizationHeader, $matches) !== 1) {
            return null;
        }

        return $matches[1];
    }

    private function unauthorized(Request $request, string $message): JsonResponse
    {
        return new JsonResponse(401, [
            'error' => 'Unauthorized',
            'message' => $message,
            'request_id' => $request->getRequestId(),
        ]);
    }
}
