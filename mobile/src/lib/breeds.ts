// Nome de raça para MOSTRAR. O catálogo do backend usa a grafia inglesa
// «Limousin»; a app, o piloto, a ACL e os documentos da EUC usam «Limousine».
// Os animais vindos da nuvem chegavam com uma e os scans locais com a outra.
// Toda a apresentação passa por aqui, para a app dizer sempre o mesmo.
const DISPLAY: Record<string, string> = {
  default: 'Unspecified',
  limousin: 'Limousine',
  limousine: 'Limousine',
};

export function breedLabel(raw?: string | null): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (!key) return 'Unspecified';
  return DISPLAY[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
