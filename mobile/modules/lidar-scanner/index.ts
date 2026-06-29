import LidarScannerModule from './src/LidarScannerModule';
import LidarScannerView from './src/LidarScannerView';
import ObjectCaptureModule from './src/ObjectCaptureModule';

export * from './src/LidarScanner.types';
export { LidarScannerView };
export type { LidarScannerViewRef, LidarScannerViewProps } from './src/LidarScannerView';
export { default as MeshPreviewView } from './src/MeshPreviewView';
export type { MeshPreviewViewProps } from './src/MeshPreviewView';

// Object Capture (Studio mode) — fotogrametria guiada da Apple → USDZ texturizado (iOS 17+).
export * from './src/ObjectCapture.types';
export { default as ObjectCaptureView } from './src/ObjectCaptureView';
export type { ObjectCaptureViewProps, ObjectCaptureViewRef } from './src/ObjectCaptureView';

/** True only on iPhones with LiDAR (12 Pro+). False on simulator / non-LiDAR devices. */
export function isLidarSupported(): boolean {
  return LidarScannerModule.isLidarSupported();
}

/** Bakeia a textura sob demanda a partir da malha cinza + keyframes salvos. */
export function renderTexture(meshUri: string, keyframesDir: string): Promise<{ url: string }> {
  return LidarScannerModule.renderTexture(meshUri, keyframesDir);
}

/** True só em iOS 17+ com hardware compatível (LiDAR + A14+). Assíncrono. */
export function isObjectCaptureSupported(): Promise<boolean> {
  return ObjectCaptureModule.isSupported();
}

/** Dimensões reais (metros) do modelo USDZ: largura×altura×profundidade. */
export function measureObjectBounds(url: string) {
  return ObjectCaptureModule.measureBounds(url);
}
