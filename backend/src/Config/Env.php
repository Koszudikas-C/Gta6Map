<?php

declare(strict_types=1);

namespace App\Config;

/**
 * Typed environment configuration loader supporting .env files and OS environment variables.
 */
final class Env
{
    /** @var array<string, string> */
    private array $values;

    /**
     * @param array<string, string> $values
     */
    private function __construct(array $values)
    {
        $this->values = $values;
    }

    /**
     * Load configuration from a .env file path if it exists, merged with process env vars.
     */
    public static function load(string $filePath): self
    {
        $parsed = [];
        if (is_file($filePath) && is_readable($filePath)) {
            $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines !== false) {
                $parsed = self::parseLines($lines);
            }
        }

        return new self($parsed);
    }

    /**
     * Create an Env instance directly from an associative array (useful for unit tests).
     *
     * @param array<string, string> $values
     */
    public static function fromArray(array $values): self
    {
        return new self($values);
    }

    public function getString(string $key, string $default = ''): string
    {
        $envVal = getenv($key);
        if (is_string($envVal) && $envVal !== '') {
            return $envVal;
        }

        if (isset($_ENV[$key]) && is_string($_ENV[$key]) && $_ENV[$key] !== '') {
            return $_ENV[$key];
        }

        return $this->values[$key] ?? $default;
    }

    public function getInt(string $key, int $default = 0): int
    {
        $raw = $this->getString($key, '');
        if ($raw === '' || filter_var($raw, FILTER_VALIDATE_INT) === false) {
            return $default;
        }

        return (int) $raw;
    }

    public function getFloat(string $key, float $default = 0.0): float
    {
        $raw = $this->getString($key, '');
        if ($raw === '' || !is_numeric($raw)) {
            return $default;
        }

        return (float) $raw;
    }

    public function getBool(string $key, bool $default = false): bool
    {
        $raw = strtolower(trim($this->getString($key, '')));
        if ($raw === '') {
            return $default;
        }

        return match ($raw) {
            '1', 'true', 'yes', 'on' => true,
            '0', 'false', 'no', 'off' => false,
            default => $default,
        };
    }

    public function isProduction(): bool
    {
        return strtolower($this->getString('APP_ENV', 'production')) === 'production';
    }

    public function isDebug(): bool
    {
        return $this->getBool('APP_DEBUG', false);
    }

    /**
     * @param list<string> $lines
     * @return array<string, string>
     */
    private static function parseLines(array $lines): array
    {
        $result = [];
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            if (str_starts_with($trimmed, 'export ')) {
                $trimmed = trim(substr($trimmed, 7));
            }

            $eqPos = strpos($trimmed, '=');
            if ($eqPos === false || $eqPos === 0) {
                continue;
            }

            $key = trim(substr($trimmed, 0, $eqPos));
            $rawValue = trim(substr($trimmed, $eqPos + 1));
            $result[$key] = self::unquoteValue($rawValue);
        }

        return $result;
    }

    private static function unquoteValue(string $value): string
    {
        if ($value === '') {
            return '';
        }

        $first = $value[0];
        $last = $value[strlen($value) - 1];
        if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
            if (strlen($value) >= 2) {
                return substr($value, 1, -1);
            }
        }

        $commentPos = strpos($value, ' #');
        if ($commentPos !== false) {
            return rtrim(substr($value, 0, $commentPos));
        }

        return $value;
    }
}
