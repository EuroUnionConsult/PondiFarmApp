import type { ScanRecord } from '../lib/storage';

export type RootStackParamList = {
  Main: undefined;
  Scan: undefined;
  Result: { record: ScanRecord };
  LidarTest: undefined; // TEMP EURODEV-74 — remove in Phase 4
};

export type TabParamList = {
  Home: undefined;
  Herd: undefined;
  Analytics: undefined;
  Settings: undefined;
};
