import type { ScanRecord } from '../lib/storage';
import type { CloudAnimal } from '../lib/api';

export type RootStackParamList = {
  Main: undefined;
  /** Com animal: «Scan again» — ID e raça já preenchidos. */
  Scan: { animalId?: string; breed?: string } | undefined;
  ObjectCapture: undefined;
  Result: { record: ScanRecord };
  AnimalDetail: { animal: CloudAnimal };
  Profile: undefined;
  Settings: undefined;
  Weather: undefined;
  FarmLocation: undefined;
};

export type TabParamList = {
  Home: undefined;
  Herd: undefined;
  Analytics: undefined;
};
