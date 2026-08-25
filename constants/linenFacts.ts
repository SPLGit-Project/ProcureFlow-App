/**
 * Educational, bite-sized facts about linen creation, flax development,
 * fiber physics, and commercial/industrial laundry processing.
 */
export const LINEN_FACTS: readonly string[] = [
  // --- Bed Sheets & Sheeting ---
  'Why hotel bed sheets stay smooth: Flax and long-staple cotton are harvested whole-root to preserve extra-long fibers, preventing the broken fiber ends that cause fuzz.',
  'Why commercial bed sheets get softer over time: Unlike synthetic fabrics that break down, natural pectins in cotton and linen relax with every wash turn, making sheets smoother after 50 washes than brand new.',
  'Why damp bed sheets don’t tear in ironers: Natural cellulose fibers gain ~20% more tensile strength when wet, allowing damp hotel sheets to withstand 50 m/min ironer roll tension without snapping.',
  'Why commercial flat sheets dry in under 15 seconds: Industrial flatwork ironers apply 180°C steam heat across multi-roll chests to evaporate moisture, press crisp creases, and sanitise sheets in a single pass.',
  'Why hotel sheets are rated around 140 GSM: 130–150 GSM (Grams per Square Metre) is the industry sweet spot—light enough to feed and dry rapidly through ironers, but dense enough to survive 200+ commercial wash turns.',
  'Why commercial duvet covers use open bag openings: Plastic buttons and zippers shatter under 50-bar extraction presses and 180°C ironers, so industrial hotel duvet covers use buttonless envelope hems.',
  'Why commercial fitted sheets use poly-blend thread: Pure cotton threads would snap after repeated mattress tension, so commercial fitted sheet elastic hems use heavy-duty poly-core stitching to survive 200+ bed changes.',
  'Why hotel flat sheets fold with pinpoint accuracy: High-speed automated folders use photocell optical sensors to measure sheet length down to the millimetre, triggering micro-bursts of air to fold them squarely at full speed.',

  // --- Pillowcases & Table Linen ---
  'Why hotel pillowcases feel naturally cool: Flax and premium cotton fibers are microscopic hollow tubes that conduct heat 5x faster than wool, giving pillowcases their signature crisp, cool-to-the-touch sensation.',
  'Why restaurant napkins hold crisp fold shapes: Dense plain-weave cotton and flax yarns have natural fiber memory when pressed under 180°C steam chests, holding sharp folds for dining table presentation.',
  'Why banquet tablecloths get mercerised: Passing raw tablecloth fabric through a tensioned caustic bath swells fiber walls, giving white restaurant tablecloths their brilliant satin sheen and stain release.',
  'Why commercial tea towels are lint-free: High-speed flame singeing burns off microscopic fuzz from raw woven fabric so restaurant glassware and cutlery dry with zero lint streaks or residue.',
  'Why commercial pillowcases rarely blow out at the seams: Commercial-grade 50/50 poly-cotton pairs cotton breathability with high-tenacity polyester threads to withstand high-pressure extraction presses.',

  // --- Towels, Bath Mats & Hospitality Textiles ---
  'Why plush hotel bath towels absorb water instantly: Ring-spun cotton towel loops use open capillary yarn structures, soaking up over 5x their weight in water before feeling soaked.',
  'Why commercial bath mats are woven denser: Hotel bath mats are engineered at 800+ GSM with double-loop construction to absorb heavy bathroom moisture while providing firm floor grip and slip resistance.',
  'Why hotel towels are dried without fabric softeners: Commercial softeners leave a hydrophobic silicone coating that ruins absorbency; industrial tumbling with moisture-sensor control leaves towels naturally fluffy.',
  'Why pool and spa towels use vat dyeing: Premium pool towels are vat-dyed so intense outdoor UV sunlight, chlorinated pools, and hot wash sanitisation never bleach or fade their color.',

  // --- Healthcare & Barrier Textiles ---
  'Why hospital draw sheets need 71°C thermal wash: AS/NZS 4146 Australian standards require heating wash stages to 71°C for 3 minutes (or 65°C for 10 min) to eliminate 99.999% of hospital bacteria before clean delivery.',
  'Why healthcare laundries use barrier wall separation: Soiled receiving and clean packing zones are split by physical barrier walls with positive air pressure on the clean side to stop airborne cross-contamination.',
  'Why hospital surgical drapes are dyed mist-green: Non-glare surgical green dyes reduce eye fatigue for surgeons under high-intensity operating lights while meeting clinical fluid-barrier standards.',
  'Why patient barrier blankets repel liquids: Specialized microfiber polyester weaves create high surface tension, causing liquid splashes to roll off instantly while locking patient body heat in.',
  'Why hospital incontinence underpads have 3 layers: A brushed polyester top keeps patient skin dry, a dense poly-rayon core traps liquid, and a polyurethane backing stops mattress strike-through.',

  // --- Plant Floor Operations & Machinery ---
  'Why commercial wash batches look like giant pucks: Hydraulic extraction presses apply 50 bar (725 psi) onto 50kg wash batches, squeezing out moisture so tumble dryers use 60% less gas.',
  'Why industrial tunnel washers save millions of litres: Continuous Batch Washers (CBWs) process up to 2.5 tonnes of linen per hour by recycling clean final-rinse water backwards to pre-wash new soiled loads.',
  'Why commercial tunnel washers use only 3–4 litres per kilo: Counter-flow water recycling uses 80% less water than domestic washing machines, which guzzle 15–20 litres per kilogram.',
  'Why laundry roll cages scan 500 items in 3 seconds: Microscopic UHF RFID chips sewn into sheet and towel hems communicate simultaneously with overhead portal antennas for instant dispatch auditing.',
  'Why ironer chests need weekly waxing: Feeding specialised wax cloths through flatwork ironers coats steam chests in high-temp lubricants, keeping hotel sheets gliding smoothly without scorching.',
  'Why laundry plants recycle wastewater heat: Heat exchangers pull thermal energy from drained 60°C wash effluent to preheat incoming cold city water, slashing boiler gas bills by up to 40%.',
  'Why plant dryers use centrifugal lint collectors: High-volume lint recovery systems extract airborne textile dust across drying and ironing lines to protect plant air quality and eliminate fire hazards.',
  'Why QA teams run Elmendorf tear tests: Commercial sheets and pillowcases undergo mechanical tear-testing to ensure fibers retain high tensile strength after 100+ industrial wash cycles.',
  'Why ozone is injected into wash cycles: Dissolved ozone gas breaks down organic stains at cold wash temperatures, saving boiler energy while extending the working lifespan of bed sheets.',
  'Why chefs’ aprons use heavy 220+ GSM drill cotton: Dense twill weave deflects hot oil spatters and resists punctures, while readily releasing grease during heavy-soil tunnel wash cycles.',
];

const SESSION_FACT_KEY = 'pf_session_linen_fact_idx';
const LAST_FACT_KEY = 'pf_last_linen_fact_idx';

/**
 * Returns a random index from LINEN_FACTS, avoiding immediate repeat of the previous index.
 */
export function getRandomLinenFactIndex(excludeIndex?: number): number {
  if (LINEN_FACTS.length <= 1) return 0;
  let nextIndex: number;
  let attempts = 0;
  do {
    nextIndex = Math.floor(Math.random() * LINEN_FACTS.length);
    attempts += 1;
  } while (excludeIndex !== undefined && nextIndex === excludeIndex && LINEN_FACTS.length > 1 && attempts < 10);
  return nextIndex;
}

/**
 * Retrieves the session's randomized linen fact.
 * If not already set in this session (e.g., fresh login or new tab session), selects a random one.
 */
export function getSessionLinenFact(): string {
  try {
    const sessionVal = sessionStorage.getItem(SESSION_FACT_KEY);
    if (sessionVal !== null) {
      const idx = parseInt(sessionVal, 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < LINEN_FACTS.length) {
        return LINEN_FACTS[idx];
      }
    }

    const lastVal = localStorage.getItem(LAST_FACT_KEY);
    const lastIdx = lastVal !== null ? parseInt(lastVal, 10) : undefined;
    const newIdx = getRandomLinenFactIndex(Number.isNaN(lastIdx) ? undefined : lastIdx);

    sessionStorage.setItem(SESSION_FACT_KEY, String(newIdx));
    localStorage.setItem(LAST_FACT_KEY, String(newIdx));
    return LINEN_FACTS[newIdx];
  } catch {
    const fallbackIdx = Math.floor(Math.random() * LINEN_FACTS.length);
    return LINEN_FACTS[fallbackIdx];
  }
}

/**
 * Resets the current session fact so a new random fact is picked on next access/login.
 */
export function resetSessionLinenFact(): void {
  try {
    sessionStorage.removeItem(SESSION_FACT_KEY);
  } catch {
    // Ignore storage restrictions
  }
}
