
// ── Colour vocabulary ──────────────────────────────────────────────────────────

const COLOUR_MAP: Record<string, string> = {
  white: 'WHT', black: 'BLK', grey: 'GRY', gray: 'GRY', red: 'RED',
  blue: 'BLU', navy: 'NVY', green: 'GRN', yellow: 'YLW', orange: 'ORG',
  pink: 'PNK', purple: 'PRP', brown: 'BRN', beige: 'BGE', ivory: 'IVY',
  cream: 'CRM', silver: 'SLV', gold: 'GLD', tan: 'TAN', teal: 'TEL',
  aqua: 'AQA', maroon: 'MRN', khaki: 'KHK', coral: 'CRL', mint: 'MNT',
  lilac: 'LLC', charcoal: 'CHL', sand: 'SND', stone: 'STN', natural: 'NAT',
  ecru: 'ECR', burgundy: 'BRG', 'off-white': 'OFW', offwhite: 'OFW',
};

const COLOUR_NAMES = new Set(Object.keys(COLOUR_MAP));

// ── Material vocabulary ────────────────────────────────────────────────────────

const MATERIAL_MAP: Record<string, string> = {
  cotton: 'COT', polyester: 'POL', poly: 'POL', linen: 'LIN', wool: 'WOL',
  silk: 'SLK', bamboo: 'BAM', nylon: 'NYL', rayon: 'RAY', viscose: 'VIS',
  microfiber: 'MCF', microfibre: 'MCF', terry: 'TRY', flannel: 'FLN',
  fleece: 'FLC', velvet: 'VLV', satin: 'SAT', percale: 'PRC', jersey: 'JRS',
  twill: 'TWL', canvas: 'CNV', denim: 'DNM', leather: 'LTH', mesh: 'MSH',
  rubber: 'RBR', foam: 'FOM', glass: 'GLS', ceramic: 'CRM', metal: 'MTL',
  steel: 'STL', aluminum: 'ALU', aluminium: 'ALU', plastic: 'PLS',
  paper: 'PPR', cardboard: 'CBD', wood: 'WOD', bamboo_alt: 'BAM',
  spandex: 'SPX', lycra: 'LYC', acrylic: 'ACR',
};

const MATERIAL_NAMES = new Set(Object.keys(MATERIAL_MAP));

// ── Noise words to strip from short names ──────────────────────────────────────

const NOISE_WORDS = new Set([
  'grade', 'quality', 'standard', 'premium', 'professional', 'deluxe',
  'series', 'model', 'type', 'style', 'class', 'brand', 'certified',
  'approved', 'rated', 'compliant', 'genuine', 'original', 'authentic',
  'ultra', 'super', 'extra', 'heavy', 'light', 'medium', 'fine', 'coarse',
  'duty', 'weight', 'the', 'a', 'an', 'and', 'or', 'for', 'with', 'in',
  'of', 'to', 'per', 'by',
]);

// ── Parser ─────────────────────────────────────────────────────────────────────

export interface ParsedDescription {
  gsm: number | null;
  dimensions: string | null;
  colour: string | null;
  material: string | null;
  coreWords: string[];
  rawTokens: string[];
}

export function parseDescription(description: string): ParsedDescription {
  const raw = description.trim();
  const lower = raw.toLowerCase();
  const tokens = lower.split(/[\s,/|]+/).filter(Boolean);

  // Extract GSM  (e.g. "500gsm", "500 gsm")
  let gsm: number | null = null;
  const gsmMatch = lower.match(/\b(\d+)\s*gsm\b/);
  if (gsmMatch) gsm = parseInt(gsmMatch[1], 10);

  // Extract dimensions (e.g. "70x140", "70 x 140cm", "70×140")
  let dimensions: string | null = null;
  const dimMatch = lower.match(/\b(\d+)\s*[x×]\s*(\d+)(?:\s*(cm|mm|m|in|inch|inches))?\b/);
  if (dimMatch) {
    const unit = dimMatch[3] ?? 'cm';
    dimensions = `${dimMatch[1]}x${dimMatch[2]}${unit}`;
  } else {
    // Single dimension (e.g. "70cm")
    const singleDim = lower.match(/\b(\d+)\s*(cm|mm|m|in|inch)\b/);
    if (singleDim) dimensions = `${singleDim[1]}${singleDim[2]}`;
  }

  // Extract colour
  let colour: string | null = null;
  for (const tok of tokens) {
    const clean = tok.replace(/[^a-z-]/g, '');
    if (COLOUR_NAMES.has(clean)) {
      colour = clean.charAt(0).toUpperCase() + clean.slice(1);
      break;
    }
  }

  // Extract material (first material word found)
  let material: string | null = null;
  for (const tok of tokens) {
    const clean = tok.replace(/[^a-z]/g, '');
    if (MATERIAL_NAMES.has(clean)) {
      material = clean.charAt(0).toUpperCase() + clean.slice(1);
      break;
    }
  }

  // Core words: strip noise, gsm tokens, dimension tokens, colour, material
  const gsmPattern = /^\d+gsm$/;
  const dimPattern = /^\d+[x×]\d+/;
  const numOnlyPattern = /^\d+$/;
  const unitSuffixPattern = /^\d+(cm|mm|m|in|kg|g|ml|l|lb|oz)$/;

  const coreWords = tokens.filter(tok => {
    const clean = tok.replace(/[^a-z]/g, '');
    if (!clean || clean.length < 2) return false;
    if (NOISE_WORDS.has(clean)) return false;
    if (COLOUR_NAMES.has(clean)) return false;
    if (MATERIAL_NAMES.has(clean)) return false;
    if (gsmPattern.test(tok)) return false;
    if (dimPattern.test(tok)) return false;
    if (numOnlyPattern.test(tok)) return false;
    if (unitSuffixPattern.test(tok)) return false;
    return true;
  });

  return { gsm, dimensions, colour, material, coreWords, rawTokens: tokens };
}

// ── Short name generator ───────────────────────────────────────────────────────

export function generateShortName(description: string): string {
  if (!description?.trim()) return '';

  const { gsm, dimensions, colour, material, coreWords } = parseDescription(description);

  // Build: [Material] [Core words] [GSM] [Colour] [Dimensions]
  const parts: string[] = [];

  if (material) parts.push(material);

  // Include first 4 meaningful core words (title-cased)
  const coreDisplay = coreWords.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1));
  parts.push(...coreDisplay);

  if (gsm) parts.push(`${gsm}gsm`);
  if (colour) parts.push(colour);
  if (dimensions) parts.push(dimensions);

  const result = [...new Set(parts)].join(' ');
  // Trim to 60 chars at a word boundary
  if (result.length <= 60) return result;
  const trimmed = result.slice(0, 60).replace(/\s\S*$/, '');
  return trimmed || result.slice(0, 60);
}

// ── Item code generator ────────────────────────────────────────────────────────

function abbreviate(word: string, length: number): string {
  return word.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);
}

export function generateItemCode(description: string): string {
  if (!description?.trim()) return 'ITEM';

  const { gsm, dimensions, colour, material, coreWords } = parseDescription(description);

  // Segment 1: material abbreviation (if found)
  const matPart = material ? MATERIAL_MAP[material.toLowerCase()] : null;

  // Segment 2: core noun abbreviation — first 1-3 core words, 2-3 chars each
  const nounPart = coreWords.slice(0, 3).map(w => abbreviate(w, 2)).join('');

  // Segment 3: numeric attribute (GSM or dimensions)
  let attrPart: string | null = null;
  if (gsm) {
    attrPart = `${gsm}`;
  } else if (dimensions) {
    // Compact: 70x140cm → 70X140
    attrPart = dimensions.toUpperCase().replace('CM', '').replace('MM', 'M');
  }

  // Segment 4: colour abbreviation
  const colPart = colour ? COLOUR_MAP[colour.toLowerCase()] : null;

  // Assemble with dashes, drop empty segments
  const segments = [matPart ?? nounPart, matPart ? nounPart : null, attrPart, colPart].filter(Boolean) as string[];
  const code = segments.join('-');

  // Trim to 20 chars, strip trailing dash
  return code.slice(0, 20).replace(/-+$/, '') || 'ITEM';
}

// ── Search token extractor ─────────────────────────────────────────────────────

export function extractSearchTokens(description: string): string[] {
  if (!description?.trim()) return [];

  const { rawTokens } = parseDescription(description);

  const tokens = new Set<string>();

  // Include meaningful tokens ≥ 3 chars, non-noise
  for (const tok of rawTokens) {
    const clean = tok.replace(/[^a-z0-9]/g, '');
    if (clean.length >= 3 && !NOISE_WORDS.has(clean)) {
      tokens.add(clean);
    }
  }

  // Also include comma-separated segments as whole phrases
  const segments = description.split(/[,|/]+/).map(s => s.trim()).filter(s => s.length >= 3);
  for (const seg of segments) {
    tokens.add(seg.trim());
  }

  return [...tokens];
}
