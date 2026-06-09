import { requireNativeView } from 'expo';
import * as React from 'react';
import type { ViewProps } from 'react-native';

export type MeshPreviewViewProps = ViewProps & { source: string };

const NativeView: React.ComponentType<MeshPreviewViewProps> = requireNativeView('MeshPreview');

export default function MeshPreviewView(props: MeshPreviewViewProps) {
  return <NativeView {...props} />;
}
