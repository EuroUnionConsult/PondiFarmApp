import React from 'react';
import Svg, { Path, Ellipse, Circle, G } from 'react-native-svg';

/**
 * Cabeça de vaca em traço, no estilo dos Ionicons (o Ionicons não tem gado).
 * `filled` pinta a cabeça, para o estado ativo da tab bar.
 */
export default function CattleIcon({ size = 24, color = '#000', filled = false }: { size?: number; color?: string; filled?: boolean }) {
  const sw = 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8.4 6.9C7 6.6 6 5.5 5.7 3.9M15.6 6.9C17 6.6 18 5.5 18.3 3.9" />
      <Path d="M7.9 9.1C6.3 9.7 4.4 9.4 3.2 8.2c1.2-1.4 3.1-1.8 4.9-1.2M16.1 9.1c1.6.6 3.5.3 4.7-.9-1.2-1.4-3.1-1.8-4.9-1.2" fill={filled ? color : 'none'} />
      <Path d="M8.7 14.3 8 7.9C8.6 6.6 10.1 5.8 12 5.8s3.4.8 4 2.1l-.7 6.4" fill={filled ? color : 'none'} />
      <Ellipse cx={12} cy={16.4} rx={3.6} ry={2.6} fill={filled ? color : 'none'} />
      <G fill={filled ? '#fff' : color} stroke="none">
        <Circle cx={10.2} cy={10.6} r={0.6} /><Circle cx={13.8} cy={10.6} r={0.6} />
        <Circle cx={10.7} cy={16.5} r={0.5} /><Circle cx={13.3} cy={16.5} r={0.5} />
      </G>
    </Svg>
  );
}
