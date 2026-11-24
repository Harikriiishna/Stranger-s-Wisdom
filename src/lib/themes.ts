import type { ThemeMode } from '../types';

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  description: string;
  isDark: boolean | null;
  swatches: [string, string, string];
  gradient?: string;
  themeColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'social-pulse',
    label: 'Social Pulse',
    description: 'Vibrant coral rose, violet & sky social feed',
    isDark: true,
    swatches: ['#090B14', '#E11D48', '#38BDF8'],
    gradient: 'linear-gradient(135deg, #E11D48 0%, #9333EA 100%)',
    themeColor: '#090B14',
  },
  {
    id: 'social-daylight',
    label: 'Social Daylight',
    description: 'Crisp bright feed with rose & royal blue',
    isDark: false,
    swatches: ['#F6F8FC', '#E11D48', '#2563EB'],
    gradient: 'linear-gradient(135deg, #E11D48 0%, #2563EB 100%)',
    themeColor: '#F6F8FC',
  },
  {
    id: 'social-aurora',
    label: 'Aurora Pop',
    description: 'Sunset magenta, warm amber & berry depth',
    isDark: true,
    swatches: ['#13091F', '#DB2777', '#F59E0B'],
    gradient: 'linear-gradient(135deg, #DB2777 0%, #EA580C 100%)',
    themeColor: '#13091F',
  },
  {
    id: 'social-sky',
    label: 'Skyline Feed',
    description: 'Electric sapphire, vivid cyan & iris glow',
    isDark: true,
    swatches: ['#071124', '#2563EB', '#06B6D4'],
    gradient: 'linear-gradient(135deg, #2563EB 0%, #0891B2 100%)',
    themeColor: '#071124',
  },
  {
    id: 'liquid-glass',
    label: 'Liquid Glass',
    description: 'Translucent dark glass & aurora depth',
    isDark: true,
    swatches: ['#07182E', '#1E3A5F', '#67E8F9'],
    themeColor: '#061326',
  },
  {
    id: 'frost-glass',
    label: 'Frosted Glass',
    description: 'Luminous daylight glass & soft prism blur',
    isDark: false,
    swatches: ['#E7F2FA', '#FFFFFF', '#0284C7'],
    themeColor: '#EAF3FB',
  },
  {
    id: 'dark',
    label: 'Midnight Sanctuary',
    description: 'Deep midnight navy & cyan light',
    isDark: true,
    swatches: ['#070B19', '#0D1326', '#22D3EE'],
    themeColor: '#070B19',
  },
  {
    id: 'ocean-abyss',
    label: 'Ocean Abyss',
    description: 'Deep pelagic slate & tranquil sky blue',
    isDark: true,
    swatches: ['#05111E', '#091E32', '#38BDF8'],
    themeColor: '#05111E',
  },
  {
    id: 'nordic-slate',
    label: 'Nordic Slate',
    description: 'Calm fjord charcoal & cool glacial mist',
    isDark: true,
    swatches: ['#0B1218', '#131E27', '#67E8F9'],
    themeColor: '#0B1218',
  },
  {
    id: 'obsidian-gold',
    label: 'Obsidian & Gold',
    description: 'Pure nocturnal onyx & warm lantern gold',
    isDark: true,
    swatches: ['#050507', '#111217', '#FBBF24'],
    themeColor: '#050507',
  },
  {
    id: 'amber-dusk',
    label: 'Twilight Amber',
    description: 'Warm charcoal plum & lantern gold',
    isDark: true,
    swatches: ['#120B12', '#1C121D', '#F59E0B'],
    themeColor: '#120B12',
  },
  {
    id: 'forest-mist',
    label: 'Forest Stillness',
    description: 'Deep pine slate & serene sage',
    isDark: true,
    swatches: ['#071412', '#0D211D', '#2DD4BF'],
    themeColor: '#071412',
  },
  {
    id: 'velvet-violet',
    label: 'Velvet Dusk',
    description: 'Cosmic indigo & lavender aura',
    isDark: true,
    swatches: ['#0E0A1F', '#171230', '#A78BFA'],
    themeColor: '#0E0A1F',
  },
  {
    id: 'rose-quartz',
    label: 'Rose Dusk',
    description: 'Nocturnal mulberry & warm blossom',
    isDark: true,
    swatches: ['#180C16', '#251322', '#FB7185'],
    themeColor: '#180C16',
  },
  {
    id: 'parchment',
    label: 'Warm Parchment',
    description: 'Soft sepia linen & gentle ink',
    isDark: false,
    swatches: ['#FBF7F0', '#FFFDF9', '#0E7490'],
    themeColor: '#FBF7F0',
  },
  {
    id: 'sage-morning',
    label: 'Sage Morning',
    description: 'Botanical celadon & calming eucalyptus',
    isDark: false,
    swatches: ['#F1F6F3', '#FAFDFB', '#0F766E'],
    themeColor: '#F1F6F3',
  },
  {
    id: 'terracotta-warm',
    label: 'Sunlit Clay',
    description: 'Warm desert sand & earthy terracotta',
    isDark: false,
    swatches: ['#FAF4EE', '#FFFBF7', '#C2410C'],
    themeColor: '#FAF4EE',
  },
  {
    id: 'light',
    label: 'Dawn Paper',
    description: 'Clean morning daylight & slate ink',
    isDark: false,
    swatches: ['#F8FAFC', '#FFFFFF', '#0891B2'],
    themeColor: '#F8FAFC',
  },
  {
    id: 'system',
    label: 'Follow System',
    description: 'Adapts automatically to your device',
    isDark: null,
    swatches: ['#090B14', '#F6F8FC', '#E11D48'],
    themeColor: '#090B14',
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
    mode === 'system' ? (isDark ? 'social-pulse' : 'social-daylight') : mode;
  root.dataset.theme = effectiveTheme;

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    const resolvedOption = THEME_OPTIONS.find((t) => t.id === effectiveTheme);
    if (resolvedOption?.themeColor) {
      metaThemeColor.setAttribute('content', resolvedOption.themeColor);
    }
  }
}
