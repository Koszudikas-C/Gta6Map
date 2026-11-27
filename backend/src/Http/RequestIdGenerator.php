<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Generates and validates X-Request-ID correlation identifiers (UUID v4).
 */
final class RequestIdGenerator
{
    private const ALLOWED_PATTERN = '/^[a-zA-Z0-9\-_]{8,64}$/';

    public static function resolve(?string $incomingHeader): string
    {
        if ($incomingHeader !== null) {
            $trimmed = trim($incomingHeader);
            if ($trimmed !== '' && preg_match(self::ALLOWED_PATTERN, $trimmed) === 1) {
                return $trimmed;
            }
        }

        return self::generateUuidV4();
    }

    public static function generateUuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        $hex = bin2hex($bytes);

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hex, 0, 8),
            substr($hex, 8, 4),
            substr($hex, 12, 4),
            substr($hex, 16, 4),
            substr($hex, 20, 12)
        );
    }
}
