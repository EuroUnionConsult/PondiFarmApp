import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TextInput, TouchableOpacity, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font, shadow } from '../lib/theme';
import { clearAll } from '../lib/storage';
import { checkHealth } from '../lib/api';

const CFG_KEY = '@boviscan:config';

interface Config {
  backendUrl: string;
  defaultBreed: string;
  vibration: boolean;
}

const DEFAULT: Config = {
  backendUrl: 'http://localhost:8000',
  defaultBreed: 'default',
  vibration: true,
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  const [ping, setPing] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CFG_KEY).then(raw => {
      if (raw) setCfg({ ...DEFAULT, ...JSON.parse(raw) });
    });
  }, []);

  const save = async (next: Partial<Config>) => {
    const updated = { ...cfg, ...next };
    setCfg(updated);
    await AsyncStorage.setItem(CFG_KEY, JSON.stringify(updated));
  };

  const testConnection = async () => {
    setTesting(true);
    setPing(null);
    const ok = await checkHealth(cfg.backendUrl);
    setPing(ok);
    setTesting(false);
    Alert.alert(
      ok ? '✅ Conectado' : '❌ Sem conexão',
      ok ? 'API backend respondeu com sucesso.' : 'Verifique se o servidor está em execução e o IP/URL está correto.',
    );
  };

  const handleClearData = () => {
    Alert.alert('Limpar dados', 'Isso apagará todos os scans salvos. Confirma?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: async () => { await clearAll(); Alert.alert('Feito', 'Dados removidos.'); } },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Configurações</Text>
      </View>

      <View style={styles.body}>
        {/* Servidor */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Servidor</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>URL da API</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={cfg.backendUrl}
                onChangeText={v => save({ backendUrl: v })}
                placeholder="https://xxxx.loca.lt ou http://IP:8000"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.testBtn, testing && { opacity: 0.5 }]}
                onPress={testConnection}
                disabled={testing}
              >
                {ping === null
                  ? <Ionicons name="pulse" size={15} color={colors.secondary} />
                  : <Ionicons name={ping ? 'checkmark-circle' : 'close-circle'} size={15} color={ping ? colors.primary : colors.danger} />
                }
                <Text style={[styles.testBtnText, { color: ping === false ? colors.danger : ping === true ? colors.primary : colors.secondary }]}>
                  {testing ? '...' : 'Testar'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Use o IP local da rede ou o link do localtunnel.</Text>
          </View>
        </View>

        {/* Scan */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Scan</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Raça padrão</Text>
            <View style={styles.breedRow}>
              {['default', 'minhota', 'alentejana'].map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.breedBtn, cfg.defaultBreed === b && styles.breedBtnActive]}
                  onPress={() => save({ defaultBreed: b })}
                >
                  <Text style={[styles.breedLabel, cfg.defaultBreed === b && styles.breedLabelActive]}>
                    {b.charAt(0).toUpperCase() + b.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.switchRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Vibração</Text>
                <Text style={styles.hint}>Feedback háptico ao capturar foto</Text>
              </View>
              <Switch
                value={cfg.vibration}
                onValueChange={v => save({ vibration: v })}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Sobre */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Sobre</Text>
          <View style={styles.card}>
            {[
              { k: 'Aplicação', v: 'BoviScan Mobile' },
              { k: 'Versão', v: '0.1.0 (Fase 0)' },
              { k: 'Motor IA', v: 'YOLOv8 + Random Forest' },
              { k: 'Protocolo', v: '2D sem LiDAR' },
            ].map(({ k, v }, i, arr) => (
              <View key={k} style={[styles.infoRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={styles.infoKey}>{k}</Text>
                <Text style={styles.infoVal}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Dados */}
        <View style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.danger }]}>Zona de perigo</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearData}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.dangerText}>Limpar todos os scans</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '800' },
  body: { padding: spacing.md, gap: 0 },
  group: { marginBottom: spacing.lg },
  groupTitle: {
    color: colors.textMuted, fontSize: font.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: spacing.sm, paddingLeft: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: spacing.sm,
    ...shadow.sm,
  },
  fieldLabel: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  hint: { color: colors.textDim, fontSize: font.xs, lineHeight: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    color: colors.text, fontSize: font.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 9,
  },
  testBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.secondary,
    paddingHorizontal: spacing.sm, paddingVertical: 9,
  },
  testBtnText: { fontSize: font.xs, fontWeight: '700' },
  breedRow: { flexDirection: 'row', gap: spacing.sm },
  breedBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  breedBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  breedLabel: { color: colors.textMuted, fontSize: font.sm },
  breedLabelActive: { color: colors.primary, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  infoKey: { color: colors.textMuted, fontSize: font.sm },
  infoVal: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger,
    padding: spacing.md,
  },
  dangerText: { color: colors.danger, fontSize: font.md, fontWeight: '600' },
});
