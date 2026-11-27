# Changelog

All notable changes to the **Gta6Map (Leonida)** project will be documented in this file.

## [0.1.0] - 2026-11-27

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
