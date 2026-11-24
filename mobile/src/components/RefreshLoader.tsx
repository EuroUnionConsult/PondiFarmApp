import React from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import PondiLoader from './PondiLoader';

// «Puxar para atualizar» com a animação oficial: o RefreshControl continua a tratar do
// gesto (scroll nativo do iOS), mas com o spinner do sistema transparente
// (REFRESH_TINT); este componente desenha o PondiLoader no espaço que o puxão abre,
// a meio dele, e mantém-no enquanto atualiza. Na web não há puxão: não desenha nada.

export const REFRESH_TINT = 'transparent';
const SIZE = 34;

export default function RefreshLoader({ scrollY, refreshing, top = 0 }: { scrollY: Animated.Value; refreshing: boolean; top?: number }) {
  if (Platform.OS === 'web') return null;
  // Puxão = contentOffset negativo. Aparece entre 24 e 80 px e acompanha o meio do espaço aberto.
  const pullOpacity = scrollY.interpolate({ inputRange: [-80, -24], outputRange: [1, 0], extrapolate: 'clamp' });
  const translateY = scrollY.interpolate({ inputRange: [-200, -SIZE - 24, 0], outputRange: [100 - SIZE / 2, 12, 12], extrapolate: 'clamp' });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top, opacity: refreshing ? 1 : pullOpacity, transform: [{ translateY: refreshing ? 12 : translateY }] }]}
    >
      <PondiLoader size={SIZE} label="Refreshing" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 5 },
});
