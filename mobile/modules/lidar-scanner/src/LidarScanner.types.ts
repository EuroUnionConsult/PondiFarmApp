export type Measurements = {
  body_length_cm: number;
  withers_height_cm: number;
  thoracic_depth_cm: number;
  rump_width_cm: number;
  chest_girth_cm: number;
};

export type ScanCompleteEvent = {
  measurements: Measurements;
  meshUri: string;
  thumbUri?: string;
};
