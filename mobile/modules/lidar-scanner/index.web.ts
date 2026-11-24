// Versão web do módulo nativo: o LiDAR só existe no iPhone. No browser mostra-se um painel
// a dizê-lo, com a mesma interface, para o resto da app funcionar igual.
import React, { forwardRef } from 'react';
import { Text, View } from 'react-native';

export * from './src/LidarScanner.types';
export * from './src/ObjectCapture.types';

const Notice = forwardRef<any, any>(function Notice(_props, _ref) {
  return React.createElement(View, { style: { flex: 1, backgroundColor: '#05080C', alignItems: 'center', justifyContent: 'center', padding: 32 } },
    React.createElement(Text, { style: { color: '#5CC17E', fontSize: 20, fontWeight: '700', marginBottom: 8 } }, 'LiDAR scan runs on iPhone'),
    React.createElement(Text, { style: { color: '#9FB3C4', fontSize: 15, textAlign: 'center' } }, 'This web demo shows the herd, records and results. Capture needs an iPhone 12 Pro or newer.'));
});
export const LidarScannerView = Notice;
export const MeshPreviewView = Notice;
export const ObjectCaptureView = Notice;
export function isLidarSupported(): boolean { return false; }
export function renderTexture(): Promise<{ url: string }> { return Promise.reject(new Error('Not available on web')); }
export function isObjectCaptureSupported(): Promise<boolean> { return Promise.resolve(false); }
export function measureObjectBounds(): Promise<never> { return Promise.reject(new Error('Not available on web')); }
