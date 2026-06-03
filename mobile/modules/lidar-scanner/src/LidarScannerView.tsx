import { requireNativeView } from 'expo';
import * as React from 'react';
import type { ViewProps } from 'react-native';

import type { ScanCompleteEvent } from './LidarScanner.types';

export type LidarScannerViewProps = ViewProps & {
  onScanComplete?: (event: { nativeEvent: ScanCompleteEvent }) => void;
};

const NativeView: React.ComponentType<LidarScannerViewProps> =
  requireNativeView('LidarScanner');

export default function LidarScannerView(props: LidarScannerViewProps) {
  return <NativeView {...props} />;
}
