import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanResult } from './api';

export interface ScanRecord extends ScanResult {
  id: string;
  scannedAt: number;
  imageUri?: string;
}

const KEY = '@boviscan:scans';

export async function saveRecord(record: ScanRecord): Promise<void> {
  const all = await listRecords();
  all.unshift(record);
  await AsyncStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
}

export async function listRecords(): Promise<ScanRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function deleteRecord(id: string): Promise<void> {
  const all = await listRecords();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter(r => r.id !== id)));
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
