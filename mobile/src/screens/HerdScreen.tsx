import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font, shadow } from '../lib/theme';
import { listRecords, deleteRecord, type ScanRecord } from '../lib/storage';
import StatusBadge from '../components/StatusBadge';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HerdScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setRecords(await listRecords());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = records.filter(r =>
    r.animal_id.toLowerCase().includes(query.toLowerCase()) ||
    r.breed.toLowerCase().includes(query.toLowerCase())
  );

  const handleDelete = (id: string, animalId: string) => {
    Alert.alert('Remover scan', `Remover o scan de ${animalId}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => { await deleteRecord(id); load(); } },
    ]);
  };

  const renderItem = ({ item, index }: { item: ScanRecord; index: number }) => (
    <TouchableOpacity
      style={[styles.card, index === 0 && styles.cardFirst]}
      onPress={() => nav.navigate('Result', { record: item })}
      activeOpacity={0.75}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, { backgroundColor: item.detection.is_real_animal ? colors.primaryLight : colors.warningLight }]}>
          <Ionicons
            name={item.detection.is_real_animal ? 'paw' : 'cube-outline'}
            size={18}
            color={item.detection.is_real_animal ? colors.primary : colors.warning}
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardId}>{item.animal_id}</Text>
          <Text style={styles.cardMeta}>{item.breed} · {new Date(item.scannedAt).toLocaleDateString('pt-BR')}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardWeight}>{item.result.estimated_weight_kg.toFixed(0)} kg</Text>
        <View style={styles.cardActions}>
          <StatusBadge
            label={`${Math.round(item.result.confidence_pct)}%`}
            variant={item.result.confidence_pct >= 85 ? 'success' : 'warning'}
          />
          <TouchableOpacity onPress={() => handleDelete(item.id, item.animal_id)} hitSlop={12}>
            <Ionicons name="trash-outline" size={16} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Rebanho</Text>
        <TouchableOpacity style={styles.scanBtn} onPress={() => nav.navigate('Scan')}>
          <Ionicons name="scan" size={16} color={colors.primary} />
          <Text style={styles.scanBtnText}>Novo scan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por ID ou raça..."
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textDim} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.count}>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</Text>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="paw-outline" size={36} color={colors.textDim} />
            <Text style={styles.emptyText}>{query ? 'Nenhum resultado' : 'Nenhum scan ainda'}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '800' },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: spacing.sm, paddingVertical: 7,
  },
  scanBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    margin: spacing.md, marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...shadow.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: font.sm, paddingVertical: 11 },
  count: { color: colors.textMuted, fontSize: font.xs, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    ...shadow.sm,
  },
  cardFirst: {},
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  avatar: {
    width: 38, height: 38, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardId: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: font.xs, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardWeight: { color: colors.primary, fontSize: font.lg, fontWeight: '800' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyText: { color: colors.textMuted, fontSize: font.md },
});
