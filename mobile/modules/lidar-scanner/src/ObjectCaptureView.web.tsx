import * as React from 'react';
import { Text, View } from 'react-native';

import type { ObjectCaptureViewProps } from './ObjectCaptureView';

// Stub web: Object Capture é iOS-only.
const ObjectCaptureView = React.forwardRef<unknown, ObjectCaptureViewProps>((props, _ref) => (
  <View {...props}>
    <Text>Object Capture indisponível na web.</Text>
  </View>
));

export default ObjectCaptureView;
