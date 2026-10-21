import React, { useEffect, useState } from 'react';
import {
  View, Modal, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './Text';
import { ios, fonts } from '../lib/theme';
import { initials, type Profile } from '../lib/profile';

// Folha para definir o nome que aparece no avatar. Abre ao tocar no avatar da Home.

type Props = {
  visible: boolean;
  initial: Profile | null;
  onSave: (p: Profile) => void;
  onCancel: () => void;
};

export default function ProfileSheet({ visible, initial, onSave, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Cada abertura parte do nome guardado (ou vazio).
  useEffect(() => {
    if (visible) {
      setFirstName(initial?.firstName ?? '');
      setLastName(initial?.lastName ?? '');
    }
  }, [visible, initial]);

  const preview = initials({ firstName, lastName });
  const canSave = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{preview || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Your name</Text>
              <Text style={styles.sub}>The avatar shows the first letter of each.</Text>
            </View>
          </View>

          <Text style={styles.label} nativeID="firstNameLabel">First name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="e.g. Talys Matheus"
            placeholderTextColor={ios.tertiaryLabel}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
            accessibilityLabelledBy="firstNameLabel"
          />
          <Text style={styles.label} nativeID="lastNameLabel">Last name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="e.g. Cordeiro Silva"
            placeholderTextColor={ios.tertiaryLabel}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            returnKeyType="done"
            accessibilityLabelledBy="lastNameLabel"
          />

          <TouchableOpacity
            style={[styles.primary, !canSave && styles.primaryDisabled]}
            disabled={!canSave}
            onPress={() => onSave({ firstName, lastName })}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onCancel} activeOpacity={0.6} accessibilityRole="button">
            <Text style={styles.secondaryText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: ios.systemGroupedBackground,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingTop: 8, paddingHorizontal: 20,
  },
  handle: {
    width: 36, height: 5, borderRadius: 3, backgroundColor: ios.opaqueSeparator,
    alignSelf: 'center', marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: ios.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', color: ios.label, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: ios.secondaryLabel, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '700', color: ios.secondaryLabel, marginBottom: 6, marginTop: 4 },
  input: {
    fontFamily: fonts.regular,
    backgroundColor: ios.secondarySystemGroupedBackground,
    borderRadius: 12, paddingHorizontal: 14, height: 48,
    fontSize: 17, color: ios.label, marginBottom: 12,
  },
  primary: {
    backgroundColor: ios.accent, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  secondary: { height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: ios.accent, fontSize: 17 },
});
