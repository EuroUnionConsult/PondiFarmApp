import AsyncStorage from '@react-native-async-storage/async-storage';

const CFG_KEY = '@boviscan:config';

export async function getBackendUrl(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(CFG_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.backendUrl) return cfg.backendUrl.replace(/\/$/, '');
    }
  } catch {}
  // Fallback: configure o IP/URL do servidor nas Configurações do app
  return 'http://localhost:8000';
}

export async function checkHealth(urlOverride?: string): Promise<boolean> {
  try {
    const baseUrl = urlOverride ?? await getBackendUrl();
    const url = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${url}/health`, {
      headers: { 'bypass-tunnel-reminder': 'true' },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
