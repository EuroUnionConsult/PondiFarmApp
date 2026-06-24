export type Measurements = {
  body_length_cm: number;
  withers_height_cm: number;
  thoracic_depth_cm: number;
  rump_width_cm: number;
  chest_girth_cm: number;
};

export type ScanCompleteEvent = {
  meshUri: string;
  meshPlyUri?: string; // PLY colorido (EURODEV-80) — preferido pelo viewer 3D
  meshTexturedUri?: string; // OBJ+MTL+PNG texturizado (bake UV) — preferido se existir
  vertexCount: number;
  faceCount: number;
  measurements?: Measurements; // adicionado na Fase 3 (EURODEV-76)
  thumbUri?: string;
};
