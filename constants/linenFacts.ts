/**
 * Educational, bite-sized Q&A facts about linen creation, fabric engineering,
 * and commercial/industrial laundry processing.
 */
export interface LaundryInsight {
  question: string;
  answer: string;
}

export const LAUNDRY_INSIGHTS: readonly LaundryInsight[] = [
  // --- Bed Sheets & Sheeting ---
  {
    question: 'Why do hotel bed sheets stay smooth without pilling?',
    answer: 'Flax and long-staple cotton are harvested whole-root to keep fiber strands long, preventing the frayed fiber ends that cause fuzz.',
  },
  {
    question: 'Why do commercial bed sheets get softer over time?',
    answer: 'Unlike synthetic fabrics that degrade, natural pectins in cotton and linen relax with every wash turn, making sheets smoother after 50 washes than brand new.',
  },
  {
    question: "Why don't damp bed sheets tear in high-speed ironers?",
    answer: 'Natural cellulose fibers gain ~20% more tensile strength when wet, allowing damp sheets to easily withstand 50 m/min ironer roll tension without snapping.',
  },
  {
    question: 'How do commercial flat sheets dry in under 15 seconds?',
    answer: 'Multi-roll flatwork ironers apply 180°C steam heat across polished chests to evaporate moisture, press sharp creases, and sanitise sheets in a single pass.',
  },
  {
    question: 'Why are hotel bed sheets typically rated around 140 GSM?',
    answer: '130–150 GSM (Grams per Square Metre) is the sweet spot—light enough to feed and dry rapidly through ironers, but dense enough to survive 200+ commercial wash turns.',
  },
  {
    question: 'Why do commercial duvet covers use buttonless envelope hems?',
    answer: 'Plastic buttons and zippers shatter under 50-bar extraction presses and 180°C ironers, so commercial hotel linen uses open bag hems.',
  },
  {
    question: 'Why do commercial fitted sheets use heavy poly-core stitching?',
    answer: 'Pure cotton threads snap under repeated mattress stretching, so commercial elastic corners use heavy-duty poly-core threads to survive 200+ bed changes.',
  },
  {
    question: 'How do automated ironer folders achieve razor-sharp sheet folds?',
    answer: 'Photocell optical sensors measure sheet length to the millimetre, triggering microsecond pulsed air blasts to execute perfect cross-folds at full speed.',
  },

  // --- Pillowcases & Table Linen ---
  {
    question: 'Why do hotel pillowcases feel naturally cool to the touch?',
    answer: 'Flax and premium cotton fibers are microscopic hollow tubes that conduct heat 5x faster than wool, dissipating body warmth instantly.',
  },
  {
    question: 'Why do restaurant napkins hold crisp fold shapes?',
    answer: 'Dense plain-weave cotton and flax yarns have natural fiber memory when pressed under 180°C steam chests, holding sharp folds for dining tables.',
  },
  {
    question: 'Why are banquet tablecloths mercerised during production?',
    answer: 'Passing raw tablecloth fabric through a tensioned caustic bath swells fiber walls, giving white restaurant tablecloths a glossy satin finish and easy stain release.',
  },
  {
    question: 'Why are commercial tea towels lint-free?',
    answer: 'High-speed flame singeing burns away loose surface fuzz from raw woven fabric so restaurant glassware dries with zero lint streaks.',
  },
  {
    question: 'Why do commercial pillowcases rarely blow out at the seams?',
    answer: 'Commercial-grade 50/50 poly-cotton pairs breathable cotton with high-tenacity polyester filaments that withstand 50-bar hydraulic extraction presses.',
  },

  // --- Towels, Bath Mats & Hospitality Textiles ---
  {
    question: 'Why do plush hotel bath towels absorb water instantly?',
    answer: 'Ring-spun cotton towel loops use open capillary yarn structures, soaking up over 5x their weight in water before feeling damp.',
  },
  {
    question: 'Why are hotel bath mats woven much denser than towels?',
    answer: 'Commercial bath mats are engineered at 800+ GSM with double-loop construction to absorb heavy bathroom floor moisture and prevent slips.',
  },
  {
    question: 'Why are commercial towels dried without fabric softeners?',
    answer: 'Chemical softeners leave a silicone coating that ruins absorbency; industrial tumbling with precision humidity sensors leaves towels naturally fluffy.',
  },
  {
    question: 'Why do pool and resort towels use vat dyeing?',
    answer: 'Vat-dyed yarns lock colour into the fiber core so intense outdoor UV sun, chlorinated pools, and high-temp wash sanitisation never bleach or fade the towel.',
  },

  // --- Healthcare & Barrier Textiles ---
  {
    question: 'Why must hospital draw sheets be washed at 71°C?',
    answer: 'AS/NZS 4146 Australian standards require thermal disinfection at 71°C for 3 minutes (or 65°C for 10 min) to eliminate 99.999% of hospital pathogens.',
  },
  {
    question: 'Why do healthcare laundries use barrier wall separation?',
    answer: 'Soiled receiving and clean packing areas are physically separated with positive air pressure on the clean side to stop airborne cross-contamination.',
  },
  {
    question: 'Why are hospital surgical drapes dyed mist-green or ceil-blue?',
    answer: 'Non-glare surgical dyes reduce eye strain for surgeons under high-intensity operating theatre lights while meeting fluid-barrier standards.',
  },
  {
    question: 'How do patient barrier blankets repel liquids?',
    answer: 'Dense microfiber polyester weaves create high surface tension, causing spilled fluids to bead and roll off while trapping patient warmth.',
  },
  {
    question: 'Why do commercial reusable underpads have 3 distinct layers?',
    answer: 'A brushed polyester top keeps patient skin dry, a dense needle-punch core locks fluid, and a polyurethane backing stops mattress strike-through.',
  },

  // --- Plant Floor Operations & Machinery ---
  {
    question: 'Why do commercial wash loads emerge as giant compressed cakes?',
    answer: 'Hydraulic extraction presses apply 50 bar (725 psi) onto 50kg wash batches, squeezing out moisture so tumble dryers use 60% less gas.',
  },
  {
    question: 'How do industrial tunnel washers save millions of litres of water?',
    answer: 'Continuous Batch Washers (CBWs) process 2.5 tonnes/hr by recycling clean final-rinse water backward to pre-wash incoming soiled loads.',
  },
  {
    question: 'How much water does a commercial tunnel washer use per kilo of linen?',
    answer: 'Counter-flow recycling uses just 3 to 4 litres per kilogram, compared to domestic washing machines that use 15 to 20 litres per kilo.',
  },
  {
    question: 'How do laundry roll cages scan 500 items in 3 seconds?',
    answer: 'Microscopic UHF RFID chips sewn into linen hems communicate simultaneously with overhead portal antennas for instant dispatch and count auditing.',
  },
  {
    question: 'Why do flatwork ironer chests need weekly waxing cloths?',
    answer: 'Feeding wax cloths through ironers coats the steam chests with high-temp lubricants, keeping hotel sheets gliding smoothly without friction or scorch marks.',
  },
  {
    question: 'How do commercial laundries recycle wastewater heat?',
    answer: 'Heat exchangers pull thermal energy from drained 60°C wash effluent to preheat incoming cold fresh water, cutting boiler gas bills by up to 40%.',
  },
  {
    question: 'Why do plant tumble dryers use centrifugal lint collectors?',
    answer: 'High-volume lint recovery systems trap airborne textile dust across drying lines, protecting plant air quality and eliminating duct fire risks.',
  },
  {
    question: 'Why do quality labs run Elmendorf tear tests on linen?',
    answer: 'Tear-testing verifies that bed sheets and pillowcases retain sufficient tensile strength after 100+ industrial wash cycles before reaching retirement.',
  },
  {
    question: 'Why is ozone gas injected into wash water?',
    answer: 'Dissolved ozone breaks down organic stains and sanitises at colder water temperatures, reducing thermal shock and extending linen lifespan.',
  },
  {
    question: "Why are chefs' jackets and aprons made of heavy 220+ GSM drill cotton?",
    answer: 'Dense twill weave deflects hot oil spatters and resists punctures, while releasing embedded grease readily during heavy-soil tunnel wash cycles.',
  },
];

const SESSION_FACT_KEY = 'pf_session_linen_fact_idx';
const LAST_FACT_KEY = 'pf_last_linen_fact_idx';

/**
 * Returns a random index from LAUNDRY_INSIGHTS, avoiding immediate repeat of the previous index.
 */
export function getRandomLaundryInsightIndex(excludeIndex?: number): number {
  if (LAUNDRY_INSIGHTS.length <= 1) return 0;
  let nextIndex: number;
  let attempts = 0;
  do {
    nextIndex = Math.floor(Math.random() * LAUNDRY_INSIGHTS.length);
    attempts += 1;
  } while (excludeIndex !== undefined && nextIndex === excludeIndex && LAUNDRY_INSIGHTS.length > 1 && attempts < 10);
  return nextIndex;
}

/**
 * Retrieves the session's randomized LaundryInsight object.
 */
export function getSessionLaundryInsight(): LaundryInsight {
  try {
    const sessionVal = sessionStorage.getItem(SESSION_FACT_KEY);
    if (sessionVal !== null) {
      const idx = parseInt(sessionVal, 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < LAUNDRY_INSIGHTS.length) {
        return LAUNDRY_INSIGHTS[idx];
      }
    }

    const lastVal = localStorage.getItem(LAST_FACT_KEY);
    const lastIdx = lastVal !== null ? parseInt(lastVal, 10) : undefined;
    const newIdx = getRandomLaundryInsightIndex(Number.isNaN(lastIdx) ? undefined : lastIdx);

    sessionStorage.setItem(SESSION_FACT_KEY, String(newIdx));
    localStorage.setItem(LAST_FACT_KEY, String(newIdx));
    return LAUNDRY_INSIGHTS[newIdx];
  } catch {
    const fallbackIdx = Math.floor(Math.random() * LAUNDRY_INSIGHTS.length);
    return LAUNDRY_INSIGHTS[fallbackIdx];
  }
}

/**
 * Formats a LaundryInsight object as a combined Q&A string.
 */
export function formatLaundryInsight(insight: LaundryInsight): string {
  return `Q: ${insight.question}\nA: ${insight.answer}`;
}

/**
 * Resets the current session fact so a new random fact is picked on next access/login.
 */
export function resetSessionLaundryInsight(): void {
  try {
    sessionStorage.removeItem(SESSION_FACT_KEY);
  } catch {
    // Ignore storage restrictions
  }
}

// Backward compatibility exports
export const LINEN_FACTS = LAUNDRY_INSIGHTS.map(item => `${item.question} ${item.answer}`);
export const getSessionLinenFact = (): string => formatLaundryInsight(getSessionLaundryInsight());
export const resetSessionLinenFact = resetSessionLaundryInsight;
