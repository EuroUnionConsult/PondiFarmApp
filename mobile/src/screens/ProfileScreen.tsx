import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Animated, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../lib/ThemeContext';
import Text from '../components/Text';
import ScreenBackground from '../components/ScreenBackground';
import ProfileSheet from '../components/ProfileSheet';
import ThemeToggle from '../components/ThemeToggle';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';
import CompactHeader, { useScrollY } from '../components/CompactHeader';
import { type Palette } from '../lib/theme';
import { useAuth } from '../lib/AuthContext';
import { initials, loadProfile, saveProfile, type Profile } from '../lib/profile';
import {
  approveRequest, cancelMyRequest, leaveOrganization, listPendingRequests, listPeople, rejectRequest,
  removePerson, transferLeadership, type OrgPerson, type PendingJoinRequest,
} from '../lib/orgs';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;


export default function ProfileScreen() {
  const { colors: ios } = useTheme();
  const styles = useMemo(() => makeStyles(ios), [ios]);
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { user, logout, refreshMe } = useAuth();
  const orgId = user?.organizationId ?? null;
  const isLeader = user?.role === 'leader';
  const isPending = user?.membershipStatus === 'pending';
  const { scrollY, onScroll } = useScrollY();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [people, setPeople] = useState<OrgPerson[]>([]);
  const [requests, setRequests] = useState<PendingJoinRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadProfile(user?.id).then(setProfile); }, [user?.id]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [p, r] = await Promise.all([
        listPeople(orgId),
        isLeader ? listPendingRequests(orgId) : Promise.resolve([] as PendingJoinRequest[]),
      ]);
      setPeople(p);
      setRequests(r);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [orgId, isLeader]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await refreshMe(); // o papel pode ter mudado (passar liderança, sair)
      await load();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusyId(null);
    }
  };

  const manage = (p: OrgPerson) => {
    if (!orgId) return;
    Alert.alert(p.name, p.email, [
      {
        text: 'Make leader',
        onPress: () => Alert.alert(
          `Make ${p.name} the leader?`,
          'You become a member and can no longer approve requests or manage people.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Make leader', onPress: () => act(p.userId, () => transferLeadership(orgId, p.userId)) },
          ],
        ),
      },
      {
        text: 'Remove from organization',
        style: 'destructive',
        onPress: () => Alert.alert(
          `Remove ${p.name}?`,
          'They lose access to the organization’s data right away.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => act(p.userId, () => removePerson(orgId, p.userId)) },
          ],
        ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const leave = () => {
    if (!orgId) return;
    Alert.alert('Leave organization?', `You stop seeing ${user?.organizationName}’s data.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => act('leave', () => leaveOrganization(orgId)) },
    ]);
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', user ? `Sign out of ${user.email}?` : 'Sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void logout(); } },
    ]);
  };

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : (user?.name ?? '');
  const avatar = initials(profile, user?.name);

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={ios.accent} />}
      >
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.back} onPress={() => nav.goBack()} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color={ios.accent} />
            <Text style={styles.backText}>Home</Text>
          </TouchableOpacity>
          <ThemeToggle />
        </View>

        {/* Quem sou */}
        <FadeInView index={0} style={styles.hero}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => setEditing(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
          >
            {avatar
              ? <Text style={styles.avatarText}>{avatar}</Text>
              : <Ionicons name="person" size={30} color="#FFFFFF" />}
          </TouchableOpacity>
          <Text style={styles.name}>{displayName || 'Your name'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>Edit name</Text>
          </TouchableOpacity>
        </FadeInView>

        {/* Organização */}
        <FadeInView index={1}>
        <Text style={styles.sectionHeader}>Organization</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowKey}>Name</Text>
            <Text style={styles.rowVal} numberOfLines={1}>
              {(isPending ? user?.pendingOrganizationName : user?.organizationName) || '—'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowKey}>Your role</Text>
            {isPending ? (
              <View style={[styles.roleBadge, styles.rolePending]}>
                <Text style={[styles.roleText, styles.rolePendingText]}>Waiting for approval</Text>
              </View>
            ) : user?.role ? (
              <View style={[styles.roleBadge, isLeader ? styles.roleLeader : styles.roleMember]}>
                <Text style={[styles.roleText, isLeader ? styles.roleLeaderText : styles.roleMemberText]}>
                  {isLeader ? 'Leader' : 'Member'}
                </Text>
              </View>
            ) : (
              <Text style={styles.rowVal}>Not available yet</Text>
            )}
          </View>
          {isPending && (
            <>
              <View style={styles.divider} />
              <Text style={styles.pendingNote}>
                Until the leader approves you, you don’t see the organization’s herd and your scans
                stay on this phone. They are sent automatically once you’re approved.
              </Text>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.row}
                onPress={() => Alert.alert('Cancel your request?', 'You can ask to join again later.', [
                  { text: 'Keep it', style: 'cancel' },
                  { text: 'Cancel request', style: 'destructive', onPress: () => act('cancel', cancelMyRequest) },
                ])}
                accessibilityRole="button"
              >
                <Text style={[styles.rowKey, { color: ios.danger }]}>Cancel request</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        </FadeInView>

        {/* Pedidos (só Líder) */}
        {isLeader && (
          <FadeInView index={2}>
            <Text style={styles.sectionHeader}>Requests to join · {requests.length}</Text>
            <View style={styles.card}>
              {requests.length === 0 ? (
                <Text style={styles.empty}>No pending requests.</Text>
              ) : requests.map((r, i) => (
                <View key={r.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.personRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.personName} numberOfLines={1}>{r.userName}</Text>
                      <Text style={styles.personEmail} numberOfLines={1}>{r.userEmail}</Text>
                    </View>
                    {busyId === r.id ? <ActivityIndicator color={ios.accent} /> : (
                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={styles.reject}
                          onPress={() => orgId && act(r.id, () => rejectRequest(orgId, r.id))}
                          accessibilityRole="button"
                          accessibilityLabel={`Reject ${r.userName}`}
                        >
                          <Text style={styles.rejectText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.approve}
                          onPress={() => orgId && act(r.id, () => approveRequest(orgId, r.id))}
                          accessibilityRole="button"
                          accessibilityLabel={`Approve ${r.userName}`}
                        >
                          <Text style={styles.approveText}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </FadeInView>
        )}

        {/* Membros */}
        {orgId && (
          <FadeInView index={3}>
            <Text style={styles.sectionHeader}>Members · {people.length}</Text>
            <View style={styles.card}>
              {people.map((p, i) => {
                const me = p.userId === user?.id;
                const canManage = isLeader && !me;
                return (
                  <View key={p.userId}>
                    {i > 0 && <View style={styles.divider} />}
                    <PressableScale
                      style={styles.personRow}
                      disabled={!canManage || busyId !== null}
                      onPress={() => manage(p)}
                      scaleTo={0.985}
                      accessibilityRole={canManage ? 'button' : undefined}
                      accessibilityLabel={canManage ? `Manage ${p.name}` : undefined}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.personName} numberOfLines={1}>{p.name}{me ? ' (you)' : ''}</Text>
                        <Text style={styles.personEmail} numberOfLines={1}>{p.email}</Text>
                      </View>
                      {busyId === p.userId ? <ActivityIndicator color={ios.accent} /> : (
                        <>
                          <Text style={styles.personRole}>{p.role === 'leader' ? 'Leader' : 'Member'}</Text>
                          {canManage && <Ionicons name="ellipsis-horizontal" size={18} color={ios.tertiaryLabel} />}
                        </>
                      )}
                    </PressableScale>
                  </View>
                );
              })}
            </View>
            {isLeader && <Text style={styles.footer}>Tap a member to make them leader or remove them.</Text>}
          </FadeInView>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {/* App */}
        <FadeInView index={4}>
        <Text style={styles.sectionHeader}>App</Text>
        <View style={styles.card}>
          <PressableScale style={styles.row} onPress={() => nav.navigate('Settings')} scaleTo={0.985} accessibilityRole="button">
            <Ionicons name="settings-outline" size={20} color={ios.secondaryLabel} />
            <Text style={[styles.rowKey, { flex: 1 }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={ios.tertiaryLabel} />
          </PressableScale>
          {orgId && !isLeader && user?.role === 'member' && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={leave} accessibilityRole="button">
                <Text style={[styles.rowKey, { color: ios.danger }]}>Leave organization</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={confirmSignOut} accessibilityRole="button">
            <Text style={[styles.rowKey, { color: ios.danger }]}>Sign out</Text>
          </TouchableOpacity>
        </View>
        </FadeInView>
      </Animated.ScrollView>
      <CompactHeader title={displayName || 'Profile'} scrollY={scrollY} threshold={150} />

      <ProfileSheet
        visible={editing}
        initial={profile}
        onSave={async p => { await saveProfile(user?.id, p); setProfile(p); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    </View>
  );
}

const makeStyles = (ios: Palette) => StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 },
  back: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, minHeight: 44 },
  backText: { color: ios.accent, fontSize: 17 },
  hero: { alignItems: 'center', gap: 4, paddingHorizontal: 16, marginTop: 4 },
  avatar: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: ios.accentFill,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarText: { color: '#FFFFFF', fontSize: 30, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '700', color: ios.label, textAlign: 'center' },
  email: { fontSize: 15, color: ios.secondaryLabel },
  link: { fontSize: 15, color: ios.accent, marginTop: 6 },
  sectionHeader: {
    paddingHorizontal: 32, paddingTop: 26, paddingBottom: 8,
    fontSize: 13, color: ios.secondaryLabel, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  card: {
    marginHorizontal: 16, borderRadius: 14,
    backgroundColor: ios.secondarySystemGroupedBackground, overflow: 'hidden',
  },
  row: { minHeight: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowKey: { fontSize: 17, color: ios.label },
  rowVal: { flex: 1, textAlign: 'right', fontSize: 17, color: ios.secondaryLabel },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: ios.separator, marginLeft: 16 },
  roleBadge: { marginLeft: 'auto', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleLeader: { backgroundColor: ios.accentLight },
  roleMember: { backgroundColor: ios.navyLight },
  roleText: { fontSize: 14, fontWeight: '700' },
  roleLeaderText: { color: ios.accentDark },
  roleMemberText: { color: ios.navy },
  rolePending: { backgroundColor: ios.orangeLight },
  rolePendingText: { color: ios.orangeText },
  pendingNote: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, lineHeight: 20, color: ios.secondaryLabel },
  empty: { padding: 16, fontSize: 15, color: ios.secondaryLabel },
  personRow: { minHeight: 60, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName: { fontSize: 17, color: ios.label },
  personEmail: { fontSize: 14, color: ios.secondaryLabel },
  personRole: { fontSize: 15, color: ios.secondaryLabel },
  actions: { flexDirection: 'row', gap: 8 },
  approve: { backgroundColor: ios.accentFill, borderRadius: 10, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  approveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  reject: { borderRadius: 10, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', backgroundColor: ios.dangerLight },
  rejectText: { color: ios.danger, fontSize: 15, fontWeight: '700' },
  footer: { paddingHorizontal: 32, paddingTop: 8, fontSize: 13, color: ios.secondaryLabel },
  error: { color: ios.danger, fontSize: 14, textAlign: 'center', marginTop: 16, paddingHorizontal: 24 },
});
