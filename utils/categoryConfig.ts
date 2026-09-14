import { Hotel, HeartPulse, Pickaxe, Warehouse, Shapes } from 'lucide-react';
import { SpendCategory } from '../types.ts';

export interface CategoryConfig {
  id: SpendCategory;
  label: string;
  shortLabel: string;
  description: string;
  keywords: string[];
  icon: typeof Hotel;
  colors: {
    bg: string;
    text: string;
    border: string;
    activeBg: string;
    activeText: string;
    activeBorder: string;
    hoverBg: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    ring: string;
    dot: string;
  };
}

export const CATEGORY_CONFIGS: Record<SpendCategory, CategoryConfig> = {
  ACCOMMODATION: {
    id: 'ACCOMMODATION',
    label: 'Accommodation',
    shortLabel: 'Accom',
    description: 'Hotels, Resorts & Hospitality',
    keywords: ['Hotel', 'Resort', 'Crown', 'Accor', 'Marriott', 'Hilton', 'Star', 'Oaks'],
    icon: Hotel,
    colors: {
      bg: 'bg-indigo-50/70 dark:bg-indigo-500/10',
      text: 'text-indigo-700 dark:text-indigo-400',
      border: 'border-indigo-200 dark:border-indigo-800/60',
      activeBg: 'bg-indigo-600 dark:bg-indigo-500',
      activeText: 'text-white',
      activeBorder: 'border-indigo-600 dark:border-indigo-500',
      hoverBg: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
      badgeText: 'text-indigo-700 dark:text-indigo-300',
      badgeBorder: 'border-indigo-200 dark:border-indigo-800',
      ring: 'ring-indigo-500/30',
      dot: 'bg-indigo-500',
    },
  },
  HEALTHCARE: {
    id: 'HEALTHCARE',
    label: 'Healthcare',
    shortLabel: 'Health',
    description: 'Hospitals, Clinics & Aged Care',
    keywords: ['Ramsay', 'RHC', 'HSV', 'Health', 'Hospital', 'Clinic', 'Aged Care', 'Gown', 'Scrub'],
    icon: HeartPulse,
    colors: {
      bg: 'bg-purple-50/70 dark:bg-purple-500/10',
      text: 'text-purple-700 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-800/60',
      activeBg: 'bg-purple-600 dark:bg-purple-500',
      activeText: 'text-white',
      activeBorder: 'border-purple-600 dark:border-purple-500',
      hoverBg: 'hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-700',
      badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
      badgeText: 'text-purple-700 dark:text-purple-300',
      badgeBorder: 'border-purple-200 dark:border-purple-800',
      ring: 'ring-purple-500/30',
      dot: 'bg-purple-500',
    },
  },
  MINING: {
    id: 'MINING',
    label: 'Mining',
    shortLabel: 'Mining',
    description: 'Mining Camps, Resources & Remote Sites',
    keywords: ['Civeo', 'Homeground', 'Mining', 'BHP', 'Rio Tinto', 'FMG', 'Camp', 'Sodexo', 'Compass'],
    icon: Pickaxe,
    colors: {
      bg: 'bg-amber-50/70 dark:bg-amber-500/10',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800/60',
      activeBg: 'bg-amber-600 dark:bg-amber-500',
      activeText: 'text-white',
      activeBorder: 'border-amber-600 dark:border-amber-500',
      hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300 dark:hover:border-amber-700',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
      badgeText: 'text-amber-700 dark:text-amber-300',
      badgeBorder: 'border-amber-200 dark:border-amber-800',
      ring: 'ring-amber-500/30',
      dot: 'bg-amber-500',
    },
  },
  LINEN_HUB: {
    id: 'LINEN_HUB',
    label: 'Linen Hub',
    shortLabel: 'Hub',
    description: 'Central Linen Hub & Inventory Holding',
    keywords: ['Linen Hub', 'Holdings', 'Airlie Beach'],
    icon: Warehouse,
    colors: {
      bg: 'bg-teal-50/70 dark:bg-teal-500/10',
      text: 'text-teal-700 dark:text-teal-400',
      border: 'border-teal-200 dark:border-teal-800/60',
      activeBg: 'bg-teal-600 dark:bg-teal-500',
      activeText: 'text-white',
      activeBorder: 'border-teal-600 dark:border-teal-500',
      hoverBg: 'hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300 dark:hover:border-teal-700',
      badgeBg: 'bg-teal-50 dark:bg-teal-950/40',
      badgeText: 'text-teal-700 dark:text-teal-300',
      badgeBorder: 'border-teal-200 dark:border-teal-800',
      ring: 'ring-teal-500/30',
      dot: 'bg-teal-500',
    },
  },
  OTHER: {
    id: 'OTHER',
    label: 'Other',
    shortLabel: 'Other',
    description: 'Special, Custom or Miscellaneous',
    keywords: ['Other', 'Custom', 'Special'],
    icon: Shapes,
    colors: {
      bg: 'bg-slate-100/80 dark:bg-slate-800/40',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      activeBg: 'bg-slate-700 dark:bg-slate-600',
      activeText: 'text-white',
      activeBorder: 'border-slate-700 dark:border-slate-600',
      hoverBg: 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600',
      badgeBg: 'bg-slate-100 dark:bg-slate-800',
      badgeText: 'text-slate-700 dark:text-slate-300',
      badgeBorder: 'border-slate-200 dark:border-slate-700',
      ring: 'ring-slate-500/30',
      dot: 'bg-slate-500',
    },
  },
};

export const CUSTOMER_CATEGORY_OPTIONS: CategoryConfig[] = [
  CATEGORY_CONFIGS.ACCOMMODATION,
  CATEGORY_CONFIGS.HEALTHCARE,
  CATEGORY_CONFIGS.MINING,
  CATEGORY_CONFIGS.LINEN_HUB,
  CATEGORY_CONFIGS.OTHER,
];

export const getCategoryConfig = (id?: string | null): CategoryConfig => {
  if (!id) return CATEGORY_CONFIGS.ACCOMMODATION;
  const upper = id.toUpperCase();
  if (upper in CATEGORY_CONFIGS) {
    return CATEGORY_CONFIGS[upper as SpendCategory];
  }
  return CATEGORY_CONFIGS.OTHER;
};
