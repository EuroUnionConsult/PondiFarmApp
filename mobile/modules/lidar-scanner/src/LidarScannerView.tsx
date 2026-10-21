import { requireNativeView } from 'expo';
import * as React from 'react';
import type { ViewProps } from 'react-native';

import type { BoxFitEvent, ScanCompleteEvent, ScanProgressEvent } from './LidarScanner.types';

export type LidarScannerViewProps = ViewProps & {
  onScanComplete?: (event: { nativeEvent: ScanCompleteEvent }) => void;
  onScanProgress?: (event: { nativeEvent: ScanProgressEvent }) => void;
  onBoxFit?: (event: { nativeEvent: BoxFitEvent }) => void;
};

export type LidarScannerViewRef = {
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  setBoxScale: (scale: number) => Promise<void>;
  recenterBox: () => Promise<void>;
  rotateBox: (degrees: number) => Promise<void>;
  autoFitBox: () => Promise<void>;
  cancelAutoFit: () => Promise<void>;
};

const NativeView: React.ComponentType<
  LidarScannerViewProps & { ref?: React.Ref<LidarScannerViewRef> }
> = requireNativeView('LidarScanner');

const LidarScannerView = React.forwardRef<LidarScannerViewRef, LidarScannerViewProps>(
  (props, ref) => <NativeView {...props} ref={ref} />,
);

export default LidarScannerView;
