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

  // Tokens de superfície (introduzidos com o tema escuro, 21/10/2026). Antes eram
  // hexadecimais soltos nos ecrãs; num tema escuro cada um precisa do seu par.
  /** Fundo de botões verdes. Igual ao accent no claro; no escuro o accent clareia
   * para texto e o botão mantém o verde da marca (branco por cima = 5,08:1). */
  accentFill:  '#2D7D46',
  danger:      '#DC2626',   // texto destrutivo (4,8:1)
  dangerLight: 'rgba(220,38,38,0.08)',
  surface:     '#FFFFFF',   // segmento ativo, cartões opacos
  segmentFill: 'rgba(118,118,128,0.12)',
  ringTrack:   '#E5E5EA',
  warnBg:      '#FFF7F0',
  warnBorder:  'rgba(194,97,31,0.25)',
  blobGreen:   'rgba(45,125,70,0.14)',
  blobNavy:    'rgba(27,58,87,0.08)',
  blobOrange:  'rgba(194,97,31,0.08)',
  isDark: false,
};

export type Palette = Omit<typeof ios, 'isDark'> & { isDark: boolean };

// Tema escuro: as cores da marca transcritas para fundo escuro (pedido do Talys,
// 21/10/2026). Fundo azul-noite muito escuro em vez de preto puro, para ficar
// da família do #1B3A57. Contrastes medidos sobre o fundo e sobre os cartões:
// texto ≥ 7:1, terciário ≥ 4,5:1.
export const iosDark: Palette = {
  systemBackground:                '#0B1622',
  systemGroupedBackground:         '#0B1622',
  secondarySystemGroupedBackground:'#14202D',
  tertiarySystemGroupedBackground: '#1C2A38',

  label:           '#F2F5F8',
  secondaryLabel:  '#B4BCC5',
  tertiaryLabel:   '#7D8894',
  quaternaryLabel: 'rgba(235,240,245,0.25)',

  separator:       'rgba(255,255,255,0.12)',
  opaqueSeparator: '#2A3846',

  accent:      '#5CC17E',   // verde da marca clareado: 7,4:1 nos cartões
  accentLight: 'rgba(92,193,126,0.16)',
  accentDark:  '#7DD39A',   // texto sobre accentLight
  accentSupport: '#3E9A5C',
  accentOnDark: '#5CC17E',

  navy:        '#9DBCE0',   // azul-noite como TEXTO num fundo escuro (8,4:1)
  navyLight:   'rgba(157,188,224,0.14)',
  navyMid:     '#6F95BF',
  orange:      '#E0874A',
  orangeLight: 'rgba(224,135,74,0.16)',
  orangeText:  '#F0A46E',

  systemRed:    '#FF6B61',
  systemGreen:  '#30D158',
  systemBlue:   '#0A84FF',

  accentFill:  '#2D7D46',
  danger:      '#FF7A70',
  dangerLight: 'rgba(255,122,112,0.12)',
  surface:     '#22303F',
  segmentFill: 'rgba(118,118,128,0.24)',
  ringTrack:   '#2A3846',
  warnBg:      'rgba(224,135,74,0.10)',
  warnBorder:  'rgba(224,135,74,0.30)',
  blobGreen:   'rgba(92,193,126,0.10)',
  blobNavy:    'rgba(111,149,191,0.10)',
  blobOrange:  'rgba(224,135,74,0.06)',
  isDark: true,
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
