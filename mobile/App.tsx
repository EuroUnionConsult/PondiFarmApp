import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // Tipografia da marca (Identidade visual v1.0): Inter 400 e 700, embarcadas na
  // app — funcionam offline. Se o carregamento falhar, segue com a fonte do
  // sistema em vez de ficar num ecrã vazio.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_700Bold });
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
