<?php

declare(strict_types=1);

use App\Config\Env;
use App\Database\Connection;
use App\Http\Controller\HealthController;
use App\Http\Controller\TelemetryController;
use App\Http\JsonResponse;
use App\Http\Request;
use App\Http\RequestIdGenerator;
use App\Http\Router;
use App\Logging\LgpdSanitizer;
use App\Logging\LoggerFactory;

$backendRoot = dirname(__DIR__);
require_once $backendRoot . '/vendor/autoload.php';

$env = Env::load($backendRoot . '/.env');
$incomingRequestId = isset($_SERVER['HTTP_X_REQUEST_ID']) && is_string($_SERVER['HTTP_X_REQUEST_ID'])
    ? $_SERVER['HTTP_X_REQUEST_ID']
    : null;
$requestId = RequestIdGenerator::resolve($incomingRequestId);

$logDir = $env->getString('LOG_PATH', $backendRoot . '/storage/logs');
if (!str_starts_with($logDir, '/') && preg_match('/^[A-Za-z]:[\\\\\/]/', $logDir) !== 1) {
    $logDir = $backendRoot . '/' . ltrim($logDir, '/\\');
}

$includeStacktraces = !$env->isProduction() && $env->isDebug();
$loggerFactory = new LoggerFactory($logDir, $requestId, $includeStacktraces);
$appLogger = $loggerFactory->channel(LoggerFactory::CHANNEL_APP);

$request = Request::fromGlobals($requestId);

$corsHeaders = [
    'X-Request-ID' => $requestId,
    'Access-Control-Allow-Origin' => $env->getString('CORS_ALLOWED_ORIGIN', '*'),
    'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Expose-Headers' => 'X-Request-ID',
];

$applyCors = static function (JsonResponse $response) use ($corsHeaders): JsonResponse {
    foreach ($corsHeaders as $name => $value) {
        $response = $response->withHeader($name, $value);
    }

    return $response;
};

if ($request->getMethod() === 'OPTIONS') {
    $applyCors(new JsonResponse(204, []))->emit();
    exit(0);
}

try {
    $storagePath = $backendRoot . '/storage';
    $poiCacheFile = $storagePath . '/cache/pois.json';

    $healthController = new HealthController(
        static fn (): PDO => Connection::create($env),
        $storagePath,
        $poiCacheFile,
        $env->getString('APP_ENV', 'production')
    );
    $telemetryController = new TelemetryController($appLogger);

    $router = new Router();
    $router->get('/api/health', [$healthController, 'handle']);
    $router->post('/api/telemetry/client-error', [$telemetryController, 'handle']);

    $response = $router->dispatch($request);
    $applyCors($response)->emit();
} catch (Throwable $exception) {
    $appLogger->error('Unhandled API exception', [
        'exception_class' => $exception::class,
        'message' => LgpdSanitizer::sanitizeString($exception->getMessage()),
        'file' => $exception->getFile(),
        'line' => $exception->getLine(),
        'path' => $request->getPath(),
        'method' => $request->getMethod(),
    ]);

    $payload = [
        'error' => 'Internal Server Error',
        'message' => $includeStacktraces ? LgpdSanitizer::sanitizeString($exception->getMessage()) : 'An unexpected error occurred.',
        'request_id' => $requestId,
    ];

    if ($includeStacktraces) {
        $payload['trace'] = explode("\n", LgpdSanitizer::sanitizeString($exception->getTraceAsString()));
    }

    $applyCors(new JsonResponse(500, $payload))->emit();
}
