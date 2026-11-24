import React, { Suspense, lazy } from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * Mapa da quinta na web. O Leaflet (~150 KB) só se descarrega quando o mapa
 * abre: fica num pedaço próprio do bundle (import dinâmico), fora do arranque.
 * A implementação está em FarmMapLeaflet.tsx.
 */
const Leaflet = lazy(() => import('./FarmMapLeaflet'));

type Props = { lat: number; lon: number; onChange: (lat: number, lon: number) => void; height?: number };

export default function FarmMap(props: Props) {
  const height = props.height ?? 260;
  return (
    <Suspense
      fallback={
        <View style={{ height, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127,127,127,0.12)' }}>
          <ActivityIndicator color="#2D7D46" />
        </View>
      }
    >
      <Leaflet {...props} />
    </Suspense>
  );
}
