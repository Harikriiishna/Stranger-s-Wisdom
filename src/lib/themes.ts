import type { ThemeMode } from '../types';

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  description: string;
  isDark: boolean | null;
  swatches: [string, string, string];
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'dark',
    label: 'Midnight Sanctuary',
    description: 'Deep midnight navy & cyan light',
    isDark: true,
    swatches: ['#070B19', '#0D1326', '#22D3EE'],
  },
  {
    id: 'liquid-glass',
    label: 'Liquid Glass',
    description: 'Translucent dark glass & aurora depth',
    isDark: true,
    swatches: ['#07182E', '#1E3A5F', '#67E8F9'],
  },
  {
    id: 'frost-glass',
    label: 'Frosted Glass',
    description: 'Luminous daylight glass & soft prism blur',
    isDark: false,
    swatches: ['#E7F2FA', '#FFFFFF', '#0284C7'],
  },
  {
    id: 'ocean-abyss',
    label: 'Ocean Abyss',
    description: 'Deep pelagic slate & tranquil sky blue',
    isDark: true,
    swatches: ['#05111E', '#091E32', '#38BDF8'],
  },
  {
    id: 'nordic-slate',
    label: 'Nordic Slate',
    description: 'Calm fjord charcoal & cool glacial mist',
    isDark: true,
    swatches: ['#0B1218', '#131E27', '#67E8F9'],
  },
  {
    id: 'obsidian-gold',
    label: 'Obsidian & Gold',
    description: 'Pure nocturnal onyx & warm lantern gold',
    isDark: true,
    swatches: ['#050507', '#111217', '#FBBF24'],
  },
  {
    id: 'amber-dusk',
    label: 'Twilight Amber',
    description: 'Warm charcoal plum & lantern gold',
    isDark: true,
    swatches: ['#120B12', '#1C121D', '#F59E0B'],
  },
  {
    id: 'forest-mist',
    label: 'Forest Stillness',
    description: 'Deep pine slate & serene sage',
    isDark: true,
    swatches: ['#071412', '#0D211D', '#2DD4BF'],
  },
  {
    id: 'velvet-violet',
    label: 'Velvet Dusk',
    description: 'Cosmic indigo & lavender aura',
    isDark: true,
    swatches: ['#0E0A1F', '#171230', '#A78BFA'],
  },
  {
    id: 'rose-quartz',
    label: 'Rose Dusk',
    description: 'Nocturnal mulberry & warm blossom',
    isDark: true,
    swatches: ['#180C16', '#251322', '#FB7185'],
  },
  {
    id: 'parchment',
    label: 'Warm Parchment',
    description: 'Soft sepia linen & gentle ink',
    isDark: false,
    swatches: ['#FBF7F0', '#FFFDF9', '#0E7490'],
  },
  {
    id: 'sage-morning',
    label: 'Sage Morning',
    description: 'Botanical celadon & calming eucalyptus',
    isDark: false,
    swatches: ['#F1F6F3', '#FAFDFB', '#0F766E'],
  },
  {
    id: 'terracotta-warm',
    label: 'Sunlit Clay',
    description: 'Warm desert sand & earthy terracotta',
    isDark: false,
    swatches: ['#FAF4EE', '#FFFBF7', '#C2410C'],
  },
  {
    id: 'light',
    label: 'Dawn Paper',
    description: 'Clean morning daylight & slate ink',
    isDark: false,
    swatches: ['#F8FAFC', '#FFFFFF', '#0891B2'],
  },
  {
    id: 'system',
    label: 'Follow System',
    description: 'Adapts automatically to your device',
    isDark: null,
    swatches: ['#070B19', '#F8FAFC', '#22D3EE'],
  },
];

const VALID_THEME_IDS = new Set<string>(THEME_OPTIONS.map((t) => t.id));

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && VALID_THEME_IDS.has(value);
}

export function applyThemeToDocument(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const option = THEME_OPTIONS.find((t) => t.id === mode);
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  const isDark =
    option?.isDark !== null && option?.isDark !== undefined
      ? option.isDark
      : Boolean(prefersDark);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const effectiveTheme =
    mode === 'system' ? (isDark ? 'dark' : 'light') : mode;
  root.dataset.theme = effectiveTheme;
}
