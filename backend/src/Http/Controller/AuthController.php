<?php

declare(strict_types=1);

namespace App\Http\Controller;

use App\Auth\InvalidTokenException;
use App\Http\JsonResponse;
use App\Http\Request;
use App\Repository\UserRepositoryInterface;
use App\Service\AuthService;
use Psr\Log\LoggerInterface;

/**
 * Handles Google OAuth 2.0 login (POST /api/auth/google).
 */
final class AuthController
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly UserRepositoryInterface $users,
        private readonly ?LoggerInterface $securityLogger = null,
    ) {
    }

    public function googleLogin(Request $request): JsonResponse
    {
        $payload = $request->getJsonBody();
        if ($payload === null) {
            return new JsonResponse(400, [
                'error' => 'Bad Request',
                'message' => 'Invalid or empty JSON payload.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $idToken = $payload['id_token'] ?? null;
        if (!is_string($idToken) || trim($idToken) === '') {
            return new JsonResponse(422, [
                'error' => 'Unprocessable Entity',
                'message' => 'Field id_token is required.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $refCode = null;
        if (isset($payload['ref']) && is_string($payload['ref'])) {
            $refCode = $payload['ref'];
        } elseif (isset($request->getQuery()['ref'])) {
            $refCode = $request->getQuery()['ref'];
        }

        try {
            $result = $this->authService->authenticateWithGoogle($idToken, $refCode);
        } catch (InvalidTokenException $exception) {
            $this->securityLogger?->warning('Google OAuth token verification failed', [
                'reason' => $exception->getMessage(),
                'client_ip' => $request->getClientIp(),
                'request_id' => $request->getRequestId(),
            ]);

            return new JsonResponse(401, [
                'error' => 'Unauthorized',
                'message' => 'Invalid Google ID token.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $user = $result['user'];
        $referralsCount = $this->users->countReferrals($user->id);

        return new JsonResponse(200, [
            'token' => $result['token'],
            'token_type' => 'Bearer',
            'expires_in' => $result['expires_in'],
            'user' => $user->toPublicArray($referralsCount),
            'request_id' => $request->getRequestId(),
        ]);
    }
}
