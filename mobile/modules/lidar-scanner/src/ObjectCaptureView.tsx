import { requireNativeView } from 'expo';
import * as React from 'react';
import type { ViewProps } from 'react-native';

import type {
  ObjectCaptureCompleteEvent,
  ObjectCaptureDetail,
  ObjectCaptureErrorEvent,
  ObjectCaptureProgressEvent,
  ObjectCaptureStateEvent,
} from './ObjectCapture.types';

export type ObjectCaptureViewProps = ViewProps & {
  /** Nível de detalhe da reconstrução. Padrão nativo: 'reduced'. */
  detail?: ObjectCaptureDetail;
  onStateChange?: (event: { nativeEvent: ObjectCaptureStateEvent }) => void;
  onProgress?: (event: { nativeEvent: ObjectCaptureProgressEvent }) => void;
  onComplete?: (event: { nativeEvent: ObjectCaptureCompleteEvent }) => void;
  onError?: (event: { nativeEvent: ObjectCaptureErrorEvent }) => void;
};

export type ObjectCaptureViewRef = {
  cancel: () => Promise<void>;
};

const NativeView: React.ComponentType<
  ObjectCaptureViewProps & { ref?: React.Ref<ObjectCaptureViewRef> }
> = requireNativeView('ObjectCapture');

const ObjectCaptureView = React.forwardRef<ObjectCaptureViewRef, ObjectCaptureViewProps>(
  (props, ref) => <NativeView {...props} ref={ref} />,
);

export default ObjectCaptureView;
