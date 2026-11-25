import * as Updates from 'expo-updates';

/** iPhone: recarrega o bundle (expo-updates). false se não der (ex.: build de desenvolvimento). */
export async function reloadApp(): Promise<boolean> {
  try { await Updates.reloadAsync(); return true; } catch { return false; }
}
