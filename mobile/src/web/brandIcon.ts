// Ícone da marca para as <img> da versão web (login, barra lateral, transição).
// Na web, o Metro do Expo transforma o require de uma imagem num objeto
// { uri, width, height }, por isso não é preciso o expo-asset.
export const BRAND_ICON: string = (require('../../assets/icon.png') as { uri: string }).uri;
