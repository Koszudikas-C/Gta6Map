<?php

declare(strict_types=1);

namespace App\Http\Controller;

use App\Http\JsonResponse;
use App\Http\Request;
use App\Repository\UserRepositoryInterface;

/**
 * Protected user profile endpoints (GET /api/me, PATCH /api/me).
 */
final class ProfileController
{
    private const PSN_ID_PATTERN = '/^[a-zA-Z0-9_\-. ]{2,64}$/';

    public function __construct(private readonly UserRepositoryInterface $users)
    {
    }

    public function getMe(Request $request): JsonResponse
    {
        $authUser = $request->getAuthenticatedUser();
        if ($authUser === null) {
            return $this->unauthorized($request);
        }

        $user = $this->users->findById($authUser->userId);
        if ($user === null) {
            return new JsonResponse(404, [
                'error' => 'Not Found',
                'message' => 'User profile not found.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $referralsCount = $this->users->countReferrals($user->id);

        return new JsonResponse(200, [
            'user' => $user->toPublicArray($referralsCount),
            'request_id' => $request->getRequestId(),
        ]);
    }

    public function updateMe(Request $request): JsonResponse
    {
        $authUser = $request->getAuthenticatedUser();
        if ($authUser === null) {
            return $this->unauthorized($request);
        }

        $payload = $request->getJsonBody();
        if ($payload === null) {
            return new JsonResponse(400, [
                'error' => 'Bad Request',
                'message' => 'Invalid or empty JSON payload.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        if (!array_key_exists('psn_id', $payload)) {
            return new JsonResponse(422, [
                'error' => 'Unprocessable Entity',
                'message' => 'Field psn_id is required.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $rawPsnId = $payload['psn_id'];
        if ($rawPsnId !== null && !is_string($rawPsnId)) {
            return new JsonResponse(422, [
                'error' => 'Unprocessable Entity',
                'message' => 'Field psn_id must be a string or null.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $sanitizedPsnId = $this->sanitizePsnId($rawPsnId);
        if ($sanitizedPsnId === false) {
            return new JsonResponse(422, [
                'error' => 'Unprocessable Entity',
                'message' => 'Field psn_id must be 2-64 characters (letters, numbers, spaces, _, -, .).',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $updated = $this->users->updateProfile($authUser->userId, $sanitizedPsnId);
        if ($updated === null) {
            return new JsonResponse(404, [
                'error' => 'Not Found',
                'message' => 'User profile not found.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $referralsCount = $this->users->countReferrals($updated->id);

        return new JsonResponse(200, [
            'user' => $updated->toPublicArray($referralsCount),
            'request_id' => $request->getRequestId(),
        ]);
    }

    /**
     * @return string|null|false Returns false when validation fails.
     */
    private function sanitizePsnId(?string $rawPsnId): string|null|false
    {
        if ($rawPsnId === null) {
            return null;
        }

        $withoutTags = strip_tags($rawPsnId);
        $withoutControl = preg_replace('/[\x00-\x1F\x7F]/', '', $withoutTags) ?? $withoutTags;
        $trimmed = trim(preg_replace('/\s+/', ' ', $withoutControl) ?? $withoutControl);

        if ($trimmed === '') {
            return null;
        }

        if (preg_match(self::PSN_ID_PATTERN, $trimmed) !== 1) {
            return false;
        }

        return $trimmed;
    }

    private function unauthorized(Request $request): JsonResponse
    {
        return new JsonResponse(401, [
            'error' => 'Unauthorized',
            'message' => 'Authentication required.',
            'request_id' => $request->getRequestId(),
        ]);
    }
}
