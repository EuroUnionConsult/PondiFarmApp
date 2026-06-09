import LidarScannerModule from './src/LidarScannerModule';
import LidarScannerView from './src/LidarScannerView';

export * from './src/LidarScanner.types';
export { LidarScannerView };
export type { LidarScannerViewRef, LidarScannerViewProps } from './src/LidarScannerView';
export { default as MeshPreviewView } from './src/MeshPreviewView';
export type { MeshPreviewViewProps } from './src/MeshPreviewView';

/** True only on iPhones with LiDAR (12 Pro+). False on simulator / non-LiDAR devices. */
export function isLidarSupported(): boolean {
  return LidarScannerModule.isLidarSupported();
}
