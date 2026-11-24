// Permissão da câmara (iPhone). Na web usa-se cameraPermissions.web.ts: o expo-camera
// para web arranca um worker de leitura de QR que vai buscar o jsQR a um CDN externo,
// bloqueado pela nossa CSP — e a web não faz scans (o LiDAR só existe no iPhone).
export { useCameraPermissions } from 'expo-camera';
