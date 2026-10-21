import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from '../lib/motion';

// Toque com resposta física: encolhe ~3% com mola ao carregar e volta ao soltar
// (no thread nativo). Com «Reduzir movimento» do iOS ligado, só baixa a opacidade.
type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Vibração leve ao tocar — para ações principais, não para cada linha. */
  haptic?: boolean;
  scaleTo?: number;
};

export default function PressableScale({
  style, haptic = false, scaleTo = 0.97, onPressIn, onPressOut, onPress, disabled, children, ...rest
}: Props) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(v, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  const animatedStyle = reduced
    ? { opacity: v.interpolate({ inputRange: [scaleTo, 1], outputRange: [0.6, 1] }) }
    : { transform: [{ scale: v }] };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={e => { to(scaleTo); onPressIn?.(e); }}
      onPressOut={e => { to(1); onPressOut?.(e); }}
      onPress={e => {
        if (haptic) void Haptics.selectionAsync();
        onPress?.(e);
      }}
    >
      {/* Desativado NÃO desbota sozinho: linhas só de leitura (ex.: a própria
          pessoa na lista de membros) usam este componente e devem ler-se normais.
          Botões que precisam de parecer inativos trazem o seu próprio estilo. */}
      <Animated.View style={[style, animatedStyle]}>
        {children as React.ReactNode}
      </Animated.View>
    </Pressable>
  );
}
