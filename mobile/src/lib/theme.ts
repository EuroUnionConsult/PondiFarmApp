export const colors = {
  // Backgrounds
  background:   '#F0F4F8',
  surface:      '#FFFFFF',
  surfaceHigh:  '#F8FAFC',

  // Brand — paleta oficial «PondiFarm · Identidade visual v1.0» (EUC, 17/10/2026)
  primary:      '#1B3A57',   // azul-noite — animal · tecnologia
  primaryDark:  '#132A40',
  primaryLight: 'rgba(27,58,87,0.10)',

  secondary:    '#2D7D46',   // verde — marca · scan
  secondaryLight: 'rgba(45,125,70,0.10)',

  highlight:    '#C2611F',   // laranja — ponto de medição
  highlightLight: 'rgba(194,97,31,0.12)',

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
  borderActive: 'rgba(45,125,70,0.35)',

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

  // PondiFarm accent — verde da marca (Identidade visual v1.0). 5,08:1 sobre
  // branco: passa AA para texto pequeno (o verde anterior, #2F9E44, dava 3,45:1).
  accent:      '#2D7D46',
  accentLight: 'rgba(45,125,70,0.12)',
  accentDark:  '#22603A',
  accentSupport: '#3E9A5C', // verde claro — só apoio/gráficos, 3,51:1 não serve para texto
  // Verde para texto/ícones sobre superfícies escuras (HUD do scan sobre a câmara):
  // o verde da marca dá só 3,36:1 sobre o vidro escuro; este dá 7,6:1.
  accentOnDark: '#5CC17E',

  // Âncoras de marca: azul-noite, azul médio (facetas da malha) e laranja (medição).
  navy:        '#1B3A57',
  navyLight:   'rgba(27,58,87,0.10)',
  navyMid:     '#2C5B82',
  // Laranja a 4,18:1 sobre branco: ícones, selos e destaques; nunca texto pequeno.
  // Para texto use `orangeText`, a mesma cor escurecida (6,07:1).
  orange:      '#C2611F',
  orangeLight: 'rgba(194,97,31,0.12)',
  orangeText:  '#9C4C16',

  // System colors (iOS HIG)
  systemRed:    '#FF3B30',
  systemGreen:  '#34C759',
  systemBlue:   '#007AFF',
};

// Liquid Glass — superfícies de vidro fosco (usar com BlurView/GlassSurface).
// `tint` = intensidade do material do expo-blur; `fill`/`border` = camadas por cima.
export const glass = {
  // Vidro claro (sobre fundos claros): cards, nav.
  light: {
    tint: 'light' as const,
    intensity: 40,
    fill: 'rgba(255,255,255,0.55)',
    fillStrong: 'rgba(255,255,255,0.70)',   // superfícies densas em texto (hero/cards)
    border: 'rgba(255,255,255,0.65)',
  },
  // Vidro escuro/navy (sobre câmera/AR/foto): overlays do scanner, resultado 3D.
  dark: {
    tint: 'dark' as const,
    intensity: 30,
    fill: 'rgba(27,58,87,0.45)',
    border: 'rgba(255,255,255,0.18)',
  },
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

// Tipografia da marca: Inter (sans geométrica). Títulos 700, texto 400 — as
// únicas duas espessuras da Identidade visual. Carregadas em App.tsx; o
// componente `Text` (components/Text.tsx) escolhe a família pela fontWeight.
export const fonts = {
  regular: 'Inter_400Regular',
  bold: 'Inter_700Bold',
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
