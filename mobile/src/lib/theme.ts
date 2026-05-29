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
