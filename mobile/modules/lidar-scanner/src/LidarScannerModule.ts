import { NativeModule, requireNativeModule } from 'expo';

declare class LidarScannerModule extends NativeModule<{}> {}

export default requireNativeModule<LidarScannerModule>('LidarScanner');
