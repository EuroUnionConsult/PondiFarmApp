import AsyncStorage from '@react-native-async-storage/async-storage';

// Versão escolhida pela pessoa: computador ou telemóvel. Guardada no browser.
export type DeviceMode = 'desktop' | 'mobile';
const KEY = '@pondifarm:deviceMode';

/** Abaixo desta largura não há espaço para o layout de computador nem para a moldura:
 * a app abre em ecrã inteiro, como num telemóvel. */
export const NARROW = 760;

export async function loadDeviceMode(width: number): Promise<DeviceMode> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'desktop' || v === 'mobile') return v;
  } catch {}
  return width >= 1024 ? 'desktop' : 'mobile';
}

export async function saveDeviceMode(m: DeviceMode): Promise<void> {
  try { await AsyncStorage.setItem(KEY, m); } catch {}
}
