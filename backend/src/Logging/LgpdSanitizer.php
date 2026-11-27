<?php

declare(strict_types=1);

namespace App\Logging;

use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;

/**
 * Masks CPF, emails, phone numbers, and auth/payment secrets to comply with LGPD.
 */
final class LgpdSanitizer implements ProcessorInterface
{
    private const REDACTED = '[REDACTED]';
    private const MASKED_CPF = '***.***.***-**';

    /** @var list<string> */
    private const SECRET_KEYS = [
        'token',
        'access_token',
        'asaas_access_token',
        'asaas-access-token',
        'asaas_api_key',
        'api_key',
        'apikey',
        'secret',
        'jwt_secret',
        'password',
        'passwd',
        'authorization',
        'cookie',
        'credit_card',
        'card_number',
        'cvv',
        'cvc',
        'db_pass',
    ];

    public function __invoke(LogRecord $record): LogRecord
    {
        return $record->with(
            message: self::sanitizeString($record->message),
            context: self::sanitizeArray($record->context),
            extra: self::sanitizeArray($record->extra),
        );
    }

    /**
     * Recursively sanitize sensitive keys and values inside an associative/indexed array.
     *
     * @param array<mixed> $data
     * @return array<mixed>
     */
    public static function sanitizeArray(array $data): array
    {
        $sanitized = [];
        foreach ($data as $key => $value) {
            $keyStr = is_string($key) ? strtolower($key) : '';

            if (is_array($value)) {
                $sanitized[$key] = self::sanitizeArray($value);
                continue;
            }

            if (is_string($value)) {
                $sanitized[$key] = self::sanitizeByKey($keyStr, $value);
                continue;
            }

            if ($keyStr !== '' && self::isSecretKey($keyStr)) {
                $sanitized[$key] = self::REDACTED;
                continue;
            }

            $sanitized[$key] = $value;
        }

        return $sanitized;
    }

    /**
     * Mask CPF numbers and inline bearer/token credentials inside plain strings.
     */
    public static function sanitizeString(string $value): string
    {
        $masked = preg_replace('/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/', self::MASKED_CPF, $value);
        $current = $masked ?? $value;

        $maskedBearer = preg_replace('/\bBearer\s+[A-Za-z0-9\-._~+\/]+=*/i', 'Bearer ' . self::REDACTED, $current);
        $current = $maskedBearer ?? $current;

        $maskedKv = preg_replace(
            '/\b(asaas[-_]access[-_]token|asaas[-_]api[-_]key|access[-_]token|jwt[-_]secret|api[-_]key|password|secret)\s*[:=]\s*[^\s,;]+/i',
            '$1=' . self::REDACTED,
            $current
        );

        return $maskedKv ?? $current;
    }

    private static function sanitizeByKey(string $key, string $value): string
    {
        if ($key !== '' && self::isSecretKey($key)) {
            return self::REDACTED;
        }

        if ($key !== '' && str_contains($key, 'cpf')) {
            return self::MASKED_CPF;
        }

        if ($key !== '' && str_contains($key, 'email')) {
            return self::maskEmail($value);
        }

        if ($key !== '' && (str_contains($key, 'whatsapp') || str_contains($key, 'phone'))) {
            return self::maskPhone($value);
        }

        return self::sanitizeString($value);
    }

    private static function isSecretKey(string $key): bool
    {
        foreach (self::SECRET_KEYS as $secretKey) {
            if (str_contains($key, $secretKey)) {
                return true;
            }
        }

        return false;
    }

    private static function maskEmail(string $email): string
    {
        $atPos = strpos($email, '@');
        if ($atPos === false || $atPos === 0) {
            return self::REDACTED;
        }

        return $email[0] . '***' . substr($email, $atPos);
    }

    private static function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (strlen($digits) < 4) {
            return self::REDACTED;
        }

        return '***-****' . substr($digits, -4);
    }
}
