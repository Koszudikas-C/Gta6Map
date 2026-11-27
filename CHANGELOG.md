# Changelog

All notable changes to the **Gta6Map (Leonida)** project will be documented in this file.

## [0.1.0] - 2026-11-27

### Added (Phase 3 — Public POIs Cache, VIP Cloud Progress, Custom Pins & OpenGraph)
- **HTTP Infrastructure (`ResponseInterface`, `HtmlResponse`, `Router`, `Request`, `AuthMiddleware`)**: Added parameterized `{id}` routing, `put`/`delete` methods, `HtmlResponse`, and `AuthMiddleware::requireVip()` (`403 VIP_REQUIRED` for non-VIP accounts).
- **Public POIs & JSON Cache (`PoiRepository`, `PoiCacheService`, `PoiController`)**: Added `GET /api/categories`, `GET /api/pois` (with `category` and `q` filtering backed by `backend/storage/cache/pois.json` + `invalidate()`), and `GET /api/pois/{id}`.
- **VIP Cloud Progress & Custom Pins (`ProgressRepository`, `ProgressController`, `CustomPinRepository`, `CustomPinController`)**: Added `GET /api/progress`, `PUT /api/progress` (transactional slot sync), `GET /api/custom-pins`, `POST /api/custom-pins`, and `DELETE /api/custom-pins/{id}` with ownership verification.
- **Deep Linking & OpenGraph (`OpenGraphService`, `ShareController`)**: Added `GET /share`, `GET /share/{id}`, and social-bot detection on `/?poi={id}` with strict HTML/URL XSS escaping.
- **Tests & Docs**: Added PHPUnit tests (`PoiCacheAndControllerTest`, `VipProgressAndCustomPinsTest`, `OpenGraphAndShareTest`, `PoiAndPinRepositoryTest`), updated `backend/.env.example` and `docs/API.md`.

### Added (Security Hardening — Rate Limiting & Security Headers)
- **RateLimiter (`backend/src/Http/RateLimiter.php`)**: File-backed fixed-window rate limiter (`backend/storage/ratelimit/` with `LOCK_EX` and expired-window cleanup), returning `429 Too Many Requests` + `Retry-After` and logging breaches to the `security` channel. Applied to `POST /api/auth/google` (`15/min`) and `POST /api/telemetry/client-error` (`30/min`).
- **Security Headers (`JsonResponse`, `backend/public/index.php`, `backend/public/.htaccess`)**: Enforced `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin` across all API responses.
- **Tests & Docs**: Added `RateLimiterTest` (`backend/tests/Http/RateLimiterTest.php`), updated `backend/.gitignore` and `docs/API.md` (`429 Too Many Requests`).

### Added (Phase 2 — Google OAuth 2.0, JWT, Profile & Referral System)
- **Auth Layer (`backend/src/Auth/`)**:
  - `GoogleTokenVerifier` & `GoogleTokenVerifierInterface`: validates Google ID tokens (`aud`, `iss`, `exp`, `email_verified`) with injectable HTTP fetcher for unit tests.
  - `JwtService`: stateless `HS256` JWT issuance and verification (`sub`, `role`, `is_vip`, `iss`, `iat`, `exp`).
  - `AuthMiddleware`: `Authorization: Bearer <token>` middleware attaching `AuthenticatedUser` to `Request` and logging rejections to `security` channel.
- **User Persistence & Referral Engine (`backend/src/Repository/`, `backend/src/Service/`)**:
  - `UserRepository` (`PDO_MYSQL` native prepared statements) & `UserRecord` (omitting raw CPF).
  - `ReferralCodeGenerator` (`LEO...` unique codes) and `AuthService` (Google identity sync, `?ref=` attribution, anti-self-referral enforcement).
- **Endpoints (`AuthController`, `ProfileController`, `backend/public/index.php`)**:
  - `POST /api/auth/google`, `GET /api/me`, and `PATCH /api/me` (with `psn_id` sanitization).
- **Tests & Docs**: PHPUnit tests in `backend/tests/` (`JwtServiceTest`, `GoogleTokenVerifierTest`, `AuthMiddlewareTest`, `AuthServiceAndControllerTest`, `ProfileControllerTest`, `UserRepositoryTest`) + `docs/API.md` & `backend/.env.example`.

### Added (Phase 1 — Backend Foundation, MySQL 8.0+ Schema & Base Observability)
- **Composer & Dependencies (`backend/composer.json`)**: Added `monolog/monolog` (`^3.0`), configured `phpunit/phpunit` and `phpstan/phpstan`, and updated `backend/.gitignore` for `storage/logs/*.log` and `/vendor/`.
- **MySQL 8.0+ InnoDB Schema (`database/migrations/001_initial_schema.sql`)**: Created tables `users`, `poi_categories`, `pois`, `user_poi_progress`, `user_custom_pins`, `payments`, `raffle_quotas` (`CHECK (quota_number <= 999)`), `campaign_settings`, and `audit_logs` with `CHAR(36)` UUIDs, `JSON`, `BTREE` indexes, and `utf8mb4_unicode_ci`.
- **Idempotent Seeds (`database/seeds/001_initial_seed.sql`)**: Pre-populated `raffle_quotas` (`000–799` `PAID`, `800–999` `REFERRAL_BONUS`), base `poi_categories`, and default PS5 Pro campaign goal (`1200000` cents / `800` paid quotas).
- **CLI Migration Runner (`backend/bin/migrate.php`, `backend/src/Database/MigrationRunner.php`)**: Idempotent `PDO_MYSQL` migration & seed runner tracked via `schema_migrations`.
- **Backend Core & Observability**:
  - `App\Config\Env` typed `.env` loader (`backend/.env.example`).
  - `App\Database\Connection` `PDO_MYSQL` factory (`ATTR_EMULATE_PREPARES => false`) with slow-query (`>200ms`) anonymized logging.
  - `App\Logging\LoggerFactory` & `App\Logging\LgpdSanitizer` with Monolog `JsonFormatter` + 30-day `RotatingFileHandler` for `app`, `asaas-webhook`, `security`, and `slow-query` channels.
  - `App\Http\Router`, `App\Http\Request`, `App\Http\JsonResponse`, `App\Http\RequestIdGenerator` (`X-Request-ID` UUID v4).
  - `HealthController` (`GET /api/health`) and `TelemetryController` (`POST /api/telemetry/client-error`).
  - `backend/public/index.php` front controller with CORS, correlation IDs, and production-safe global error handler, plus `backend/public/.htaccess` for shared Apache hosting.
- **Tests & Docs**: Unit test suite in `backend/tests/` (PHPUnit) + PHPStan level 8 validation + `docs/API.md` + `README.md`.
