import AsyncStorage from '@react-native-async-storage/async-storage';

// Nome de apresentação do utilizador, guardado no telemóvel. Nome e apelido
// ficam em campos separados porque a conta só tem um `name` corrido: em
// «Talys Matheus Cordeiro Silva» não há maneira de saber qual é o apelido que
// conta para as iniciais. Com os campos à parte, a regra é simples: primeira
// letra do nome + primeira letra do apelido → «Talys Matheus» + «Cordeiro Silva» = TC.

export interface Profile {
  firstName: string;
  lastName: string;
}

// Por conta: dois utilizadores no mesmo telemóvel não partilham o nome.
const keyFor = (userId?: string | null) => `pondifarm.profile.${userId || 'local'}`;

export async function loadProfile(userId?: string | null): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile>;
    const firstName = (p.firstName ?? '').trim();
    const lastName = (p.lastName ?? '').trim();
    return firstName || lastName ? { firstName, lastName } : null;
  } catch {
    return null;
  }
}

export async function saveProfile(userId: string | null | undefined, p: Profile): Promise<void> {
  await AsyncStorage.setItem(
    keyFor(userId),
    JSON.stringify({ firstName: p.firstName.trim(), lastName: p.lastName.trim() }),
  );
}

function firstLetter(s: string): string {
  const w = s.trim().split(/\s+/)[0] ?? '';
  return w ? w[0].toLocaleUpperCase('pt-PT') : '';
}

/** Iniciais a mostrar no avatar, ou '' quando ainda não há nome nenhum. */
export function initials(profile: Profile | null, accountName?: string | null): string {
  if (profile) return firstLetter(profile.firstName) + firstLetter(profile.lastName);
  // Sem perfil guardado: primeira e última palavra do nome da conta, que é o
  // melhor palpite possível sem saber qual é o apelido. Editável no avatar.
  const words = (accountName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return firstLetter(words[0]);
  return firstLetter(words[0]) + firstLetter(words[words.length - 1]);
}
