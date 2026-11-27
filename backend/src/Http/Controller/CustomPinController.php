<?php

declare(strict_types=1);

namespace App\Http\Controller;

use App\Http\JsonResponse;
use App\Http\Request;
use App\Http\RequestIdGenerator;
use App\Repository\CustomPinRecord;
use App\Repository\CustomPinRepositoryInterface;

/**
 * VIP custom map pins CRUD endpoints (GET/POST /api/custom-pins, DELETE /api/custom-pins/{id}).
 */
final class CustomPinController
{
    private const COLOR_HEX_PATTERN = '/^#[0-9A-Fa-f]{6}$/';
    private const UUID_PATTERN = '/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/';
    private const DEFAULT_COLOR_HEX = '#00D2D3';
    private const MAX_COORD_ABS = 1_000_000.0;

    public function __construct(private readonly CustomPinRepositoryInterface $pins)
    {
    }

    public function listPins(Request $request): JsonResponse
    {
        $authUser = $request->getAuthenticatedUser();
        if ($authUser === null) {
            return $this->unauthorized($request);
        }

        $items = array_map(
            static fn (CustomPinRecord $pin): array => $pin->toPublicArray(),
            $this->pins->findByUser($authUser->userId)
        );

        return new JsonResponse(200, [
            'pins' => $items,
            'request_id' => $request->getRequestId(),
        ]);
    }

    public function createPin(Request $request): JsonResponse
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

        $rawTitle = $payload['title'] ?? null;
        if (!is_string($rawTitle)) {
            return $this->validationError($request, 'Field title is required.');
        }

        $title = $this->sanitizeText($rawTitle, 120);
        if ($title === '') {
            return $this->validationError($request, 'Field title cannot be empty.');
        }

        $notes = null;
        if (array_key_exists('notes', $payload) && $payload['notes'] !== null) {
            if (!is_string($payload['notes'])) {
                return $this->validationError($request, 'Field notes must be a string or null.');
            }
            $cleanedNotes = $this->sanitizeText($payload['notes'], 1000);
            $notes = $cleanedNotes !== '' ? $cleanedNotes : null;
        }

        $coordX = $this->validateCoordinate($payload['coord_x'] ?? null);
        $coordY = $this->validateCoordinate($payload['coord_y'] ?? null);
        if ($coordX === null || $coordY === null) {
            return $this->validationError($request, 'Fields coord_x and coord_y must be valid finite numbers.');
        }

        $colorHex = self::DEFAULT_COLOR_HEX;
        if (isset($payload['color_hex'])) {
            if (!is_string($payload['color_hex']) || preg_match(self::COLOR_HEX_PATTERN, trim($payload['color_hex'])) !== 1) {
                return $this->validationError($request, 'Field color_hex must be a #RRGGBB hex color.');
            }
            $colorHex = strtoupper(trim($payload['color_hex']));
        }

        $created = $this->pins->create(
            id: RequestIdGenerator::generateUuidV4(),
            userId: $authUser->userId,
            title: $title,
            notes: $notes,
            coordX: $coordX,
            coordY: $coordY,
            colorHex: $colorHex,
        );

        return new JsonResponse(201, [
            'pin' => $created->toPublicArray(),
            'request_id' => $request->getRequestId(),
        ]);
    }

    public function deletePin(Request $request): JsonResponse
    {
        $authUser = $request->getAuthenticatedUser();
        if ($authUser === null) {
            return $this->unauthorized($request);
        }

        $pinId = trim($request->getRouteParam('id'));
        if (preg_match(self::UUID_PATTERN, $pinId) !== 1) {
            return new JsonResponse(400, [
                'error' => 'Bad Request',
                'message' => 'Invalid custom pin UUID.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $existing = $this->pins->findById($pinId);
        if ($existing === null) {
            return new JsonResponse(404, [
                'error' => 'Not Found',
                'message' => 'Custom pin not found.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        if ($existing->userId !== $authUser->userId) {
            return new JsonResponse(403, [
                'error' => 'Forbidden',
                'message' => 'You do not have permission to delete this custom pin.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $this->pins->deleteByIdForUser($pinId, $authUser->userId);

        return new JsonResponse(200, [
            'deleted' => true,
            'id' => $pinId,
            'request_id' => $request->getRequestId(),
        ]);
    }

    private function validateCoordinate(mixed $value): ?float
    {
        if (!is_int($value) && !is_float($value)) {
            return null;
        }

        $floatVal = (float) $value;
        if (!is_finite($floatVal) || abs($floatVal) > self::MAX_COORD_ABS) {
            return null;
        }

        return $floatVal;
    }

    private function sanitizeText(string $value, int $maxLength): string
    {
        $withoutTags = strip_tags($value);
        $withoutControl = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $withoutTags) ?? $withoutTags;
        $trimmed = trim($withoutControl);

        if (strlen($trimmed) > $maxLength) {
            return substr($trimmed, 0, $maxLength);
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
