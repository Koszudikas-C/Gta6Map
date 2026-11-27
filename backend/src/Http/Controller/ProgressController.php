<?php

declare(strict_types=1);

namespace App\Http\Controller;

use App\Http\JsonResponse;
use App\Http\Request;
use App\Repository\ProgressRepositoryInterface;

/**
 * VIP cloud checklist synchronization endpoints (GET/PUT /api/progress).
 */
final class ProgressController
{
    private const SAVE_SLOT_PATTERN = '/^[a-zA-Z0-9_\-]{1,50}$/';
    private const MAX_POI_IDS_PER_SYNC = 5000;

    public function __construct(private readonly ProgressRepositoryInterface $progressRepository)
    {
    }

    public function getProgress(Request $request): JsonResponse
    {
        $authUser = $request->getAuthenticatedUser();
        if ($authUser === null) {
            return $this->unauthorized($request);
        }

        $rawSlot = $request->getQuery()['save_slot'] ?? 'default';
        $saveSlot = $this->validateSaveSlot($rawSlot);
        if ($saveSlot === null) {
            return $this->validationError($request, 'Invalid save_slot format.');
        }

        $poiIds = $this->progressRepository->findPoiIdsByUserAndSlot($authUser->userId, $saveSlot);

        return new JsonResponse(200, [
            'save_slot' => $saveSlot,
            'poi_ids' => $poiIds,
            'count' => count($poiIds),
            'request_id' => $request->getRequestId(),
        ]);
    }

    public function syncProgress(Request $request): JsonResponse
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

        $rawSlot = $payload['save_slot'] ?? 'default';
        if (!is_string($rawSlot)) {
            return $this->validationError($request, 'Field save_slot must be a string.');
        }

        $saveSlot = $this->validateSaveSlot($rawSlot);
        if ($saveSlot === null) {
            return $this->validationError($request, 'Invalid save_slot format.');
        }

        if (!isset($payload['poi_ids']) || !is_array($payload['poi_ids']) || !array_is_list($payload['poi_ids'])) {
            return $this->validationError($request, 'Field poi_ids must be a list of positive integers.');
        }

        if (count($payload['poi_ids']) > self::MAX_POI_IDS_PER_SYNC) {
            return $this->validationError($request, sprintf('Maximum %d poi_ids allowed per sync.', self::MAX_POI_IDS_PER_SYNC));
        }

        $poiIds = [];
        foreach ($payload['poi_ids'] as $rawId) {
            if (!is_int($rawId) || $rawId <= 0) {
                return $this->validationError($request, 'All poi_ids entries must be positive integers.');
            }
            $poiIds[] = $rawId;
        }

        $mode = $payload['mode'] ?? 'replace';
        if (!is_string($mode) || !in_array($mode, ['replace', 'merge'], true)) {
            return $this->validationError($request, 'Field mode must be replace or merge.');
        }

        $synced = $this->progressRepository->syncProgress(
            $authUser->userId,
            $saveSlot,
            $poiIds,
            $mode === 'replace'
        );

        return new JsonResponse(200, [
            'save_slot' => $saveSlot,
            'poi_ids' => $synced,
            'count' => count($synced),
            'request_id' => $request->getRequestId(),
        ]);
    }

    private function validateSaveSlot(string $rawSlot): ?string
    {
        $trimmed = trim($rawSlot);
        if (preg_match(self::SAVE_SLOT_PATTERN, $trimmed) !== 1) {
            return null;
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

    private function validationError(Request $request, string $message): JsonResponse
    {
        return new JsonResponse(422, [
            'error' => 'Unprocessable Entity',
            'message' => $message,
            'request_id' => $request->getRequestId(),
        ]);
    }
}
