import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';

// Barra de estado conforme o tema (o ecrã do scan põe a sua, clara, por cima).
function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} backgroundColor="transparent" translucent />;
}

export default function App() {
  // Tipografia da marca (Identidade visual v1.0): Inter 400 e 700, embarcadas na
  // app — funcionam offline. Se o carregamento falhar, segue com a fonte do
  // sistema em vez de ficar num ecrã vazio.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_700Bold });
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ThemedStatusBar />
        <AppNavigator />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
