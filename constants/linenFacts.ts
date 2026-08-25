/**
 * Educational, bite-sized facts about linen creation, flax development,
 * fiber physics, and commercial/industrial laundry processing.
 */
export const LINEN_FACTS: readonly string[] = [
  // --- Linen Creation, Fiber Biology & Agriculture ---
  'Flax (Linum usitatissimum) is one of humanity’s oldest cultivated crops, with spun flax fibers discovered dating back over 30,000 years.',
  'Flax is a zero-waste crop: bast fibers become linen, seeds yield linseed oil and nutritious foods, and woody stems make paper and board.',
  'Flax requires virtually zero irrigation and minimal pesticides, making linen one of the most sustainable natural textiles on Earth.',
  'Flax plants are harvested by gently pulling the entire root from the ground, rather than cutting, to preserve full fiber length and tensile strength.',
  'Dew retting uses natural field moisture, morning dew, and beneficial fungi to break down cellular pectins and free the spinnable fibers.',
  'Mechanical scutching shatters and removes the woody stalk, while hackling combs the fibers through steel pins into silky spinnable line.',
  'Linen fibers are natural microscopic hollow tubes that conduct heat 5x faster than wool, giving linen its signature cool-to-the-touch feel.',
  'Unlike most fibers, linen increases in tensile strength by ~20% when wet due to hydrogen bonding within its crystalline cellulose structure.',
  'High natural pectin content means genuine linen softens and gains drape with every wash cycle without losing fiber strength.',
  'Linen can absorb up to 20% of its dry weight in moisture before feeling damp, and it dries significantly faster than cotton.',
  'Natural lignin and silica in flax fibers naturally inhibit bacterial and fungal growth, making linen inherently hypoallergenic.',
  'In ancient Egypt, fine linen was prized as currency and royal shroud—4,000-year-old linen preserved in tombs remains intact today.',
  'The Latin word for flax, linum, is the linguistic origin for everyday words like line, lining, lingerie, and lineage.',
  'Ancient Greek warriors wore the Linothorax—a lightweight combat body armour built from laminated layers of dense linen canvas.',
  'Wet-spinning flax through warm water softens natural pectins, enabling the spinning of ultra-fine, smooth yarns for luxury sheeting.',

  // --- Commercial & Industrial Laundry Processing ---
  'Industrial Continuous Batch Washers (CBWs) process up to 2.5 tonnes of linen per hour using continuous counter-flow water recycling.',
  'Commercial tunnel washers consume only 3 to 4 litres of water per kilogram of linen, compared to 15–20 litres in domestic washing.',
  'Industrial extraction presses apply up to 50 bar (725 psi) of hydraulic pressure onto 50kg linen cakes to dewater them in under 90 seconds.',
  'Multi-roll flatwork ironers glide damp sheets through steam chests heated to 180°C at 50 m/min, drying and ironing in a single pass.',
  'Automated ironer feeders use pneumatic suction and optical sensors to square and tension sheet hems in milliseconds before feeding.',
  'High-speed automated folders measure item dimensions with photocells and execute razor-sharp cross-folds using microsecond air blasts.',
  'AS/NZS 4146 Australian standards require thermal disinfection at 71°C for 3 minutes or 65°C for 10 minutes to eliminate pathogens.',
  'Clean/soiled barrier laundry designs maintain physical wall separation and positive air pressure on the clean side to stop airborne contamination.',
  'Industrial UHF RFID microchips sewn into linen hems withstand 200+ commercial wash cycles and scan hundreds of items per second in bulk cages.',
  'Commercial-grade bed linen is engineered to withstand 150 to 250 industrial wash, press, and iron cycles before retirement.',
  'Commercial poly-cotton blends (e.g. 50/50) combine the breathability and absorbency of natural fibers with the extreme tear strength of polyester.',
  'Wastewater heat recovery systems capture thermal energy from hot wash effluent to preheat incoming water, cutting boiler gas usage by up to 40%.',
  'Fabric density is measured in GSM (Grams per Square Metre)—commercial hotel sheets range from 130–150 GSM, while bath towels average 500–700 GSM.',
  'Mercerisation treats cellulose fibers in a tensioned caustic bath, swelling fiber walls to boost sheen, dye affinity, and tensile strength by 25%.',
  'High-speed flame singeing passes raw woven fabric across micro gas jets to burn off loose surface fuzz, preventing ironer snagging.',
  'Ozone and peracetic acid injection systems achieve hospital-grade disinfection at lower water temperatures, reducing thermal stress on fibers.',
  'Centrifugal lint recovery systems capture airborne textile particulate across drying and ironing lines to maintain clean air and fire safety.',
  'Elmendorf tear tests and tensile testing ensure commercial sheeting maintains structural integrity under high-speed sorting and ironing tension.',
  'Counter-flow wash architecture redirects clean final-rinse water backward through the tunnel washer to pre-wash new incoming soiled loads.',
  'Commercial ironer chests are regularly dressed with high-temperature waxes and nomadic aramid pads to ensure friction-free glide and a pristine finish.',
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
