import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { reportError } from '../lib/errorReport';
import { reloadApp } from '../lib/reloadApp';

// Rede de segurança para erros de renderização (iPhone e web). Sem ela, qualquer erro
// num componente deixava a página em branco para sempre (e o iPhone num ecrã vazio).
// Mostra «Something went wrong» com «Reload» e envia o erro para /client-errors.
// Fica por fora do tema e das fontes de propósito: tem de funcionar mesmo que sejam
// eles a falhar (cores fixas da marca, fonte do sistema).

const NAVY = '#0F2234';
const GREEN = '#2D7D46';

type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Só os nomes dos componentes (sem URLs dos ficheiros): «at Foo (http://…)» → «Foo».
    const where = (info.componentStack ?? '').split('\n').map((l) => l.trim().replace(/^at /, '').replace(/\s*\(.*\)$/, '')).filter(Boolean).slice(0, 4).join(' < ');
    reportError({ kind: 'js', message: `Render error: ${error?.message ?? String(error)}${where ? ` @ ${where}` : ''}` });
  }

  // Web: recarrega a página. iPhone: recarrega o bundle; se não der, volta a montar a app.
  reload = () => {
    void reloadApp().then((ok) => { if (!ok) this.setState({ error: null }); });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={s.wrap} accessibilityRole="alert">
        <View style={s.card}>
          <Text style={s.title} accessibilityRole="header">Something went wrong</Text>
          <Text style={s.text}>
            PondiFarm hit an unexpected problem and was reported to the team. Your scans are safe. Reload to continue.
          </Text>
          <Pressable onPress={this.reload} style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <Text style={s.btnText}>Reload</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, minHeight: '100%' as any, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: NAVY },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', gap: 10 },
  title: { fontSize: 21, fontWeight: '700', color: '#1C2530', textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 21, color: '#5B6773', textAlign: 'center' },
  btn: { marginTop: 10, minHeight: 48, minWidth: 160, paddingHorizontal: 24, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
