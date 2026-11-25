import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import { applyThemeAttr } from './src/web/themeScan';
import { WeatherProvider } from './src/lib/weather';
import { AuthProvider, useAuth } from './src/lib/AuthContext';
import { RootNavigator } from './src/navigation/AppNavigator';
import DesktopOrgGate from './src/web/DesktopOrgGate';
import { AlertHost, installWebAlert } from './src/web/webAlert';
import ServerWakeNotice from './src/components/ServerWakeNotice';
import EntryAnimation from './src/components/EntryAnimation';
import { ToastHost } from './src/components/Toast';
import DesktopLogin from './src/web/DesktopLogin';
import DeviceStage from './src/web/DeviceStage';
import { loadDeviceMode, NARROW, type DeviceMode } from './src/web/deviceMode';
import { CSS } from './src/web/styles';
import { installGlobalErrorHandlers, setReportPlatform } from './src/lib/errorReport';
import PondiLoader from './src/components/PondiLoader';
import BootScreen from './src/components/BootScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import IdleSessionGuard from './src/web/IdleSessionGuard';
import { INTRO_BG, markAppPainted } from './src/lib/entryIntro';

// Na web, Alert.alert não fazia nada (react-native-web): passa a abrir um diálogo.
installWebAlert();
// Erros JavaScript não apanhados (window.onerror / unhandledrejection) vão para o log do servidor.
installGlobalErrorHandlers();

// Entrada da versão web (Expo escolhe este ficheiro na web; o iPhone continua a usar App.tsx).
function useNarrow() {
  const [n, setN] = useState(window.innerWidth < NARROW);
  useEffect(() => { const f = () => setN(window.innerWidth < NARROW); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return n;
}

// A app (ou o ecrã de arranque, com o fundo do tema) já está pintada: o <body> pode
// deixar o azul-noite (EntryAnimation espera por isto).
function Painted() {
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(markAppPainted));
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

/** Enquanto as fontes Inter carregam: azul-noite com o símbolo (nunca uma página em branco). */
function FontBoot() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: INTRO_BG }}>
      <PondiLoader size="lg" tone="onColor" label="Loading PondiFarm" />
    </View>
  );
}

/** Não prende a app às fontes mais do que isto: depois entra com a fonte do sistema e troca quando chegarem. */
const FONT_WAIT_MS = 2500;

function WebRoot() {
  const { token, user, loading, connection, retryConnect } = useAuth();
  const { mode: themeMode } = useTheme();
  useEffect(() => { applyThemeAttr(themeMode); }, [themeMode]);
  const narrow = useNarrow();
  const [mode, setMode] = useState<DeviceMode | null>(null);
  useEffect(() => { loadDeviceMode(window.innerWidth).then(setMode); }, []);
  // Os relatórios de erro dizem se foi a web de computador ou a de telemóvel.
  useEffect(() => { setReportPlatform(narrow || mode === 'mobile' ? 'web-mobile' : 'web-desktop'); }, [narrow, mode]);

  // A ler a conta: «Connecting to the server…» (e, ao fim de ~2 min, «Retry») em vez de
  // abrir o painel com um utilizador vazio e o rebanho em cache como se fosse atual.
  if (loading || mode === null) {
    return <BootScreen connection={connection} onRetry={retryConnect} quiet={!token || !loading} />;
  }
  // Num ecrã estreito (um telemóvel de verdade) a app abre como no iPhone, sem moldura.
  if (narrow) return <View style={{ flex: 1 }}><RootNavigator /></View>;
  if (!token) return <DesktopLogin />;
  // Sem organização: criar uma ou pedir entrada. À espera de aprovação entra no
  // painel com acesso limitado (como no iPhone): aviso na Home, sem dados da
  // organização, e abre sozinho o rebanho quando o Líder aprovar.
  if (user && user.membershipStatus === 'none') {
    return <DesktopOrgGate />;
  }
  return <DeviceStage initial={mode} />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFontTimeout(true), FONT_WAIT_MS); return () => clearTimeout(t); }, []);
  useEffect(() => {
    // Uma vez por página e sem remover ao desmontar: o ecrã de erro e os diálogos precisam dele.
    if (!document.getElementById('pf-web-css')) {
      const el = document.createElement('style'); el.id = 'pf-web-css'; el.textContent = CSS; document.head.appendChild(el);
    }
    document.title = 'PondiFarm';
  }, []);
  const ready = fontsLoaded || !!fontError || fontTimeout;
  return (
    <SafeAreaProvider>
      {/* Erro de renderização → «Something went wrong» + «Reload» (nunca uma página em branco). */}
      <ErrorBoundary>
        {!ready ? <FontBoot /> : (
          <ThemeProvider>
            <AuthProvider>
              <WeatherProvider>
                <WebRoot />
              </WeatherProvider>
              <Painted />
              <AlertHost />
              {/* 30 min sem interação → aviso de 60 s → sai (só web; prazos em lib/session.ts). */}
              <IdleSessionGuard />
              {/* «Connecting to the server…» enquanto a base serverless acorda (login, arranque, qualquer pedido lento). */}
              <ServerWakeNotice />
              {/* Avisos rápidos (sucesso/aviso/erro) de qualquer ecrã. */}
              <ToastHost />
            </AuthProvider>
          </ThemeProvider>
        )}
      </ErrorBoundary>
      {/* Abertura «Scan que revela» no 1.º carregamento de cada separador. */}
      <EntryAnimation />
    </SafeAreaProvider>
  );
}
