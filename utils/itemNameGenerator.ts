
// ── MD SKU Convention (Segment-based positional code) ─────────────────────────
//
// Segments (concatenated, no separator):
//   1. Item Type:     P=Purchase, S=Sale, B=Both (purchase+sale)
//   2. RFID Flag:     R=RFID, L=Non-RFID
//   3. Category:      H=Healthcare, A=Accommodation, LH=LinenHub, CG=COG, DH=DailyHire
//   4. Product Type:  2-char code (SH=Sheet, BT=BathTowel, HT=HandTowel, etc.)
//   5. Size:          Q=Queen, K=King, S=Single, D=Double, F=Full, T=Twin, or blank
//   6. Variety:       01..07 or blank if N/A
//   7. Colour:        1-3 char code (W=White, B=Blue, etc.)
//   8. GSM:           numeric (e.g. 500) or blank
//
// Example: SLASHQ01W500  →  Sale, L(non-RFID), A(Accommodation), SH(Sheet), Q(Queen), 01, W(White), 500gsm

// ── Category codes ─────────────────────────────────────────────────────────────

const CATEGORY_CODE_MAP: Record<string, string> = {
  // Standard codes from spec
  healthcare: 'H',
  'health care': 'H',
  accommodation: 'A',
  linenhub: 'LH',
  'linen hub': 'LH',
  cog: 'CG',
  'customer own goods': 'CG',
  'customer-owned goods': 'CG',
  dailyhire: 'DH',
  'daily hire': 'DH',
  // Additional mapped from item_pool / item_catalog
  mining: 'MN',
  transport: 'TR',
  food: 'FB',
  'food & beverages': 'FB',
  'food and beverages': 'FB',
};

// ── Product type codes ─────────────────────────────────────────────────────────

const PRODUCT_TYPE_MAP: Record<string, string> = {
  // Linen
  sheet: 'SH',
  'bed sheet': 'SH',
  sheets: 'SH',
  'flat sheet': 'FS',
  'fitted sheet': 'FT',
  'duvet cover': 'DC',
  'pillow case': 'PC',
  pillowcase: 'PC',
  'pillow slip': 'PS',
  quilt: 'QC',
  'quilt cover': 'QC',
  blanket: 'BL',
  'bath towel': 'BT',
  'bath sheet': 'BS',
  'hand towel': 'HT',
  'face washer': 'FW',
  facewasher: 'FW',
  washer: 'FW',
  'bath mat': 'BM',
  bathmat: 'BM',
  towel: 'TW',
  robe: 'RB',
  'bath robe': 'RB',
  bathrobe: 'RB',
  // Bedding
  'mattress protector': 'MP',
  'mattress topper': 'MT',
  pillow: 'PL',
  bolster: 'BO',
  // Clothing
  'sleeping bag': 'SB',
  uniform: 'UN',
  shirt: 'SR',
  scrub: 'SC',
  // Table linen
  tablecloth: 'TC', 'table cloth': 'TC',
  'table napkin': 'TN', napkin: 'TN',
  'table runner': 'TK',
  // Pool / gym
  'pool towel': 'PT', 'gym towel': 'GT',
  // Duvet insert
  'duvet insert': 'DI', 'duvet inner': 'DI', 'duvet insert / inner': 'DI',
  // Equipment
  hood: 'HD',
  bag: 'BG',
  container: 'CN',
  tray: 'TY',
  cart: 'CT',
  trolley: 'TL',
};

// ── Size codes ─────────────────────────────────────────────────────────────────

const SIZE_CODE_MAP: Record<string, string> = {
  queen: 'Q',
  king: 'K',
  single: 'S',
  double: 'D',
  full: 'F',
  twin: 'T',
  'king single': 'KS',
  'super king': 'SK',
  standard: 'ST',
  // Generic sizes
  small: '01',
  medium: '02',
  large: '03',
  xlarge: '04',
  'x-large': '04',
  xxlarge: '05',
  'xx-large': '05',
};

// ── Colour codes ───────────────────────────────────────────────────────────────

const COLOUR_CODE_MAP: Record<string, string> = {
  white: 'W',
  offwhite: 'OW',
  'off-white': 'OW',
  cream: 'CR',
  ivory: 'IV',
  ecru: 'EC',
  natural: 'NA',
  black: 'BK',
  grey: 'GY',
  gray: 'GY',
  charcoal: 'CH',
  silver: 'SV',
  red: 'RD',
  burgundy: 'BU',
  maroon: 'MR',
  pink: 'PK',
  coral: 'CO',
  orange: 'OR',
  yellow: 'YE',
  gold: 'GD',
  green: 'GN',
  mint: 'MT',
  teal: 'TL',
  aqua: 'AQ',
  blue: 'BL',
  navy: 'NV',
  purple: 'PU',
  lilac: 'LC',
  brown: 'BR',
  tan: 'TN',
  beige: 'BG',
  sand: 'SD',
  stone: 'ST',
  khaki: 'KH',
};

// ── Noise words for short name generation ─────────────────────────────────────

const SHORT_NAME_NOISE = new Set([
  'grade', 'quality', 'standard', 'premium', 'professional', 'deluxe',
  'series', 'model', 'type', 'style', 'class', 'certified', 'approved',
  'rated', 'compliant', 'genuine', 'original', 'authentic',
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'in', 'of', 'to', 'per', 'by',
  'catalogue', 'catalog',
]);

// ── Parser ─────────────────────────────────────────────────────────────────────

export interface ParsedDescription {
  gsm: number | null;
  dimensions: string | null;
  colour: string | null;
  colourCode: string | null;
  material: string | null;
  productType: string | null;
  productTypeCode: string | null;
  categoryCode: string | null;
  sizeCode: string | null;
  coreWords: string[];
  rawTokens: string[];
}

export function parseDescription(description: string): ParsedDescription {
  const raw = description.trim();
  const lower = raw.toLowerCase();
  const tokens = lower.split(/[\s,/|]+/).filter(Boolean);

  // GSM
  let gsm: number | null = null;
  const gsmMatch = lower.match(/\b(\d+)\s*gsm\b/);
  if (gsmMatch) gsm = parseInt(gsmMatch[1], 10);

  // Dimensions
  let dimensions: string | null = null;
  const dimMatch = lower.match(/\b(\d+)\s*[x×]\s*(\d+)(?:\s*(cm|mm|m|in|inch|inches))?\b/);
  if (dimMatch) {
    const unit = dimMatch[3] ?? 'cm';
    dimensions = `${dimMatch[1]}x${dimMatch[2]}${unit}`;
  }

  // Colour — longest phrase match first, then single word
  let colour: string | null = null;
  let colourCode: string | null = null;
  const sortedColours = Object.keys(COLOUR_CODE_MAP).sort((a, b) => b.length - a.length);
  for (const colName of sortedColours) {
    if (lower.includes(colName)) {
      colour = colName.charAt(0).toUpperCase() + colName.slice(1);
      colourCode = COLOUR_CODE_MAP[colName];
      break;
    }
  }

  // Product type — longest phrase match first
  let productType: string | null = null;
  let productTypeCode: string | null = null;
  const sortedProductTypes = Object.keys(PRODUCT_TYPE_MAP).sort((a, b) => b.length - a.length);
  for (const ptName of sortedProductTypes) {
    if (lower.includes(ptName)) {
      productType = ptName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      productTypeCode = PRODUCT_TYPE_MAP[ptName];
      break;
    }
  }

  // Category — longest phrase match first
  let categoryCode: string | null = null;
  const sortedCategories = Object.keys(CATEGORY_CODE_MAP).sort((a, b) => b.length - a.length);
  for (const catName of sortedCategories) {
    if (lower.includes(catName)) {
      categoryCode = CATEGORY_CODE_MAP[catName];
      break;
    }
  }

  // Size — longest phrase match first
  let sizeCode: string | null = null;
  const sortedSizes = Object.keys(SIZE_CODE_MAP).sort((a, b) => b.length - a.length);
  for (const sizeName of sortedSizes) {
    if (lower.includes(sizeName)) {
      sizeCode = SIZE_CODE_MAP[sizeName];
      break;
    }
  }

  // Material (for short name only)
  const MATERIAL_KEYWORDS: Record<string, string> = {
    '100% cotton': 'Cotton', cotton: 'Cotton', polyester: 'Polyester',
    linen: 'Linen', bamboo: 'Bamboo', microfibre: 'Microfibre',
    microfiber: 'Microfiber', terry: 'Terry', fleece: 'Fleece',
    wool: 'Wool', silk: 'Silk', nylon: 'Nylon', rayon: 'Rayon',
  };
  let material: string | null = null;
  const sortedMaterials = Object.keys(MATERIAL_KEYWORDS).sort((a, b) => b.length - a.length);
  for (const mat of sortedMaterials) {
    if (lower.includes(mat)) {
      material = MATERIAL_KEYWORDS[mat];
      break;
    }
  }

  // Core words for display — strip noise, attributes we already extracted
  const gsmPattern = /^\d+gsm$/;
  const dimPattern = /^\d+[x×]\d+/;
  const numOnlyPattern = /^\d+$/;
  const unitSuffixPattern = /^\d+(cm|mm|m|in|kg|g|ml|l|lb|oz)$/;
  const pctPattern = /^\d+%$/;

  const coreWords = tokens.filter(tok => {
    const clean = tok.replace(/[^a-z]/g, '');
    if (!clean || clean.length < 2) return false;
    if (SHORT_NAME_NOISE.has(clean)) return false;
    if (gsmPattern.test(tok)) return false;
    if (dimPattern.test(tok)) return false;
    if (numOnlyPattern.test(tok)) return false;
    if (unitSuffixPattern.test(tok)) return false;
    if (pctPattern.test(tok)) return false;
    return true;
  });

  return { gsm, dimensions, colour, colourCode, material, productType, productTypeCode, categoryCode, sizeCode, coreWords, rawTokens: tokens };
}

// ── MD SKU Code Generator ──────────────────────────────────────────────────────
//
// Generates a positional code following the MD Proposal:
// [Type][RFID][Category][ProductType][Size][Variety][Colour][GSM]

export interface SkuSegments {
  itemType?: 'P' | 'S' | 'B';  // Purchase / Sale / Both
  rfid?: boolean;
  categoryCode?: string;        // e.g. 'A', 'H', 'LH'
  productTypeCode?: string;     // e.g. 'SH', 'BT'
  sizeCode?: string;            // e.g. 'Q', 'K'
  varietyCode?: string;         // e.g. '01', '02'
  colourCode?: string;          // e.g. 'W', 'BL'
  gsm?: number | null;
}

export function buildItemCode(segments: SkuSegments): string {
  const parts: string[] = [];

  // Seg 1: Item Type
  parts.push(segments.itemType ?? 'B');

  // Seg 2: RFID
  parts.push(segments.rfid ? 'R' : 'L');

  // Seg 3: Category (default to general 'GN' if unknown)
  parts.push(segments.categoryCode ?? 'GN');

  // Seg 4: Product Type (2 chars, default to 'IT' for Item)
  parts.push(segments.productTypeCode ?? 'IT');

  // Seg 5: Size (optional, skip if blank)
  if (segments.sizeCode) parts.push(segments.sizeCode);

  // Seg 6: Variety (optional)
  if (segments.varietyCode) parts.push(segments.varietyCode);

  // Seg 7: Colour (optional)
  if (segments.colourCode) parts.push(segments.colourCode);

  // Seg 8: GSM (optional)
  if (segments.gsm) parts.push(String(segments.gsm));

  return parts.join('').toUpperCase();
}

// Derive SKU segments from free-text description (pre-definition approximation)
export function generateItemCode(
  description: string,
  overrides?: Partial<SkuSegments>
): string {
  if (!description?.trim()) return 'BLGNIT';

  const parsed = parseDescription(description);

  const segments: SkuSegments = {
    itemType: 'B',
    rfid: false,
    categoryCode: parsed.categoryCode ?? undefined,
    productTypeCode: parsed.productTypeCode ?? undefined,
    sizeCode: parsed.sizeCode ?? undefined,
    colourCode: parsed.colourCode ?? undefined,
    gsm: parsed.gsm,
    ...overrides,
  };

  return buildItemCode(segments);
}

// ── Short name generator ───────────────────────────────────────────────────────

export function generateShortName(description: string): string {
  if (!description?.trim()) return '';

  const { gsm, dimensions, colour, material, productType, sizeCode, coreWords } = parseDescription(description);

  const parts: string[] = [];

  if (material) parts.push(material);
  if (productType) {
    parts.push(productType);
  } else {
    // Fall back to first 3 meaningful core words
    const coreDisplay = coreWords.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1));
    parts.push(...coreDisplay);
  }
  if (sizeCode) {
    // Map size code back to readable name for display
    const sizeNames: Record<string, string> = { Q: 'Queen', K: 'King', S: 'Single', D: 'Double', F: 'Full', T: 'Twin', KS: 'King Single' };
    const sizeName = sizeNames[sizeCode];
    if (sizeName) parts.push(sizeName);
  }
  if (gsm) parts.push(`${gsm}gsm`);
  if (colour) parts.push(colour);
  if (dimensions && !sizeCode) parts.push(dimensions);

  const result = [...new Set(parts)].join(' ');
  if (result.length <= 60) return result;
  return result.slice(0, 60).replace(/\s\S*$/, '') || result.slice(0, 60);
}

// ── Search token extractor ─────────────────────────────────────────────────────

export function extractSearchTokens(description: string): string[] {
  if (!description?.trim()) return [];

  const { rawTokens } = parseDescription(description);
  const tokens = new Set<string>();

  for (const tok of rawTokens) {
    const clean = tok.replace(/[^a-z0-9]/g, '');
    if (clean.length >= 3 && !SHORT_NAME_NOISE.has(clean)) {
      tokens.add(clean);
    }
  }

  // Comma-separated segments as whole phrases
  const segments = description.split(/[,|/]+/).map(s => s.trim()).filter(s => s.length >= 3);
  for (const seg of segments) {
    tokens.add(seg.trim());
  }

  return [...tokens];
}
