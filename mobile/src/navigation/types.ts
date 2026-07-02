import type { ScanRecord } from '../lib/storage';
import type { CloudAnimal } from '../lib/api';

export type RootStackParamList = {
  Main: undefined;
  Scan: undefined;
  ObjectCapture: undefined;
  Result: { record: ScanRecord };
  AnimalDetail: { animal: CloudAnimal };
};

export type TabParamList = {
  Home: undefined;
  Herd: undefined;
  Analytics: undefined;
  Settings: undefined;
};
