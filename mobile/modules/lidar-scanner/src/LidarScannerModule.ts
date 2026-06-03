import { NativeModule, requireNativeModule } from 'expo';

declare class LidarScannerModule extends NativeModule<{}> {
  isLidarSupported(): boolean;
}

export default requireNativeModule<LidarScannerModule>('LidarScanner');
