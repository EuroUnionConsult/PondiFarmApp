import { requireNativeView } from 'expo';
import * as React from 'react';
import type { ViewProps } from 'react-native';

export type MeshViewMode = 'photo' | 'clay' | 'points';

/** `mode`: como na web (cor real, só a forma, pontos do LiDAR); por defeito «clay».
 *  `dark`: tema do app, para a cor dos pontos se ler no fundo. */
export type MeshPreviewViewProps = ViewProps & { source: string; mode?: MeshViewMode; dark?: boolean };

const NativeView: React.ComponentType<MeshPreviewViewProps> = requireNativeView('MeshPreview');

export default function MeshPreviewView(props: MeshPreviewViewProps) {
  return <NativeView {...props} />;
}
