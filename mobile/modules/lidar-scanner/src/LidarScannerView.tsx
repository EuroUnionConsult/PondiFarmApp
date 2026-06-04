import { requireNativeView } from 'expo';
import * as React from 'react';
import type { ViewProps } from 'react-native';

import type { ScanCompleteEvent } from './LidarScanner.types';

export type LidarScannerViewProps = ViewProps & {
  onScanComplete?: (event: { nativeEvent: ScanCompleteEvent }) => void;
};

export type LidarScannerViewRef = {
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
};

const NativeView: React.ComponentType<
  LidarScannerViewProps & { ref?: React.Ref<LidarScannerViewRef> }
> = requireNativeView('LidarScanner');

const LidarScannerView = React.forwardRef<LidarScannerViewRef, LidarScannerViewProps>(
  (props, ref) => <NativeView {...props} ref={ref} />,
);

export default LidarScannerView;
