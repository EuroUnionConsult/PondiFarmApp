import LidarScannerModule from './src/LidarScannerModule';
import LidarScannerView from './src/LidarScannerView';

export * from './src/LidarScanner.types';
export { LidarScannerView };

/** True only on iPhones with LiDAR (12 Pro+). False on simulator / non-LiDAR devices. */
export function isLidarSupported(): boolean {
  return LidarScannerModule.isLidarSupported();
}
