import { NativeModule, requireNativeModule } from 'expo';

export type ModelBounds = { width: number; height: number; depth: number };

declare class ObjectCaptureModule extends NativeModule<{}> {
  /** True só em iOS 17+ com hardware compatível (LiDAR + A14+). */
  isSupported(): Promise<boolean>;
  /** Dimensões reais (metros) do modelo: largura×altura×profundidade. */
  measureBounds(url: string): Promise<ModelBounds>;
}

export default requireNativeModule<ObjectCaptureModule>('ObjectCapture');
