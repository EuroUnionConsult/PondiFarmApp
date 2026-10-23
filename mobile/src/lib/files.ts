import * as FileSystem from 'expo-file-system/legacy';

/**
 * Caminho atual de um ficheiro guardado pelo app (malha, textura).
 *
 * Os scans guardam o caminho ABSOLUTO (file:///…/Application/<UUID>/Documents/x.ply),
 * e o iOS pode trocar o <UUID> da pasta do app numa atualização (TestFlight,
 * reinstalação). O ficheiro continua lá, mas o caminho antigo deixa de existir —
 * o visualizador ficava em branco e o envio do modelo 3D falhava. Se o caminho
 * guardado não existir, procura-se o mesmo ficheiro na pasta Documents de agora.
 */
export async function resolveLocalFile(uri?: string | null): Promise<string | null> {
  if (!uri) return null;
  try {
    if ((await FileSystem.getInfoAsync(uri)).exists) return uri;
    const docs = FileSystem.documentDirectory;
    const marker = '/Documents/';
    const i = uri.indexOf(marker);
    if (!docs || i < 0) return null;
    const candidate = docs + uri.slice(i + marker.length);   // mantém subpastas (texturas)
    return (await FileSystem.getInfoAsync(candidate)).exists ? candidate : null;
  } catch {
    return null;
  }
}
