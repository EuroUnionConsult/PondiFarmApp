import { NativeModule, requireNativeModule } from 'expo';

declare class LidarScannerModule extends NativeModule<{}> {
  isLidarSupported(): boolean;
  /** Bakeia a textura sob demanda (malha cinza + keyframes salvos → OBJ texturizado). */
  renderTexture(meshUri: string, keyframesDir: string): Promise<{ url: string }>;
}

export default requireNativeModule<LidarScannerModule>('LidarScanner');
