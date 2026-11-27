<?php

declare(strict_types=1);

namespace App\Http\Controller;

use App\Http\JsonResponse;
use App\Http\Request;
use App\Logging\LgpdSanitizer;
use Psr\Log\LoggerInterface;

/**
 * Frontend client telemetry ingestion endpoint (POST /api/telemetry/client-error).
 */
final class TelemetryController
{
    private const MAX_EVENTS_PER_BATCH = 20;
    private const MAX_MESSAGE_LENGTH = 1000;
    private const MAX_STACK_LENGTH = 4000;

    /** @var list<string> */
    private const ALLOWED_LEVELS = ['error', 'warn', 'perf'];

    /** @var list<string> */
    private const ALLOWED_SOURCES = ['js', 'webgl', 'http', 'rum'];

    /** @var list<string> */
    private const ALLOWED_DEVICES = ['desktop', 'mobile', 'console'];

    public function __construct(private readonly LoggerInterface $appLogger)
    {
    }

    public function handle(Request $request): JsonResponse
    {
        $payload = $request->getJsonBody();
        if ($payload === null) {
            return new JsonResponse(400, [
                'error' => 'Bad Request',
                'message' => 'Invalid or empty JSON payload.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        $events = $this->extractEvents($payload);
        if ($events === null || count($events) === 0) {
            return new JsonResponse(422, [
                'error' => 'Unprocessable Entity',
                'message' => 'Expected at least one telemetry event.',
                'request_id' => $request->getRequestId(),
            ]);
        }

        if (count($events) > self::MAX_EVENTS_PER_BATCH) {
            return new JsonResponse(422, [
                'error' => 'Unprocessable Entity',
                'message' => sprintf('Batch limit exceeded (max %d events).', self::MAX_EVENTS_PER_BATCH),
                'request_id' => $request->getRequestId(),
            ]);
        }

        $normalizedEvents = [];
        foreach ($events as $index => $event) {
            if (!is_array($event)) {
                return $this->validationError($request, sprintf('Event at index %d must be an object.', $index));
            }
            $validated = $this->validateEvent($event);
            if ($validated === null) {
                return $this->validationError($request, sprintf('Invalid telemetry event at index %d.', $index));
            }
            $normalizedEvents[] = $validated;
        }

        foreach ($normalizedEvents as $event) {
            $this->logEvent($event, $request);
        }

        return new JsonResponse(202, [
            'status' => 'accepted',
            'accepted_count' => count($normalizedEvents),
            'request_id' => $request->getRequestId(),
        ]);
    }

    /**
     * @param array<mixed> $payload
     * @return list<mixed>|null
     */
    private function extractEvents(array $payload): ?array
    {
        if (array_key_exists('events', $payload)) {
            if (!is_array($payload['events']) || !array_is_list($payload['events'])) {
                return null;
            }

            return $payload['events'];
        }

        if (array_is_list($payload)) {
            return null;
        }

        return [$payload];
    }

    /**
     * @param array<mixed> $event
     * @return array<string, bool|string>|null
     */
    private function validateEvent(array $event): ?array
    {
        $level = $event['level'] ?? null;
        $source = $event['source'] ?? null;
        $message = $event['message'] ?? null;

        if (!is_string($level) || !in_array($level, self::ALLOWED_LEVELS, true)) {
            return null;
        }

        if (!is_string($source) || !in_array($source, self::ALLOWED_SOURCES, true)) {
            return null;
        }

        if (!is_string($message) || trim($message) === '') {
            return null;
        }

        $deviceType = $event['deviceType'] ?? 'desktop';
        if (!is_string($deviceType) || !in_array($deviceType, self::ALLOWED_DEVICES, true)) {
            return null;
        }

        $route = isset($event['route']) && is_string($event['route']) ? $event['route'] : '/';
        $buildVersion = isset($event['buildVersion']) && is_string($event['buildVersion']) ? $event['buildVersion'] : 'unknown';
        $timestamp = isset($event['timestamp']) && is_string($event['timestamp']) ? $event['timestamp'] : gmdate('c');
        $gamepadConnected = isset($event['gamepadConnected']) && is_bool($event['gamepadConnected'])
            ? $event['gamepadConnected']
            : false;

        $normalized = [
            'level' => $level,
            'source' => $source,
            'message' => $this->cleanText($message, self::MAX_MESSAGE_LENGTH),
            'route' => $this->cleanText($route, 255),
            'deviceType' => $deviceType,
            'gamepadConnected' => $gamepadConnected,
            'buildVersion' => $this->cleanText($buildVersion, 64),
            'clientTimestamp' => $this->cleanText($timestamp, 64),
        ];

        if (isset($event['stack']) && is_string($event['stack']) && trim($event['stack']) !== '') {
            $normalized['stack'] = $this->cleanText($event['stack'], self::MAX_STACK_LENGTH);
        }

        return $normalized;
    }

    /**
     * @param array<string, bool|string> $event
     */
    private function logEvent(array $event, Request $request): void
    {
        /** @var array<string, mixed> $sanitized */
        $sanitized = LgpdSanitizer::sanitizeArray([
            'telemetry' => $event,
            'client_ip' => $request->getClientIp(),
            'request_id' => $request->getRequestId(),
        ]);

        $message = sprintf('Client telemetry [%s/%s]: %s', (string) $event['source'], (string) $event['level'], (string) $event['message']);

        match ($event['level']) {
            'error' => $this->appLogger->error($message, $sanitized),
            'warn' => $this->appLogger->warning($message, $sanitized),
            default => $this->appLogger->info($message, $sanitized),
        };
    }

    private function cleanText(string $value, int $maxLength): string
    {
        $withoutControlChars = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value) ?? $value;
        $trimmed = trim($withoutControlChars);

        if (strlen($trimmed) > $maxLength) {
            return substr($trimmed, 0, $maxLength);
        }

        return $trimmed;
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
