import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Text from './Text';
import PressableScale from './PressableScale';
import { ios } from '../lib/theme';
import { useAuth } from '../lib/AuthContext';
import type { RootStackParamList } from '../navigation/types';

// Aviso para quem pediu entrada e espera pelo Líder. A app funciona: os scans
// ficam no telemóvel e sobem sozinhos quando o pedido for aprovado.
// Não aparece a mais ninguém.
export default function PendingApprovalBanner() {
  const { user } = useAuth();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (user?.membershipStatus !== 'pending') return null;
  const org = user.pendingOrganizationName || 'the organization';

  return (
    <PressableScale
      style={styles.banner}
      onPress={() => nav.navigate('Profile')}
      accessibilityRole="button"
      accessibilityLabel={`Waiting for approval from ${org}. Open your profile.`}
    >
      <View style={styles.icon}>
        <Ionicons name="hourglass-outline" size={20} color={ios.orangeText} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title}>Waiting for approval</Text>
        <Text style={styles.text}>
          You can scan as usual. Scans stay on this phone until the leader of {org} approves
          you; then you’ll see the organization’s herd and your scans are sent.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={ios.tertiaryLabel} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16, marginTop: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16,
    backgroundColor: '#FFF7F0',
    borderWidth: 1, borderColor: 'rgba(194,97,31,0.25)',
  },
  icon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: ios.orangeLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: ios.label },
  text: { fontSize: 14, lineHeight: 19, color: ios.secondaryLabel, marginTop: 2 },
});
