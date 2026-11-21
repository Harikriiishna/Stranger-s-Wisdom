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
    id: 'parchment',
    label: 'Warm Parchment',
    description: 'Soft sepia linen & gentle ink',
    isDark: false,
    swatches: ['#FBF7F0', '#FFFDF9', '#0E7490'],
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
