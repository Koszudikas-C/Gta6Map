<?php

declare(strict_types=1);

use App\Auth\AuthMiddleware;
use App\Auth\GoogleTokenVerifier;
use App\Auth\JwtService;
use App\Config\Env;
use App\Database\Connection;
use App\Http\Controller\AuthController;
use App\Http\Controller\CustomPinController;
use App\Http\Controller\HealthController;
use App\Http\Controller\PoiController;
use App\Http\Controller\ProfileController;
use App\Http\Controller\ProgressController;
use App\Http\Controller\ShareController;
use App\Http\Controller\TelemetryController;
use App\Http\JsonResponse;
use App\Http\RateLimiter;
use App\Http\Request;
use App\Http\RequestIdGenerator;
use App\Http\ResponseInterface;
use App\Http\Router;
use App\Logging\LgpdSanitizer;
use App\Logging\LoggerFactory;
use App\Repository\CustomPinRepository;
use App\Repository\PoiRepository;
use App\Repository\ProgressRepository;
use App\Repository\UserRepository;
use App\Service\AuthService;
use App\Service\OpenGraphService;
use App\Service\PoiCacheService;

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
$securityLogger = $loggerFactory->channel(LoggerFactory::CHANNEL_SECURITY);
$slowQueryLogger = $loggerFactory->channel(LoggerFactory::CHANNEL_SLOW_QUERY);

$request = Request::fromGlobals($requestId);

$defaultResponseHeaders = array_merge(ResponseInterface::SECURITY_HEADERS, [
    'X-Request-ID' => $requestId,
    'Access-Control-Allow-Origin' => $env->getString('CORS_ALLOWED_ORIGIN', '*'),
    'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Expose-Headers' => 'X-Request-ID, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
]);

$applyDefaultHeaders = static function (ResponseInterface $response) use ($defaultResponseHeaders): ResponseInterface {
    foreach ($defaultResponseHeaders as $name => $value) {
        $response = $response->withHeader($name, $value);
    }

    return $response;
};

if ($request->getMethod() === 'OPTIONS') {
    $applyDefaultHeaders(new JsonResponse(204, []))->emit();
    exit(0);
}

try {
    $storagePath = $backendRoot . '/storage';
    $poiCacheFile = $storagePath . '/cache/pois.json';
    $rateLimitDir = $storagePath . '/ratelimit';
    $pdoFactory = static fn (): PDO => Connection::create($env);

    $userRepository = new UserRepository($pdoFactory, $slowQueryLogger);
    $poiRepository = new PoiRepository($pdoFactory, $slowQueryLogger);
    $progressRepository = new ProgressRepository($pdoFactory, $slowQueryLogger);
    $customPinRepository = new CustomPinRepository($pdoFactory, $slowQueryLogger);

    $poiCacheService = new PoiCacheService(
        $poiRepository,
        $poiCacheFile,
        $env->getInt('POI_CACHE_TTL_SECONDS', 300)
    );
    $openGraphService = new OpenGraphService();

    $jwtService = new JwtService(
        secret: $env->getString('JWT_SECRET', ''),
        ttlSeconds: $env->getInt('JWT_TTL_SECONDS', 604800),
    );
    $googleVerifier = new GoogleTokenVerifier($env->getString('GOOGLE_CLIENT_ID', ''));
    $authService = new AuthService($googleVerifier, $jwtService, $userRepository);
    $authMiddleware = new AuthMiddleware($jwtService, $securityLogger);
    $rateLimiter = new RateLimiter($rateLimitDir, $securityLogger);

    $healthController = new HealthController(
        $pdoFactory,
        $storagePath,
        $poiCacheFile,
        $env->getString('APP_ENV', 'production')
    );
    $telemetryController = new TelemetryController($appLogger);
    $authController = new AuthController($authService, $userRepository, $securityLogger);
    $profileController = new ProfileController($userRepository);
    $poiController = new PoiController($poiCacheService);
    $progressController = new ProgressController($progressRepository);
    $customPinController = new CustomPinController($customPinRepository);

    $appBaseUrl = $env->getString('APP_URL', 'http://localhost:8000');
    $shareController = new ShareController(
        $poiCacheService,
        $openGraphService,
        $appBaseUrl,
        $env->getString('OG_DEFAULT_IMAGE_URL', rtrim($appBaseUrl, '/') . '/assets/og-leonida.webp')
    );

    $router = new Router();
    $router->get('/api/health', [$healthController, 'handle']);
    $router->post('/api/telemetry/client-error', static fn (Request $req): ResponseInterface => $rateLimiter->limit(
        $req,
        'telemetry_client_error',
        30,
        60,
        [$telemetryController, 'handle']
    ));
    $router->post('/api/auth/google', static fn (Request $req): ResponseInterface => $rateLimiter->limit(
        $req,
        'auth_google',
        15,
        60,
        [$authController, 'googleLogin']
    ));
    $router->get('/api/me', static fn (Request $req): ResponseInterface => $authMiddleware->authenticate(
        $req,
        [$profileController, 'getMe']
    ));
    $router->patch('/api/me', static fn (Request $req): ResponseInterface => $authMiddleware->authenticate(
        $req,
        [$profileController, 'updateMe']
    ));

    // Phase 3: Public POIs & Categories (with JSON cache)
    $router->get('/api/categories', [$poiController, 'listCategories']);
    $router->get('/api/pois', [$poiController, 'listPois']);
    $router->get('/api/pois/{id}', [$poiController, 'getPoi']);

    // Phase 3: VIP Cloud Progress & Custom Pins
    $router->get('/api/progress', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
        $req,
        [$progressController, 'getProgress']
    ));
    $router->put('/api/progress', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
        $req,
        [$progressController, 'syncProgress']
    ));
    $router->get('/api/custom-pins', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
        $req,
        [$customPinController, 'listPins']
    ));
    $router->post('/api/custom-pins', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
        $req,
        [$customPinController, 'createPin']
    ));
    $router->delete('/api/custom-pins/{id}', static fn (Request $req): ResponseInterface => $authMiddleware->requireVip(
        $req,
        [$customPinController, 'deletePin']
    ));

    // Phase 3: Deep Linking & Dynamic OpenGraph for social bots
    $router->get('/share', [$shareController, 'handle']);
    $router->get('/share/{id}', [$shareController, 'handle']);
    if ($shareController->isSocialBotRequest($request)) {
        $router->get('/', [$shareController, 'handle']);
    }

    $response = $router->dispatch($request);
    $applyDefaultHeaders($response)->emit();
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

    $applyDefaultHeaders(new JsonResponse(500, $payload))->emit();
}
