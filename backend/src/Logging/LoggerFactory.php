<?php

declare(strict_types=1);

namespace App\Logging;

use Monolog\Formatter\JsonFormatter;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Level;
use Monolog\Logger;
use Monolog\LogRecord;

/**
 * Factory for structured JSON rotating Monolog channels with LGPD masking and X-Request-ID.
 */
final class LoggerFactory
{
    public const CHANNEL_APP = 'app';
    public const CHANNEL_ASAAS_WEBHOOK = 'asaas-webhook';
    public const CHANNEL_SECURITY = 'security';
    public const CHANNEL_SLOW_QUERY = 'slow-query';

    /** @var list<string> */
    private const ALLOWED_CHANNELS = [
        self::CHANNEL_APP,
        self::CHANNEL_ASAAS_WEBHOOK,
        self::CHANNEL_SECURITY,
        self::CHANNEL_SLOW_QUERY,
    ];

    /** @var array<string, Logger> */
    private array $loggers = [];

    public function __construct(
        private readonly string $logDirectory,
        private readonly string $requestId = '',
        private readonly bool $includeStacktraces = false,
        private readonly int $maxFiles = 30,
    ) {
    }

    /**
     * Retrieve or build a Monolog logger for one of the standard Gta6Map channels.
     */
    public function channel(string $channel, Level $level = Level::Debug): Logger
    {
        $safeChannel = in_array($channel, self::ALLOWED_CHANNELS, true) ? $channel : self::CHANNEL_APP;

        if (isset($this->loggers[$safeChannel])) {
            return $this->loggers[$safeChannel];
        }

        $this->ensureLogDirectory();

        $filePath = rtrim($this->logDirectory, '/\\') . DIRECTORY_SEPARATOR . $safeChannel . '.log';
        $handler = new RotatingFileHandler($filePath, $this->maxFiles, $level);

        $formatter = new JsonFormatter(JsonFormatter::BATCH_MODE_JSON, true, false, true);
        $formatter->includeStacktraces($this->includeStacktraces);
        $handler->setFormatter($formatter);

        $logger = new Logger($safeChannel);
        $logger->pushHandler($handler);
        $logger->pushProcessor(new LgpdSanitizer());
        $logger->pushProcessor(function (LogRecord $record): LogRecord {
            if ($this->requestId === '') {
                return $record;
            }

            return $record->with(extra: [
                ...$record->extra,
                'request_id' => $this->requestId,
            ]);
        });

        $this->loggers[$safeChannel] = $logger;

        return $logger;
    }

    private function ensureLogDirectory(): void
    {
        if (!is_dir($this->logDirectory)) {
            mkdir($this->logDirectory, 0750, true);
        }
    }
}
