import type { ScanRecord } from '../lib/storage';

export type RootStackParamList = {
  Main: undefined;
  Scan: undefined;
  ObjectCapture: undefined;
  Result: { record: ScanRecord };
};

export type TabParamList = {
  Home: undefined;
  Herd: undefined;
  Analytics: undefined;
  Settings: undefined;
};
