// Stub web: Object Capture é iOS-only (RealityKit). Mantém o bundle web compilando.
export type ModelBounds = { width: number; height: number; depth: number };

export default {
  async isSupported(): Promise<boolean> {
    return false;
  },
  async measureBounds(_url: string): Promise<ModelBounds> {
    return { width: 0, height: 0, depth: 0 };
  },
};
