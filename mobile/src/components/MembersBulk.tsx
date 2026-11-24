// Seleção em massa na lista de membros e pedidos (só o Líder). Partilhado pelo
// Perfil do iPhone/web de telemóvel (ProfileScreen) e pelo Perfil de computador
// (web/ProfilePage): a lógica (useMembersBulk), a caixa de seleção do telemóvel (SelectBox) e
// a barra de ações com confirmação, progresso e resumo (BulkActionBar).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from './Text';
import { useTheme } from '../lib/ThemeContext';
import type { Palette } from '../lib/theme';
import { trackCloud } from '../lib/activity';
import { showToast, useToastLift } from './Toast';
import {
  bulkDecideRequests, bulkRemovePeople, summarizeBulkParts,
  type OrgPerson, type PendingJoinRequest,
} from '../lib/orgs';

export type BulkKind = 'approve' | 'deny' | 'remove';

const VERB: Record<BulkKind, string> = { approve: 'approved', deny: 'denied', remove: 'removed' };
const ING: Record<BulkKind, string> = { approve: 'Approving', deny: 'Denying', remove: 'Removing' };

const keep = (s: Set<string>, valid: string[]) => {
  const v = new Set(valid);
  const next = new Set(Array.from(s).filter((id) => v.has(id)));
  return next.size === s.size ? s : next;
};

/** Pode ser escolhido para remover: nem a própria conta nem o Líder. */
export const canBulkSelectPerson = (p: OrgPerson, myId: string | undefined) => p.userId !== myId && p.role !== 'leader';

export function useMembersBulk({ orgId, requests, people, myId, reload }: {
  orgId: string | null;
  requests: PendingJoinRequest[];
  people: OrgPerson[] | null;
  myId: string | undefined;
  reload: () => Promise<unknown>;
}) {
  const [selecting, setSelecting] = useState(false);
  const [reqSel, setReqSel] = useState<Set<string>>(() => new Set());
  const [memSel, setMemSel] = useState<Set<string>>(() => new Set());
  const [running, setRunning] = useState<BulkKind | null>(null);

  const requestIds = useMemo(() => requests.map((r) => r.id), [requests]);
  const memberIds = useMemo(() => (people ?? []).filter((p) => canBulkSelectPerson(p, myId)).map((p) => p.userId), [people, myId]);

  // A lista mudou (recarregou, alguém foi tratado noutro sítio): larga o que já não existe.
  useEffect(() => { setReqSel((s) => keep(s, requestIds)); }, [requestIds]);
  useEffect(() => { setMemSel((s) => keep(s, memberIds)); }, [memberIds]);

  const flip = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const allRequests = requestIds.length > 0 && requestIds.every((id) => reqSel.has(id));
  const allMembers = memberIds.length > 0 && memberIds.every((id) => memSel.has(id));

  const start = useCallback((pre?: { kind: 'request' | 'member'; id: string }) => {
    setSelecting(true);
    if (pre?.kind === 'request') setReqSel((s) => new Set(s).add(pre.id));
    if (pre?.kind === 'member') setMemSel((s) => new Set(s).add(pre.id));
  }, []);
  const stop = useCallback(() => { setSelecting(false); setReqSel(new Set()); setMemSel(new Set()); }, []);

  const run = async (kind: BulkKind) => {
    if (!orgId || running) return;
    const ids = Array.from(kind === 'remove' ? memSel : reqSel);
    if (ids.length === 0) return;
    setRunning(kind);
    try {
      const r = await trackCloud(kind === 'remove' ? bulkRemovePeople(orgId, ids) : bulkDecideRequests(orgId, ids, kind));
      showToast({ ...summarizeBulkParts(r, VERB[kind]), tone: r.failed === 0 ? 'success' : r.succeeded > 0 ? 'warning' : 'error' });
      // Os que falharam ficam escolhidos (se ainda estiverem na lista) para se verem.
      const failed = new Set(r.results.filter((x) => !x.ok).map((x) => x.id));
      const otherLeft = kind === 'remove' ? reqSel.size : memSel.size;
      if (kind === 'remove') setMemSel(failed); else setReqSel(failed);
      await reload();
      if (failed.size === 0 && otherLeft === 0) setSelecting(false);
    } catch (e: any) {
      // A seleção fica como estava para tentar outra vez.
      const what = kind === 'remove' ? 'remove members' : kind === 'approve' ? 'approve requests' : 'deny requests';
      showToast({ tone: 'error', title: `Couldn’t ${what}`, detail: `${String(e?.message ?? e)}. Your selection is kept; try again.` });
    } finally {
      setRunning(null);
    }
  };

  return {
    selecting, start, stop, running, run,
    reqSel, memSel,
    isRequestSelected: (id: string) => reqSel.has(id),
    isMemberSelected: (id: string) => memSel.has(id),
    toggleRequest: (id: string) => flip(setReqSel, id),
    toggleMember: (id: string) => flip(setMemSel, id),
    allRequests, allMembers,
    hasRequests: requestIds.length > 0,
    hasMembers: memberIds.length > 0,
    toggleAllRequests: () => setReqSel(allRequests ? new Set() : new Set(requestIds)),
    toggleAllMembers: () => setMemSel(allMembers ? new Set() : new Set(memberIds)),
  };
}

export type MembersBulk = ReturnType<typeof useMembersBulk>;

// --- Caixa de seleção ---------------------------------------------------------

/** O desenho da caixa; a linha inteira faz de caixa (alvo de toque grande, um só elemento acessível). */
export function SelectBox({ checked }: { checked: boolean }) {
  const { colors: c } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.boxWrap}>
      <View style={[s.box, { borderColor: checked ? c.accentFill : c.tertiaryLabel }, checked && { backgroundColor: c.accentFill }]}>
        {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
      </View>
    </View>
  );
}

// --- Botão da barra -----------------------------------------------------------

function Btn({ label, onPress, tone, disabled, a11y, btnRef, grow = true }: {
  label: string; onPress: () => void; tone: 'go' | 'danger' | 'plain' | 'danger-soft'; disabled?: boolean; a11y?: string; btnRef?: React.Ref<View>; grow?: boolean;
}) {
  const { colors: c } = useTheme();
  const st = useMemo(() => makeStyles(c), [c]);
  // No escuro o vermelho do texto é claro demais para fundo de botão com letra branca.
  const bg = tone === 'go' ? c.accentFill : tone === 'danger' ? (c.isDark ? '#B42318' : c.danger) : tone === 'danger-soft' ? c.dangerLight : c.segmentFill;
  const fg = tone === 'go' || tone === 'danger' ? '#FFFFFF' : tone === 'danger-soft' ? c.danger : c.label;
  return (
    <Pressable
      ref={btnRef}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={(p: any) => [st.btn, grow && { flexGrow: 1 }, { backgroundColor: bg }, disabled && { opacity: 0.45 }, p.pressed && { opacity: 0.8 },
        p.focused && { borderColor: c.accent }, p.hovered && !disabled && { opacity: 0.9 }]}
    >
      <Text style={[st.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// --- Barra de ações -----------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function BulkActionBar({ bulk, orgName, style }: { bulk: MembersBulk; orgName?: string; style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useTheme();
  const st = useMemo(() => makeStyles(c), [c]);
  const [ask, setAsk] = useState<BulkKind | null>(null);
  const okRef = useRef<View>(null);
  const nReq = bulk.reqSel.size, nMem = bulk.memSel.size, total = nReq + nMem;
  // Os avisos sobem para não taparem a barra.
  useToastLift(150, bulk.selecting);

  // A confirmação desaparece se a seleção ficar vazia (ex.: lista recarregou).
  useEffect(() => { if (ask && (ask === 'remove' ? nMem : nReq) === 0) setAsk(null); }, [ask, nReq, nMem]);
  useEffect(() => { if (!bulk.selecting) setAsk(null); }, [bulk.selecting]);

  // Web: foco no botão de confirmar e Escape para cancelar.
  useEffect(() => {
    if (Platform.OS !== 'web' || !ask) return;
    (okRef.current as any)?.focus?.();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsk(null); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [ask]);

  if (!bulk.selecting) return null;

  const confirmText = (k: BulkKind) => {
    if (k === 'approve') return { title: `Approve ${plural(nReq, 'request', 'requests')}?`, body: `They join ${orgName || 'the organization'} as members and see its data.`, action: `Approve (${nReq})`, tone: 'go' as const };
    if (k === 'deny') return { title: `Deny ${plural(nReq, 'request', 'requests')}?`, body: 'They won’t join the organization. They can ask again later.', action: `Deny (${nReq})`, tone: 'danger' as const };
    return { title: `Remove ${plural(nMem, 'member', 'members')}?`, body: 'They lose access to the organization’s data right away.', action: `Remove (${nMem})`, tone: 'danger' as const };
  };

  return (
    <View style={[st.wrap, style]} pointerEvents="box-none">
      <View style={st.bar} accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined} accessibilityLabel="Selection actions">
        {bulk.running ? (
          <View style={st.runRow} accessibilityLiveRegion="polite">
            <ActivityIndicator color={c.accent} />
            <Text style={st.count}>{ING[bulk.running]} {bulk.running === 'remove' ? nMem : nReq}…</Text>
          </View>
        ) : ask ? (() => {
          const t = confirmText(ask);
          return (
            <View style={{ gap: 10 }} accessibilityRole={Platform.OS === 'web' ? ('alertdialog' as any) : undefined} accessibilityLabel={t.title}>
              <Text style={st.askTitle}>{t.title}</Text>
              <Text style={st.askBody}>{t.body}</Text>
              <View style={st.actions}>
                <Btn label="Cancel" tone="plain" onPress={() => setAsk(null)} />
                <Btn btnRef={okRef} label={t.action} tone={t.tone} onPress={() => { const k = ask; setAsk(null); void bulk.run(k); }} />
              </View>
            </View>
          );
        })() : (
          <>
            <View style={st.head}>
              <Text style={st.count} accessibilityLiveRegion="polite">{total === 0 ? 'Select people' : `${total} selected`}</Text>
              <Btn label="Done" tone="plain" onPress={bulk.stop} a11y="Done selecting" grow={false} />
            </View>
            {total === 0 ? (
              <Text style={st.hint}>Tick requests or members, then choose what to do.</Text>
            ) : (
              <View style={st.actions}>
                {nReq > 0 && <Btn label={`Approve (${nReq})`} tone="go" onPress={() => setAsk('approve')} />}
                {nReq > 0 && <Btn label={`Deny (${nReq})`} tone="danger-soft" onPress={() => setAsk('deny')} />}
                {nMem > 0 && <Btn label={`Remove (${nMem})`} tone="danger" onPress={() => setAsk('remove')} />}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  boxWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10, marginRight: -4 },
  box: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: { gap: 8 },
  bar: {
    borderRadius: 18, padding: 14, gap: 10,
    backgroundColor: c.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.separator,
    shadowColor: '#000', shadowOpacity: c.isDark ? 0.5 : 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  count: { fontSize: 16, fontWeight: '700', color: c.label },
  hint: { fontSize: 14, color: c.secondaryLabel },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  btn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  btnText: { fontSize: 15, fontWeight: '700' },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  askTitle: { fontSize: 17, fontWeight: '700', color: c.label },
  askBody: { fontSize: 14, lineHeight: 20, color: c.secondaryLabel },
});
