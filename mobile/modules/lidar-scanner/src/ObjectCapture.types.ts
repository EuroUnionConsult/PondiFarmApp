/** Fase do fluxo de Object Capture (Studio mode). */
export type ObjectCapturePhase =
  | 'initializing'
  | 'ready'
  | 'detecting'
  | 'capturing'
  | 'finishing'
  | 'reconstructing'
  | 'done'
  | 'error';

/** Nível de detalhe da reconstrução (PhotogrammetrySession). */
export type ObjectCaptureDetail = 'preview' | 'reduced' | 'medium' | 'full';

export type ObjectCaptureStateEvent = { state: ObjectCapturePhase };
export type ObjectCaptureProgressEvent = { progress: number };
export type ObjectCaptureCompleteEvent = { url: string; path: string };
export type ObjectCaptureErrorEvent = { code: string; message: string };
