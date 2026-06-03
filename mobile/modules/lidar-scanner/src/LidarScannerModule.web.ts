import { registerWebModule, NativeModule } from 'expo';

class LidarScannerModule extends NativeModule<{}> {}

export default registerWebModule(LidarScannerModule, 'LidarScannerModule');
