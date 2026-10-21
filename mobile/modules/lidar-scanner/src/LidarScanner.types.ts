export type Measurements = {
  body_length_cm: number;
  withers_height_cm: number;
  thoracic_depth_cm: number;
  /**
   * Largura MÁXIMA do animal, em qualquer ponto do comprimento — não a largura
   * na garupa, apesar do nome. É a quantidade sobre a qual o coeficiente do
   * modelo embarcado foi ajustado, por isso o campo mantém-se como está. A
   * medida anatómica correspondente à base Limousine é `rump_width_ilium_cm`.
   */
  rump_width_cm: number;
  chest_girth_cm: number;

  /**
   * Descritores alinhados com as colunas de `Final_Biometrics` da base
   * Limousine v5. Opcionais porque só existem em scans feitos a partir da
   * versão que os introduziu, e porque NENHUM alimenta o modelo de peso —
   * são recolhidos para permitir a comparação scan/fita quando houver animais
   * medidos pelos dois métodos.
   */
  chest_width_cm?: number;
  rump_width_ilium_cm?: number;
  tail_height_cm?: number;
  /** Extremo do eixo longo onde a dianteira foi detectada. Para auditoria. */
  orientation_head_at_min_axis?: boolean;
};

export type ScanCompleteEvent = {
  meshUri: string;
  meshPlyUri?: string; // PLY colorido (EURODEV-80) — preferido pelo viewer 3D
  meshTexturedUri?: string; // OBJ+MTL+PNG texturizado (bake UV) — preferido se existir
  keyframesDir?: string; // pasta com keyframes salvos para o "Render texture" sob demanda
  vertexCount: number;
  faceCount: number;
  measurements?: Measurements; // adicionado na Fase 3 (EURODEV-76)
  thumbUri?: string;
};
