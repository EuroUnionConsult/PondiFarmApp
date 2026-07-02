// Fonte única da URL do backend — NÃO espalhar pelo código nem expor na UI.
//
// Produção (após deploy M5): trocar por URL pública HTTPS do Azure App Service.
// Agora (dev/demo no hotspot do iPhone): IP da LAN do Mac. Se o IP do hotspot
// mudar, use o override de dev nas Configurações (só aparece em builds __DEV__),
// que persiste no dispositivo sem precisar recompilar.
export const DEFAULT_BACKEND_URL = 'http://172.20.10.4:8000';

// Chaves de armazenamento local (device).
export const CFG_KEY = '@pondifarm:config';
export const LEGACY_CFG_KEY = '@boviscan:config';
// Override de URL só para desenvolvimento (nunca exposto ao usuário final).
export const DEV_SERVER_KEY = '@pondifarm:devServerUrl';
// Preferência do usuário: sincronizar com a nuvem (default: ligado).
export const CLOUD_SYNC_KEY = '@pondifarm:cloudSync';
