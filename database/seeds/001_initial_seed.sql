-- Gta6Map (Leonida) - Initial Idempotent Seed Data
-- Pre-populates raffle_quotas (000-999), base poi_categories, and default campaign_settings

-- 1. Pre-populate 1,000 raffle quotas (000-799 PAID, 800-999 REFERRAL_BONUS)
INSERT IGNORE INTO raffle_quotas (quota_number, pool_type)
SELECT
    (hundreds.d * 100 + tens.d * 10 + ones.d) AS quota_number,
    CASE
        WHEN (hundreds.d * 100 + tens.d * 10 + ones.d) <= 799 THEN 'PAID'
        ELSE 'REFERRAL_BONUS'
    END AS pool_type
FROM (
    SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
) AS hundreds
CROSS JOIN (
    SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
) AS tens
CROSS JOIN (
    SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
) AS ones;

-- 2. Base POI Categories
INSERT IGNORE INTO poi_categories (slug, name, icon_name, color_hex, sort_order) VALUES
    ('weapons', 'Armas', 'crosshair', '#FF4D6D', 1),
    ('collectibles', 'Colecionáveis', 'gem', '#FF9E44', 2),
    ('missions', 'Missões', 'flag', '#00D2D3', 3),
    ('shops', 'Lojas', 'shopping-bag', '#22C55E', 4),
    ('easter-eggs', 'Easter Eggs', 'sparkles', '#A855F7', 5),
    ('events', 'Eventos', 'zap', '#FACC15', 6);

-- 3. Default Campaign Settings (PS5 Pro Goal: R$ 12.000,00 = 1,200,000 cents / 800 paid quotas)
INSERT IGNORE INTO campaign_settings (setting_key, value) VALUES
    (
        'ps5_pro_goal',
        JSON_OBJECT(
            'title', 'Meta PS5 Pro Leonida',
            'target_amount_cents', 1200000,
            'paid_quotas_total', 800,
            'referral_quotas_total', 200,
            'quota_price_cents', 1500,
            'status', 'ACTIVE',
            'lottery_contest_number', NULL,
            'lottery_draw_date', NULL
        )
    ),
    (
        'founder_packages',
        JSON_OBJECT(
            'VIP_1', JSON_OBJECT('amount_cents', 1500, 'quotas', 1, 'description', 'Assinatura Plano Fundador - Acesso VIP Mapa Interativo'),
            'VIP_3', JSON_OBJECT('amount_cents', 3500, 'quotas', 3, 'description', 'Assinatura Plano Fundador - Acesso VIP Mapa Interativo'),
            'VIP_6', JSON_OBJECT('amount_cents', 6000, 'quotas', 6, 'description', 'Assinatura Plano Fundador - Acesso VIP Mapa Interativo')
        )
    );
