// Versão web: não importa o expo-camera (o scanner de QR dele carrega o jsQR de um CDN
// que a CSP bloqueia). Na web não há captura; o ecrã de scan mostra o aviso
// «LiDAR scan runs on iPhone» (modules/lidar-scanner/index.web.ts), por isso a
// permissão conta como concedida para chegar a esse aviso.
type WebPermission = { granted: boolean; canAskAgain: boolean; status: 'granted'; expires: 'never' };

const GRANTED: WebPermission = { granted: true, canAskAgain: false, status: 'granted', expires: 'never' };

export function useCameraPermissions(): [WebPermission, () => Promise<WebPermission>] {
  return [GRANTED, async () => GRANTED];
}
