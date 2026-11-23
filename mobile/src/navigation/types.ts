import type { ScanRecord } from '../lib/storage';
import type { CloudAnimal } from '../lib/api';

export type RootStackParamList = {
  Main: undefined;
  /** Com animal: «Scan again» — ID e raça já preenchidos e o id do animal na nuvem,
   *  para o scan novo ficar no MESMO animal (sem procurar pela tag nem criar outro). */
  Scan: { animalId?: string; breed?: string; remoteAnimalId?: string } | undefined;
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
