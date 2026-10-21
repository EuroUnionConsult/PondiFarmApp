import React from 'react';
import Svg, { Circle, Ellipse, Text as SvgText } from 'react-native-svg';

// Anel de cobertura do scan: 4 arcos, um por lado, vistos de cima. O topo do anel
// é o lado onde o utilizador começou ("Start"); a direita do anel é a direita dele.
// Cada arco enche de 0 a 100% conforme os ângulos já captados desse lado.

type Props = {
  near: number;
  right: number;
  far: number;
  left: number;
  size?: number;
};

const ON = '#33F273';
const TRACK = 'rgba(255,255,255,0.18)';
const R = 30;
const C = 2 * Math.PI * R;
const ARC = C / 4 - 8; // 4 arcos com 8 de folga entre eles

// Rotação (graus) para centrar cada arco: topo, direita, baixo, esquerda.
const ROT = { near: -90, right: 0, far: 90, left: 180 } as const;

function Arc({ side, value }: { side: keyof typeof ROT; value: number }) {
  const v = Math.max(0, Math.min(1, value));
  const rotation = ROT[side] - (ARC / C) * 180; // começa meio arco antes do centro
  return (
    <>
      <Circle
        cx={50} cy={50} r={R} fill="none" stroke={TRACK} strokeWidth={9}
        strokeDasharray={`${ARC} ${C - ARC}`} rotation={rotation} origin="50, 50"
      />
      {v > 0 && (
        <Circle
          cx={50} cy={50} r={R} fill="none" stroke={ON} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={`${ARC * v} ${C - ARC * v}`} rotation={rotation} origin="50, 50"
        />
      )}
    </>
  );
}

export default function CoverageRing({ near, right, far, left, size = 96 }: Props) {
  const pct = Math.round(((near + right + far + left) / 4) * 100);
  return (
    <Svg
      width={size} height={size} viewBox="0 0 100 100"
      accessibilityRole="image"
      accessibilityLabel={`Scan coverage ${pct} percent`}
    >
      <Arc side="near" value={near} />
      <Arc side="right" value={right} />
      <Arc side="far" value={far} />
      <Arc side="left" value={left} />
      <Ellipse cx={50} cy={52} rx={8} ry={13} fill="#6b5a48" />
      <SvgText x={50} y={9} fontSize={9} fill="#D7DDD8" textAnchor="middle">Start</SvgText>
    </Svg>
  );
}
