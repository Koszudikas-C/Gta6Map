# Gta6Map (Leonida) — Interactive GTA 6 Map Platform

Interactive 2.5D/3D GTA 6 (Leonida) map platform built for shared hosting:
- **Frontend (`/frontend`)**: Angular 22+ Standalone Components, MapLibre GL JS (WebGL), native Gamepad API, tactical Leonida HUD.
- **Backend (`/backend`)**: Stateless PHP 8.5+ REST API (`PDO_MYSQL`), Monolog JSON structured logging with LGPD masking.
- **Database (`/database`)**: MySQL 8.0+ InnoDB migrations and idempotent seeds.
- **Docs (`/docs`)**: API specification (`docs/API.md`).

---

## Backend Setup (PHP 8.5+ & MySQL 8.0+)

### 1. Requirements
- PHP `8.5+` with extensions: `pdo`, `pdo_mysql`, `json`
- MySQL `8.0+` (InnoDB, `utf8mb4_unicode_ci`)
- Composer `2.x`

### 2. Environment Configuration
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` with your MySQL credentials and `APP_ENV` (`local` or `production`).

### 3. Install Dependencies
```bash
cd backend
composer install
```

### 4. Run Migrations & Initial Seed
Ensure the target MySQL database exists (e.g. `CREATE DATABASE gta6map CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`), then run:
```bash
cd backend
php bin/migrate.php
```
Optional flags:
- `php bin/migrate.php --dry-run` — preview pending migrations/seeds.
- `php bin/migrate.php --migrations-only` — run schema migrations only.
- `php bin/migrate.php --seeds-only` — run seed scripts only.

### 5. Local Development Server
```bash
cd backend
php -S 127.0.0.1:8000 -t public
```
Test endpoints:
- `GET http://127.0.0.1:8000/api/health`
- `POST http://127.0.0.1:8000/api/telemetry/client-error`

### 6. Shared Hosting (Apache) Deploy
- Point your API vhost or `/api` document root to `backend/public/`.
- `backend/public/.htaccess` routes `/api/*` requests to `index.php`, preserves `Authorization` headers, and blocks dotfiles/internal directories.
- Keep `backend/storage/logs/` outside `public/` (30-day Monolog daily rotation).

### 7. Verification Commands
```bash
cd backend
composer test     # PHPUnit
composer analyse  # PHPStan (level 8)
```
