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

export interface PoiBlipShape {
  d: string;
  opacity?: number;
}

export interface PoiBlipMeta {
  id: PoiBlipId;
  color: string;
  bg: string;
  shapes: readonly PoiBlipShape[];
}

export const POI_BLIP_CATALOG: Record<PoiBlipId, PoiBlipMeta> = {
  bar: {
    id: 'bar',
    color: '#FF4FD8',
    bg: 'rgba(255, 79, 216, 0.16)',
    shapes: [
      { d: 'M4 4h16l-7 8.5V19h4v2H7v-2h4v-6.5L4 4z' },
      { d: 'M15 3.5l2.5-1.5.9 1.4-2.1 1.3z', opacity: 0.9 },
    ],
  },
  card: {
    id: 'card',
    color: '#FFB458',
    bg: 'rgba(255, 180, 88, 0.16)',
    shapes: [
      { d: 'M6 2.5h12a1.8 1.8 0 0 1 1.8 1.8v15.4a1.8 1.8 0 0 1-1.8 1.8H6a1.8 1.8 0 0 1-1.8-1.8V4.3A1.8 1.8 0 0 1 6 2.5zm6 4.7c-1.8 2.2-3.8 3.6-3.8 5.4a2.2 2.2 0 0 0 3.2 1.9l-.6 2.1h2.4l-.6-2.1a2.2 2.2 0 0 0 3.2-1.9c0-1.8-2-3.2-3.8-5.4z' },
    ],
  },
  shop: {
    id: 'shop',
    color: '#F44E8F',
    bg: 'rgba(244, 78, 143, 0.16)',
    shapes: [
      { d: 'M7 7V6a5 5 0 0 1 10 0v1h2.5l1.3 13.2a1.5 1.5 0 0 1-1.5 1.6H4.7a1.5 1.5 0 0 1-1.5-1.6L4.5 7H7zm2 0h6V6a3 3 0 0 0-6 0v1z' },
    ],
  },
  story: {
    id: 'story',
    color: '#FFD166',
    bg: 'rgba(255, 209, 102, 0.18)',
    shapes: [
      { d: 'M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 8.9 9.1 8 12 2z' },
    ],
  },
  vehicle: {
    id: 'vehicle',
    color: '#A855F7',
    bg: 'rgba(168, 85, 247, 0.18)',
    shapes: [
      { d: 'M5.5 6.5L7.3 4h9.4l1.8 2.5L21 10v7.5a1.5 1.5 0 0 1-1.5 1.5H18v2h-2.5v-2h-7v2H6v-2H4.5A1.5 1.5 0 0 1 3 17.5V10l2.5-3.5zM7 11.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm10 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM7.6 6L6.4 8.5h11.2L16.4 6H7.6z' },
    ],
  },
  landmark: {
    id: 'landmark',
    color: '#FFA66B',
    bg: 'rgba(255, 166, 107, 0.16)',
    shapes: [
      { d: 'M12 2l2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2z' },
    ],
  },
  easter: {
    id: 'easter',
    color: '#C084FC',
    bg: 'rgba(192, 132, 252, 0.16)',
    shapes: [
      { d: 'M7 10a5 5 0 0 1 10 0c2.8.5 4.5 1.5 4.5 2.7 0 1.7-4.3 3-9.5 3s-9.5-1.3-9.5-3c0-1.2 1.7-2.2 4.5-2.7zM9 17.5l-1.5 3.5h2l1.2-3.2L9 17.5zm6 0l1.5 3.5h-2l-1.2-3.2L15 17.5z' },
    ],
  },
  transport: {
    id: 'transport',
    color: '#60A5FA',
    bg: 'rgba(96, 165, 250, 0.16)',
    shapes: [
      { d: 'M21 15.5v-2l-7.5-4.5V4a1.5 1.5 0 0 0-3 0v5L3 13.5v2l7.5-2.2V19L8 20.5V22l4-1 4 1v-1.5L13.5 19v-5.7l7.5 2.2z' },
    ],
  },
  side: {
    id: 'side',
    color: '#FB923C',
    bg: 'rgba(251, 146, 60, 0.16)',
    shapes: [
      { d: 'M12 3c-3.3 0-5.5 1.9-5.7 5h3.2c.2-1.4 1.1-2.2 2.4-2.2 1.4 0 2.3.8 2.3 2 0 1-.6 1.7-2 2.5-1.7 1-2.2 2.1-2.1 4.2h3.1c0-1.3.4-2 1.7-2.8 1.7-1 2.7-2.2 2.7-4.1C17.6 4.8 15.3 3 12 3zm-1.6 14.2V20.5h3.3v-3.3h-3.3z' },
    ],
  },
  magazine: {
    id: 'magazine',
    color: '#F472B6',
    bg: 'rgba(244, 114, 182, 0.16)',
    shapes: [
      { d: 'M3 5.5c2.8-.8 5.8-.6 8 .8v13c-2.2-1.3-5.2-1.5-8-.7V5.5zm10 .8c2.2-1.4 5.2-1.6 8-.8v13.1c-2.8-.8-5.8-.6-8 .7v-13z' },
    ],
  },
  hotel: {
    id: 'hotel',
    color: '#FF4FD8',
    bg: 'rgba(255, 79, 216, 0.16)',
    shapes: [
      { d: 'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16h-5v-4h-4v4H5zm3-13v2h2.5V8H8zm5.5 0v2H16V8h-2.5zM8 12v2h2.5v-2H8zm5.5 0v2H16v-2h-2.5z' },
    ],
  },
  bank: {
    id: 'bank',
    color: '#4ADE80',
    bg: 'rgba(74, 222, 128, 0.16)',
    shapes: [
      { d: 'M13.2 2.5v2c2.1.4 3.5 1.7 3.7 3.6h-2.7c-.2-.9-.9-1.5-2.1-1.5-1.2 0-1.9.6-1.9 1.4 0 .9.8 1.3 2.7 1.8 2.6.7 4.3 1.7 4.3 4.1 0 2.1-1.5 3.6-4 4v2.1h-2.3v-2.1c-2.4-.4-4-1.8-4.2-4h2.8c.2 1.1 1.1 1.8 2.5 1.8 1.3 0 2.1-.6 2.1-1.5 0-.9-.7-1.4-2.7-1.9-2.5-.7-4.2-1.7-4.2-4 0-2 1.4-3.4 3.7-3.8v-2h2.3z' },
    ],
  },
  meteor: {
    id: 'meteor',
    color: '#FB7185',
    bg: 'rgba(251, 113, 133, 0.16)',
    shapes: [
      { d: 'M19.5 3.5L13 6l1.5 1.5-3.2 2.2A5.5 5.5 0 1 0 14.3 13l2.2-3.3 1.5 1.5 1.5-7.7zm-9 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z' },
    ],
  },
  monument: {
    id: 'monument',
    color: '#FBBF24',
    bg: 'rgba(251, 191, 36, 0.16)',
    shapes: [
      { d: 'M12 2l2.5 4.2L15.8 18H8.2L9.5 6.2L12 2zm-6 17h12v2.5H6V19z' },
    ],
  },
  wellness: {
    id: 'wellness',
    color: '#34D399',
    bg: 'rgba(52, 211, 153, 0.16)',
    shapes: [
      { d: 'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6v-6z' },
    ],
  },
  police: {
    id: 'police',
    color: '#818CF8',
    bg: 'rgba(129, 140, 248, 0.16)',
    shapes: [
      { d: 'M12 2.5L4.5 5.5v6c0 5.1 3.2 8.7 7.5 10 4.3-1.3 7.5-4.9 7.5-10v-6L12 2.5zm0 4.7l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4L12 7.2z' },
    ],
  },
  flamingo: {
    id: 'flamingo',
    color: '#FF6BB5',
    bg: 'rgba(255, 107, 181, 0.16)',
    shapes: [
      { d: 'M14.5 3a2.5 2.5 0 0 0-2.5 2.5c0 1.4.8 2.6.8 4 0 1.3-1 2.2-2.6 2.5C7.6 12.5 6 14 6 15.8c0 1.4 1.3 2.4 3.4 2.4h2.1v3.3h2v-3.5c1.5-.4 2.5-1.4 2.5-2.7 0-1.6-1.4-2.8-2.6-3.7.8-1.4 1.3-3 1.3-4.7 0-.9.5-1.4 1.2-1.4.8 0 1.4.6 1.7 1.4l1.4-.6C18.4 4.2 16.7 3 14.5 3z' },
    ],
  },
  crime: {
    id: 'crime',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.16)',
    shapes: [
      { d: 'M12 3C7.6 3 4 6.2 4 10.2c0 2.4 1.2 4.5 3 5.8V19h2v2h6v-2h2v-3c1.8-1.3 3-3.4 3-5.8C20 6.2 16.4 3 12 3zm-3 8.5a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2zm6 0a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z' },
    ],
  },
  meditation: {
    id: 'meditation',
    color: '#E879F9',
    bg: 'rgba(232, 121, 249, 0.16)',
    shapes: [
      { d: 'M12 4c-2.5 3-3.2 6.2-2 9.2 1.2 1.3 2.8 1.3 4 0 1.2-3 .5-6.2-2-9.2zm-7.5 6c1 3.7 3.3 6.2 6.5 7-1-3-3-5.5-6.5-7zm15 0c-3.5 1.5-5.5 4-6.5 7 3.2-.8 5.5-3.3 6.5-7zM7 18.5h10v2H7v-2z' },
    ],
  },
  weapon: {
    id: 'weapon',
    color: '#F87171',
    bg: 'rgba(248, 113, 113, 0.16)',
    shapes: [
      { d: 'M3 7h17v3.8l-1.6.7H11l-1 4.2H7.6l-.8-3.8-1.5 6.6H3.1L4.6 11H3V7z' },
    ],
  },
  weapon_pro: {
    id: 'weapon_pro',
    color: '#FACC15',
    bg: 'rgba(250, 204, 21, 0.18)',
    shapes: [
      { d: 'M2 10h4.5l1.5-2h7l1.2 2H22v2.4l-5 .6-1.4 3.5h-2.4l.7-3.5H10l-1.5 5H5.8L7 12.8H2V10z' },
    ],
  },
  safehouse: {
    id: 'safehouse',
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.18)',
    shapes: [
      { d: 'M12 3L3 10.5h2.5V20h5v-5.5h3V20h5v-9.5H21L12 3z' },
    ],
  },
  enterable: {
    id: 'enterable',
    color: '#FFB458',
    bg: 'rgba(255, 180, 88, 0.16)',
    shapes: [
      { d: 'M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17h-2.5V5.5h-9V21H5zm4.5 0V7l6 1.8V21h-6zm4-7.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z' },
    ],
  },
  event: {
    id: 'event',
    color: '#FB7185',
    bg: 'rgba(251, 113, 133, 0.16)',
    shapes: [
      { d: 'M13.5 2L5 13h6l-1.5 9L19 11h-6l.5-9z' },
    ],
  },
  nature: {
    id: 'nature',
    color: '#4ADE80',
    bg: 'rgba(74, 222, 128, 0.16)',
    shapes: [
      { d: 'M12 8.5c-2.8-2.6-6.2-2.7-8.5-.7 2.4-.3 4.6.6 6.2 2.2-2.7 0-5 1.3-6.5 3.3 2.1-.6 4.4-.2 6.2.8-.6 2.5-.8 5-.8 6.9h2.8c0-1.8.3-4.3 1-6.9 1.8-1 4.1-1.4 6.2-.8-1.5-2-3.8-3.3-6.5-3.3 1.6-1.6 3.8-2.5 6.2-2.2-2.3-2-5.7-1.9-8.5.7z' },
    ],
  },
  fuel: {
    id: 'fuel',
    color: '#FACC15',
    bg: 'rgba(250, 204, 21, 0.16)',
    shapes: [
      { d: 'M5 4.5A1.5 1.5 0 0 1 6.5 3h7A1.5 1.5 0 0 1 15 4.5V19h1v2H4v-2h1V4.5zm2 1.5v4.5h6V6H7zm10.2 1.2l2.3 2.3V17a1.5 1.5 0 0 1-3 0v-4.5h-1.5v-1.8H18V9l-1.5-1.5.7-.3z' },
    ],
  },
  anchor: {
    id: 'anchor',
    color: '#60A5FA',
    bg: 'rgba(96, 165, 250, 0.16)',
    shapes: [
      { d: 'M12 3a2.3 2.3 0 0 0-1.2 4.3V9H8v2h2.8v6.9A5.5 5.5 0 0 1 6.2 14H4a7.5 7.5 0 0 0 16 0h-2.2a5.5 5.5 0 0 1-4.6 3.9V11H16V9h-2.8V7.3A2.3 2.3 0 0 0 12 3z' },
    ],
  },
  coffee: {
    id: 'coffee',
    color: '#FB923C',
    bg: 'rgba(251, 146, 60, 0.16)',
    shapes: [
      { d: 'M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zm13 1.5h2a2.5 2.5 0 0 1 0 5h-2v-5zM4 19.5h13v1.5H4v-1.5z' },
    ],
  },
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

export function buildMapBlipSvg(meta: PoiBlipMeta): string {
  const paths = meta.shapes
    .map(
      (s) =>
        `<path d="${s.d}" fill="#FFF6F8"${s.opacity !== undefined ? ` fill-opacity="${s.opacity}"` : ''}/>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="21" fill="rgba(0,0,0,0.42)"/>
    <circle cx="24" cy="24" r="19" fill="#120B1E" stroke="${meta.color}" stroke-width="2.8"/>
    <circle cx="24" cy="24" r="15.5" fill="none" stroke="${meta.color}" stroke-opacity="0.28" stroke-width="1"/>
    <g transform="translate(12 12)">${paths}</g>
  </svg>`;
}
