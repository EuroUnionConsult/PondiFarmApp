import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { stagger, useReducedMotion } from '../lib/motion';

// Entrada de uma secção: aparece com fade e sobe 12 px, em cascata pelo `index`.
// Só na montagem — não repete a cada render. «Reduzir movimento»: só o fade.
export default function FadeInView({
  index = 0, style, children,
}: { index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: reduced ? 160 : 320,
      delay: reduced ? 0 : stagger(index),
      useNativeDriver: true,
    }).start();
  }, [v, index, reduced]);

  const translateY = reduced ? 0 : v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
