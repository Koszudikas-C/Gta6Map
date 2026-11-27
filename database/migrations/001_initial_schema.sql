-- Gta6Map (Leonida) - Initial MySQL 8.0+ InnoDB Schema
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users (Google OAuth + VIP & Referral tracking)
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) NOT NULL,
    google_id VARCHAR(128) NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL,
    avatar_url TEXT NULL,
    psn_id VARCHAR(64) NULL,
    cpf VARCHAR(14) NULL,
    whatsapp VARCHAR(20) NULL,
    asaas_customer_id VARCHAR(64) NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    is_vip TINYINT(1) NOT NULL DEFAULT 0,
    referral_code VARCHAR(20) NOT NULL,
    referred_by_user_id CHAR(36) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_google_id (google_id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_referral_code (referral_code),
    KEY idx_users_referred_by (referred_by_user_id) USING BTREE,
    KEY idx_users_role (role) USING BTREE,
    CONSTRAINT fk_users_referred_by FOREIGN KEY (referred_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_users_role CHECK (role IN ('USER', 'ADMIN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. POI Categories
CREATE TABLE IF NOT EXISTS poi_categories (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(60) NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon_name VARCHAR(60) NOT NULL,
    color_hex CHAR(7) NOT NULL DEFAULT '#FF4D6D',
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_poi_categories_slug (slug),
    KEY idx_poi_categories_sort (sort_order) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Points of Interest (POIs)
CREATE TABLE IF NOT EXISTS pois (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id INT UNSIGNED NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    coord_x DOUBLE NOT NULL,
    coord_y DOUBLE NOT NULL,
    image_url TEXT NULL,
    panorama_url TEXT NULL,
    metadata JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    created_by CHAR(36) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_pois_category (category_id) USING BTREE,
    KEY idx_pois_status (status) USING BTREE,
    KEY idx_pois_coords (coord_x, coord_y) USING BTREE,
    KEY idx_pois_created_by (created_by) USING BTREE,
    CONSTRAINT fk_pois_category FOREIGN KEY (category_id) REFERENCES poi_categories (id) ON DELETE RESTRICT,
    CONSTRAINT fk_pois_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT chk_pois_status CHECK (status IN ('PUBLISHED', 'PENDING', 'REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. User Cloud POI Progress (VIP save slots)
CREATE TABLE IF NOT EXISTS user_poi_progress (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id CHAR(36) NOT NULL,
    save_slot VARCHAR(50) NOT NULL DEFAULT 'default',
    poi_id BIGINT UNSIGNED NOT NULL,
    found_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_poi_progress (user_id, save_slot, poi_id),
    KEY idx_user_poi_progress_poi (poi_id) USING BTREE,
    CONSTRAINT fk_upp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_upp_poi FOREIGN KEY (poi_id) REFERENCES pois (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. User Custom Pins (VIP)
CREATE TABLE IF NOT EXISTS user_custom_pins (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    title VARCHAR(120) NOT NULL,
    notes TEXT NULL,
    coord_x DOUBLE NOT NULL,
    coord_y DOUBLE NOT NULL,
    color_hex CHAR(7) NOT NULL DEFAULT '#00D2D3',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_user_custom_pins_user (user_id) USING BTREE,
    CONSTRAINT fk_custom_pins_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Payments (Asaas API v3)
CREATE TABLE IF NOT EXISTS payments (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    asaas_payment_id VARCHAR(80) NOT NULL,
    package_code VARCHAR(30) NOT NULL,
    amount_cents INT UNSIGNED NOT NULL,
    quotas_count INT UNSIGNED NOT NULL,
    billing_type VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    pix_payload TEXT NULL,
    pix_qr_base64 MEDIUMTEXT NULL,
    webhook_payload JSON NULL,
    paid_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_asaas_id (asaas_payment_id),
    KEY idx_payments_user (user_id) USING BTREE,
    KEY idx_payments_status (status) USING BTREE,
    CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT chk_payments_package CHECK (package_code IN ('VIP_1', 'VIP_3', 'VIP_6')),
    CONSTRAINT chk_payments_billing CHECK (billing_type IN ('PIX', 'CREDIT_CARD')),
    CONSTRAINT chk_payments_status CHECK (status IN ('PENDING', 'CONFIRMED', 'RECEIVED', 'REFUNDED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Raffle Quotas (000-799 PAID, 800-999 REFERRAL_BONUS)
CREATE TABLE IF NOT EXISTS raffle_quotas (
    quota_number SMALLINT UNSIGNED NOT NULL,
    pool_type VARCHAR(20) NOT NULL,
    user_id CHAR(36) NULL,
    payment_id CHAR(36) NULL,
    assigned_at TIMESTAMP(6) NULL,
    PRIMARY KEY (quota_number),
    KEY idx_raffle_quotas_pool_user (pool_type, user_id) USING BTREE,
    KEY idx_raffle_quotas_user (user_id) USING BTREE,
    KEY idx_raffle_quotas_payment (payment_id) USING BTREE,
    CONSTRAINT chk_raffle_quotas_number CHECK (quota_number <= 999),
    CONSTRAINT chk_raffle_quotas_pool CHECK (pool_type IN ('PAID', 'REFERRAL_BONUS')),
    CONSTRAINT fk_raffle_quotas_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_raffle_quotas_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Global Campaign Settings
CREATE TABLE IF NOT EXISTS campaign_settings (
    setting_key VARCHAR(60) NOT NULL,
    value JSON NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. System Audit Logs (Admin Observability Level 3)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id CHAR(36) NULL,
    actor_user_id CHAR(36) NULL,
    event_type VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NULL,
    entity_id VARCHAR(80) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'INFO',
    summary VARCHAR(255) NOT NULL,
    context JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_audit_logs_event_created (event_type, created_at) USING BTREE,
    KEY idx_audit_logs_actor (actor_user_id) USING BTREE,
    KEY idx_audit_logs_request (request_id) USING BTREE,
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
