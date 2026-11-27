<?php

declare(strict_types=1);

namespace App\Service;

use App\Repository\PoiRecord;

/**
 * Generates XSS-safe OpenGraph / Twitter Card HTML for social crawlers (RF05).
 */
final class OpenGraphService
{
    /** @var list<string> */
    private const BOT_SIGNATURES = [
        'whatsapp',
        'discordbot',
        'googlebot',
        'twitterbot',
        'facebookexternalhit',
        'telegrambot',
        'slackbot',
        'linkedinbot',
        'bingbot',
        'applebot',
    ];

    public function isSocialBot(string $userAgent): bool
    {
        $lower = strtolower($userAgent);
        foreach (self::BOT_SIGNATURES as $signature) {
            if (str_contains($lower, $signature)) {
                return true;
            }
        }

        return false;
    }

    public function renderPoiShareHtml(
        ?PoiRecord $poi,
        string $canonicalUrl,
        string $defaultImageUrl,
        string $redirectUrl,
    ): string {
        $rawTitle = $poi !== null
            ? sprintf('%s — %s | Leonida Map', $poi->title, $poi->categoryName)
            : 'Mapa Interativo GTA 6 (Leonida) — POIs, Rotas 3D & Plano Fundador';

        $rawDescription = $poi !== null && $poi->description !== null && trim($poi->description) !== ''
            ? $poi->description
            : 'Explore todos os pontos de interesse, colecionáveis e segredos de Leonida em 2.5D/3D com suporte a Joystick.';

        $rawImage = $poi !== null && $poi->imageUrl !== null && trim($poi->imageUrl) !== ''
            ? $poi->imageUrl
            : $defaultImageUrl;

        $safeTitle = $this->escapeHtml($this->truncate($rawTitle, 160));
        $safeDescription = $this->escapeHtml($this->truncate($rawDescription, 300));
        $safeImage = $this->escapeHtml($this->sanitizeHttpUrl($rawImage, $defaultImageUrl));
        $safeCanonical = $this->escapeHtml($this->sanitizeHttpUrl($canonicalUrl, '/'));
        $safeRedirect = $this->escapeHtml($this->sanitizeHttpUrl($redirectUrl, '/'));

        return <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{$safeTitle}</title>
    <meta name="description" content="{$safeDescription}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Gta6Map — Leonida">
    <meta property="og:title" content="{$safeTitle}">
    <meta property="og:description" content="{$safeDescription}">
    <meta property="og:image" content="{$safeImage}">
    <meta property="og:url" content="{$safeCanonical}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{$safeTitle}">
    <meta name="twitter:description" content="{$safeDescription}">
    <meta name="twitter:image" content="{$safeImage}">
    <link rel="canonical" href="{$safeCanonical}">
</head>
<body>
    <main>
        <h1>{$safeTitle}</h1>
        <p>{$safeDescription}</p>
        <p><a href="{$safeRedirect}">Abrir no Mapa Interativo de Leonida</a></p>
    </main>
</body>
</html>
HTML;
    }

    private function escapeHtml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    }

    private function truncate(string $value, int $maxLength): string
    {
        $clean = trim(preg_replace('/\s+/', ' ', $value) ?? $value);
        if (strlen($clean) <= $maxLength) {
            return $clean;
        }

        return substr($clean, 0, $maxLength - 3) . '...';
    }

    private function sanitizeHttpUrl(string $url, string $fallback): string
    {
        $trimmed = trim($url);
        if ($trimmed === '') {
            return $fallback;
        }

        if (str_starts_with($trimmed, '/') && !str_starts_with($trimmed, '//')) {
            return $trimmed;
        }

        $scheme = strtolower((string) parse_url($trimmed, PHP_URL_SCHEME));
        if ($scheme === 'http' || $scheme === 'https') {
            return $trimmed;
        }

        return $fallback;
    }
}
