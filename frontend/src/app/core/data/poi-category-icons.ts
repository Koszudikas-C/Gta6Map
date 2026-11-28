import {
  Anchor,
  Award,
  Bird,
  BookOpen,
  Building2,
  Calendar,
  Car,
  Coffee,
  Compass,
  Crosshair,
  DoorOpen,
  Flag,
  Flame,
  Fuel,
  HeartPulse,
  Home,
  Landmark,
  LucideIconData,
  Martini,
  Plane,
  Shield,
  ShoppingBag,
  Skull,
  Spade,
  Sparkles,
  Star,
  Sun,
  Swords,
  Trees,
} from 'lucide-angular';

export type PoiBlipId =
  | 'bar'
  | 'card'
  | 'shop'
  | 'story'
  | 'vehicle'
  | 'landmark'
  | 'easter'
  | 'transport'
  | 'side'
  | 'magazine'
  | 'hotel'
  | 'bank'
  | 'meteor'
  | 'monument'
  | 'wellness'
  | 'police'
  | 'flamingo'
  | 'crime'
  | 'meditation'
  | 'weapon'
  | 'weapon_pro'
  | 'safehouse'
  | 'enterable'
  | 'event'
  | 'nature'
  | 'fuel'
  | 'anchor'
  | 'coffee';

export interface PoiBlipMeta {
  id: PoiBlipId;
  color: string;
  bg: string;
  icon: LucideIconData;
}

export const POI_BLIP_CATALOG: Record<PoiBlipId, PoiBlipMeta> = {
  bar: { id: 'bar', color: '#FF4FD8', bg: 'rgba(255, 79, 216, 0.16)', icon: Martini },
  card: { id: 'card', color: '#FFB458', bg: 'rgba(255, 180, 88, 0.16)', icon: Spade },
  shop: { id: 'shop', color: '#F44E8F', bg: 'rgba(244, 78, 143, 0.16)', icon: ShoppingBag },
  story: { id: 'story', color: '#FFD166', bg: 'rgba(255, 209, 102, 0.18)', icon: Star },
  vehicle: { id: 'vehicle', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.18)', icon: Car },
  landmark: { id: 'landmark', color: '#FFA66B', bg: 'rgba(255, 166, 107, 0.16)', icon: Compass },
  easter: { id: 'easter', color: '#C084FC', bg: 'rgba(192, 132, 252, 0.16)', icon: Sparkles },
  transport: { id: 'transport', color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.16)', icon: Plane },
  side: { id: 'side', color: '#FB923C', bg: 'rgba(251, 146, 60, 0.16)', icon: Flag },
  magazine: { id: 'magazine', color: '#F472B6', bg: 'rgba(244, 114, 182, 0.16)', icon: BookOpen },
  hotel: { id: 'hotel', color: '#FF4FD8', bg: 'rgba(255, 79, 216, 0.16)', icon: Building2 },
  bank: { id: 'bank', color: '#4ADE80', bg: 'rgba(74, 222, 128, 0.16)', icon: Landmark },
  meteor: { id: 'meteor', color: '#FB7185', bg: 'rgba(251, 113, 133, 0.16)', icon: Flame },
  monument: { id: 'monument', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.16)', icon: Award },
  wellness: { id: 'wellness', color: '#34D399', bg: 'rgba(52, 211, 153, 0.16)', icon: HeartPulse },
  police: { id: 'police', color: '#818CF8', bg: 'rgba(129, 140, 248, 0.16)', icon: Shield },
  flamingo: { id: 'flamingo', color: '#FF6BB5', bg: 'rgba(255, 107, 181, 0.16)', icon: Bird },
  crime: { id: 'crime', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.16)', icon: Skull },
  meditation: { id: 'meditation', color: '#E879F9', bg: 'rgba(232, 121, 249, 0.16)', icon: Sun },
  weapon: { id: 'weapon', color: '#F87171', bg: 'rgba(248, 113, 113, 0.16)', icon: Crosshair },
  weapon_pro: { id: 'weapon_pro', color: '#FACC15', bg: 'rgba(250, 204, 21, 0.18)', icon: Swords },
  safehouse: { id: 'safehouse', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.18)', icon: Home },
  enterable: { id: 'enterable', color: '#FFB458', bg: 'rgba(255, 180, 88, 0.16)', icon: DoorOpen },
  event: { id: 'event', color: '#FB7185', bg: 'rgba(251, 113, 133, 0.16)', icon: Calendar },
  nature: { id: 'nature', color: '#4ADE80', bg: 'rgba(74, 222, 128, 0.16)', icon: Trees },
  fuel: { id: 'fuel', color: '#FACC15', bg: 'rgba(250, 204, 21, 0.16)', icon: Fuel },
  anchor: { id: 'anchor', color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.16)', icon: Anchor },
  coffee: { id: 'coffee', color: '#FB923C', bg: 'rgba(251, 146, 60, 0.16)', icon: Coffee },
};

export const ALL_POI_BLIPS: readonly PoiBlipMeta[] = Object.values(POI_BLIP_CATALOG);

const EXACT_CATEGORY_MAP = new Map<string, PoiBlipId>([
  ['bares, cafes e lazer', 'bar'],
  ['cartas colecionaveis', 'card'],
  ['lojas e comercio', 'shop'],
  ['lojas', 'shop'],
  ['missoes da historia', 'story'],
  ['veiculos e oficinas', 'vehicle'],
  ['pontos de referencia', 'landmark'],
  ['pontos-chave', 'landmark'],
  ['easter eggs', 'easter'],
  ['transporte, aeroportos e marinas', 'transport'],
  ['transporte', 'transport'],
  ['missoes secundarias', 'side'],
  ['revistas colecionaveis', 'magazine'],
  ['hoteis e resorts', 'hotel'],
  ['hoteis', 'hotel'],
  ['bancos e financeiras', 'bank'],
  ['fragmentos de meteorito', 'meteor'],
  ['monumentos waink', 'monument'],
  ['servicos e bem-estar', 'wellness'],
  ['policia e bombeiros', 'police'],
  ['flamingos', 'flamingo'],
  ['crimes e assaltos', 'crime'],
  ['pontos de meditacao', 'meditation'],
  ['armas', 'weapon'],
  ['armas unicas', 'weapon_pro'],
  ['esconderijos', 'safehouse'],
  ['acessiveis', 'enterable'],
  ['eventos', 'event'],
  ['natureza', 'nature'],
]);

const KEYWORD_RULES: Array<{ keywords: string[]; id: PoiBlipId }> = [
  { keywords: ['arma unica', 'unicas'], id: 'weapon_pro' },
  { keywords: ['arma'], id: 'weapon' },
  { keywords: ['hotel', 'hoteis', 'resort', 'motel'], id: 'hotel' },
  { keywords: ['bar', 'cafe', 'lazer'], id: 'bar' },
  { keywords: ['carta'], id: 'card' },
  { keywords: ['revista'], id: 'magazine' },
  { keywords: ['loja', 'comercio'], id: 'shop' },
  { keywords: ['historia'], id: 'story' },
  { keywords: ['secundaria'], id: 'side' },
  { keywords: ['veiculo', 'oficina'], id: 'vehicle' },
  { keywords: ['transporte', 'aeroporto', 'marina'], id: 'transport' },
  { keywords: ['banco', 'financeira'], id: 'bank' },
  { keywords: ['meteorito'], id: 'meteor' },
  { keywords: ['monumento', 'waink'], id: 'monument' },
  { keywords: ['bem-estar', 'servico'], id: 'wellness' },
  { keywords: ['policia', 'bombeiro'], id: 'police' },
  { keywords: ['flamingo'], id: 'flamingo' },
  { keywords: ['crime', 'assalto'], id: 'crime' },
  { keywords: ['meditacao'], id: 'meditation' },
  { keywords: ['esconderijo'], id: 'safehouse' },
  { keywords: ['easter'], id: 'easter' },
  { keywords: ['acessivel', 'acessiveis'], id: 'enterable' },
  { keywords: ['evento'], id: 'event' },
  { keywords: ['natureza', 'parque', 'praia'], id: 'nature' },
  { keywords: ['ponto', 'referencia', 'chave'], id: 'landmark' },
];

const categoryMetaCache = new Map<string, PoiBlipMeta>();

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getPoiCategoryMeta(category: string): PoiBlipMeta {
  const cached = categoryMetaCache.get(category);
  if (cached) {
    return cached;
  }
  const norm = normalize(category);
  const exactId = EXACT_CATEGORY_MAP.get(norm);
  let resolved: PoiBlipMeta | undefined = exactId ? POI_BLIP_CATALOG[exactId] : undefined;

  if (!resolved) {
    for (const rule of KEYWORD_RULES) {
      if (rule.keywords.some((kw) => norm.includes(kw))) {
        resolved = POI_BLIP_CATALOG[rule.id];
        break;
      }
    }
  }

  const finalMeta = resolved ?? POI_BLIP_CATALOG.landmark;
  categoryMetaCache.set(category, finalMeta);
  return finalMeta;
}

export function getPoiItemMeta(category: string, itemName?: string): PoiBlipMeta {
  if (itemName) {
    const normName = normalize(itemName);
    if (normName.includes('xero gas') || normName.includes('posto') || normName.includes('fuel')) {
      return POI_BLIP_CATALOG.fuel;
    }
    if (normName.includes('marina') || normName.includes('pier') || normName.includes('porto') || normName.includes('dock')) {
      return POI_BLIP_CATALOG.anchor;
    }
    if (normName.includes('airport') || normName.includes('aeroporto') || normName.includes('helipad') || normName.includes('heliporto')) {
      return POI_BLIP_CATALOG.transport;
    }
    if (
      normName.includes('cafe') ||
      normName.includes('coffee') ||
      normName.includes('waffle') ||
      normName.includes('taco') ||
      normName.includes('burger') ||
      normName.includes('restaurant') ||
      normName.includes('diner')
    ) {
      return POI_BLIP_CATALOG.coffee;
    }
    if (normName.includes('hotel') || normName.includes('motel') || normName.includes('resort')) {
      return POI_BLIP_CATALOG.hotel;
    }
  }
  return getPoiCategoryMeta(category);
}

export function renderLucideIconElements(icon: LucideIconData): string {
  return icon
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${String(v)}"`)
        .join(' ');
      return `<${tag} ${attrStr}/>`;
    })
    .join('');
}

export function buildMapBlipSvg(meta: PoiBlipMeta, size = 96): string {
  const inner = renderLucideIconElements(meta.icon);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" shape-rendering="geometricPrecision">
    <defs>
      <radialGradient id="bg-${meta.id}" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stop-color="#2D1A4E"/>
        <stop offset="100%" stop-color="#10081B"/>
      </radialGradient>
    </defs>
    <circle cx="24" cy="24.8" r="21.2" fill="rgba(0,0,0,0.48)"/>
    <circle cx="24" cy="24" r="19.2" fill="url(#bg-${meta.id})" stroke="${meta.color}" stroke-width="2.6"/>
    <circle cx="24" cy="24" r="16.4" fill="none" stroke="#FFF6F8" stroke-opacity="0.16" stroke-width="0.9"/>
    <g transform="translate(12 12)" fill="none" stroke="#FFF6F8" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  </svg>`;
}
