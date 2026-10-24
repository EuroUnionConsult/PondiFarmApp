import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

/** Mapa para marcar a quinta (iPhone: Apple Maps, sem chave). O pino arrasta-se;
 *  tocar no mapa também o move. A versão web usa Leaflet (FarmMap.web no Web-Desk). */
export default function FarmMap({ lat, lon, onChange, height = 260 }: {
  lat: number; lon: number; onChange: (lat: number, lon: number) => void; height?: number;
}) {
  const ref = useRef<MapView>(null);
  useEffect(() => {
    const region: Region = { latitude: lat, longitude: lon, latitudeDelta: 0.12, longitudeDelta: 0.12 };
    ref.current?.animateToRegion(region, 450);
  }, [lat, lon]);
  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
        onPress={(e) => onChange(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
        showsUserLocation={false}
        mapType="hybrid"
      >
        <Marker
          coordinate={{ latitude: lat, longitude: lon }}
          draggable
          onDragEnd={(e) => onChange(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
          pinColor="#2D7D46"
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { borderRadius: 16, overflow: 'hidden' } });
