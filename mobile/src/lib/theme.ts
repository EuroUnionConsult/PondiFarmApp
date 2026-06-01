export const colors = {
  // Backgrounds
  background:   '#F0F4F8',
  surface:      '#FFFFFF',
  surfaceHigh:  '#F8FAFC',

  // Brand
  primary:      '#059669',
  primaryDark:  '#047857',
  primaryLight: 'rgba(5,150,105,0.10)',

  secondary:    '#0284C7',
  secondaryLight: 'rgba(2,132,199,0.10)',

  warning:      '#D97706',
  warningLight: 'rgba(217,119,6,0.10)',

  danger:       '#DC2626',
  dangerLight:  'rgba(220,38,38,0.10)',

  // Text
  text:         '#0F172A',
  textMuted:    '#64748B',
  textDim:      '#94A3B8',

  // Borders & dividers
  border:       '#E2E8F0',
  borderActive: 'rgba(5,150,105,0.35)',

  // Shadows (used inline)
  shadow:       '#64748B',

  overlay:      'rgba(15,23,42,0.45)',
};

// iOS HIG token set — used by Home redesign (Liquid Health direction).
// Scoped namespace so legacy screens keep the original `colors` palette
// until each screen is migrated.
export const ios = {
  // System backgrounds
  systemBackground:                '#FFFFFF',
  systemGroupedBackground:         '#F2F2F7',
  secondarySystemGroupedBackground:'#FFFFFF',
  tertiarySystemGroupedBackground: '#F2F2F7',

  // Labels
  label:           '#000000',
  secondaryLabel:  '#3C3C43',
  tertiaryLabel:   'rgba(60,60,67,0.6)',
  quaternaryLabel: 'rgba(60,60,67,0.3)',

  // Separators
  separator:       'rgba(60,60,67,0.29)',
  opaqueSeparator: '#C6C6C8',

  // PondiFarm accent — sage (NOT Tailwind emerald)
  accent:      '#5F8068',
  accentLight: 'rgba(95,128,104,0.12)',
  accentDark:  '#4A6452',

  // System colors (iOS HIG)
  systemRed:    '#FF3B30',
  systemGreen:  '#34C759',
  systemBlue:   '#007AFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  display: 36,
};

export const shadow = {
  sm: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
};
