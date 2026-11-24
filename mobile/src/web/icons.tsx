import React from 'react';

// Ícones de traço simples, no estilo dos Ionicons usados na app.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const HomeIcon = () => <svg viewBox="0 0 24 24" {...P}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>;
// Cabeça de vaca (o mesmo desenho do CattleIcon da app).
export const HerdIcon = () => (
  <svg viewBox="0 0 24 24" {...P} strokeWidth={1.8}>
    <path d="M8.4 6.9C7 6.6 6 5.5 5.7 3.9M15.6 6.9C17 6.6 18 5.5 18.3 3.9" />
    <path d="M7.9 9.1C6.3 9.7 4.4 9.4 3.2 8.2c1.2-1.4 3.1-1.8 4.9-1.2M16.1 9.1c1.6.6 3.5.3 4.7-.9-1.2-1.4-3.1-1.8-4.9-1.2" />
    <path d="M8.7 14.3 8 7.9C8.6 6.6 10.1 5.8 12 5.8s3.4.8 4 2.1l-.7 6.4" />
    <ellipse cx="12" cy="16.4" rx="3.6" ry="2.6" />
    <g fill="currentColor" stroke="none"><circle cx="10.2" cy="10.6" r=".6" /><circle cx="13.8" cy="10.6" r=".6" /><circle cx="10.7" cy="16.5" r=".5" /><circle cx="13.3" cy="16.5" r=".5" /></g>
  </svg>);
export const ChartIcon = () => <svg viewBox="0 0 24 24" {...P}><path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" /></svg>;
export const GearIcon = () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>;
export const DesktopIcon = () => <svg viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;
export const PhoneIcon = () => <svg viewBox="0 0 24 24" {...P}><rect x="6.5" y="2.5" width="11" height="19" rx="2.6" /><path d="M10.5 18.5h3" /></svg>;
export const CloudIcon = () => <svg viewBox="0 0 24 24" {...P}><path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 10a4 4 0 0 1-.5 8z" /></svg>;
export const HourglassIcon = () => <svg viewBox="0 0 24 24" {...P}><path d="M6.5 3h11M6.5 21h11M7.5 3c0 4.5 4.5 6 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 6-4.5 9s4.5 4.5 4.5 9" /></svg>;
// Sexo do animal (os símbolos de Vénus e Marte, no traço dos outros ícones).
export const FemaleIcon = () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="9" r="5.5" /><path d="M12 14.5V22M8.5 18.5h7" /></svg>;
export const MaleIcon = () => <svg viewBox="0 0 24 24" {...P}><circle cx="10" cy="14" r="5.5" /><path d="M14 10l6-6M15 4h5v5" /></svg>;
export const SearchIcon = () => <svg viewBox="0 0 24 24" width="18" {...P} strokeWidth={2.2}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>;
export const Chevron = () => <svg className="pf-chev" viewBox="0 0 24 24" {...P} strokeWidth={2.4}><path d="m9 6 6 6-6 6" /></svg>;
export const SunIcon = () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>;
export const MoonIcon = () => <svg viewBox="0 0 24 24" {...P}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>;
export const DotsIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" /></svg>;
export const PenIcon = () => <svg viewBox="0 0 24 24" {...P}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>;
export const InfoIcon = () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></svg>;
