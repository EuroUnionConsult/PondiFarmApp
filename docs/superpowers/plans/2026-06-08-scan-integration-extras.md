# RN Integration + Extras + Remove Fake — Implementation Plan (EURODEV-77, Fase 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Trocar o fluxo de scan fake (foto 2D + dados fabricados) pelo **scanner LiDAR real** no `ScanScreen`; adicionar categoria **Bovino/Extra**; remover **todo dado fake** (`demoData.ts`, `buildDemoResult`, banner demo, seção Detection, barra de confiança fabricada, foto/overlay 2D); remover a tela temp `LidarTest`. Mantém o design iOS HIG / Liquid Health.

**Architecture:** O `ScanScreen` monta `LidarScannerView` (Fase 1–3) com botões Iniciar/Parar; `onScanComplete` → monta um `ScanRecord` novo (medidas reais + meshUri + categoria) → salva (AsyncStorage) → `Result`. Modelo `ScanRecord` reescrito: sem `detection`/`_isDemo`/`confidence`/peso fabricados. `Result`/`Herd`/`Analytics` adaptados ao novo modelo. Compartilhar `.obj` via `expo-sharing`.

**Tech Stack:** RN/TS, expo-sharing, módulo lidar-scanner. SEM código nativo novo → após UM rebuild, tudo é Fast Refresh.

**Base:** branch `EURODEV-77/scan-rn-integration-extras` a partir de `EURODEV-76/lidar-measurements-pca`.

**Decisões (honrar "nada fake"):**
- Remover `demoData.ts` e `buildDemoResult`/`scanAnimal` (foto) de `api.ts`. Manter `getBackendUrl`/`checkHealth` (usados em Settings).
- Sem `detection` (não há YOLO no LiDAR), sem barra de confiança fabricada, sem `imageUri`/overlay 2D, sem banner demo.
- **SEM PESO nesta fase (decisão Talys 08/06):** só medidas reais + malha. Peso só virá quando houver modelo treinado + dado de campo (balança). Nada de número derivado/estimado por enquanto.
- `extra`: sem raça — só medidas + malha (marca testes objeto/pessoa).

---

### Task 1: Branch + plano
- [ ] `git checkout EURODEV-76/lidar-measurements-pca && git checkout -b EURODEV-77/scan-rn-integration-extras`
- [ ] `git add docs/superpowers/plans/2026-06-08-scan-integration-extras.md && git commit -m "docs: add EURODEV-77 phase-4 integration plan"`

---

### Task 2: Novo modelo de dados + peso + remover demoData

**Files:** Modify `mobile/src/lib/storage.ts`, `mobile/src/lib/api.ts`; Create `mobile/src/lib/weight.ts`; Delete `mobile/src/lib/demoData.ts`.

- [ ] **Step 1: `mobile/src/lib/storage.ts` — novo `ScanRecord` (substituir o arquivo inteiro):**
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ScanCategory = 'cow' | 'extra';

export interface Measurements {
  body_length_cm: number;
  withers_height_cm: number;
  thoracic_depth_cm: number;
  rump_width_cm: number;
  chest_girth_cm: number;
}

export interface ScanRecord {
  id: string;
  scannedAt: number;
  category: ScanCategory;
  source: 'lidar';
  animalId?: string;            // só bovino
  breed?: string;               // só bovino
  measurements: Measurements;   // sempre reais (geometria)
  vertexCount: number;          // peso fica de fora até ter modelo treinado (pós-22/06)
  faceCount: number;
  meshUri: string;
}

const KEY = '@boviscan:scans';

export async function saveRecord(record: ScanRecord): Promise<void> {
  const all = await listRecords();
  all.unshift(record);
  await AsyncStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
}
export async function listRecords(): Promise<ScanRecord[]> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
export async function deleteRecord(id: string): Promise<void> {
  const all = await listRecords();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter(r => r.id !== id)));
}
export async function clearAll(): Promise<void> { await AsyncStorage.removeItem(KEY); }
```

- [ ] **Step 2 (peso fica de fora):** NÃO criar `lib/weight.ts` nem nenhum cálculo de peso. Decisão Talys 08/06 — peso só após 22/06 (modelo treinado com dado de campo). Nesta fase o app não exibe nem calcula peso.

- [ ] **Step 3: `mobile/src/lib/api.ts` — remover o fake.** Abrir o arquivo. APAGAR: `import { getDemoResult } from './demoData'`, a função `buildDemoResult`, a função `scanAnimal` inteira, a interface `ScanResult` (não é mais usada). MANTER: `getBackendUrl` e `checkHealth` (usados em Settings). Conferir que nada mais importa `ScanResult`/`scanAnimal` (grep).

- [ ] **Step 4: Deletar o fake:**
```bash
rm /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp/mobile/src/lib/demoData.ts
```

- [ ] **Step 5: Typecheck (vai acusar erros nas telas que usam o shape antigo — esperado; Tasks 3–5 corrigem).** Rodar `cd mobile && npx tsc --noEmit` e anotar os arquivos que quebraram (ScanScreen, ResultScreen, HerdScreen, AnalyticsScreen). NÃO commitar ainda — Task 2 fecha junto com 3–5 num estado compilável. (Exceção ao "commit por task": este refactor cruza arquivos; commitar só quando `tsc` voltar verde no fim da Task 5.)

> ⚠️ Como este é um refactor encadeado, as Tasks 2–5 formam UM bloco: só há commit ao final (Task 5) com `tsc` verde. Cada subagente deixa o estado para o próximo.

---

### Task 3: `ScanScreen` — capturar com LiDAR + categoria

**Files:** Modify `mobile/src/screens/ScanScreen.tsx` (reescrita do fluxo de captura).

- [ ] **Step 1:** Ler o `ScanScreen.tsx` atual (estrutura: `PreScanModal` com ID+raça; `CameraView`; `handleScan` via `scanAnimal`; pipeline timer). Reescrever para:
  - **PreScan**: adicionar seletor **Categoria** (Bovino / Extra) no topo. Se `Extra`: ocultar ID e raça (opcionais). Manter o estilo dos chips de raça existentes para os chips de categoria.
  - Trocar `CameraView` + `takePicture`/`pickFromGallery`/`scanAnimal` por **`LidarScannerView`** (de `../../modules/lidar-scanner`) com ref + botões **Iniciar scan / Parar e exportar** (reusar o visual do `captureBtn`/controles).
  - `onScanComplete` → montar `ScanRecord`:
    ```ts
    const isCow = category === 'cow';
    const record: ScanRecord = {
      id: `${Date.now()}`,
      scannedAt: Date.now(),
      category,
      source: 'lidar',
      animalId: isCow ? (animalId || 'PT-—') : undefined,
      breed: isCow ? breed : undefined,
      measurements: e.nativeEvent.measurements!,
      vertexCount: e.nativeEvent.vertexCount,
      faceCount: e.nativeEvent.faceCount,
      meshUri: e.nativeEvent.meshUri,
    };
    await saveRecord(record);
    nav.replace('Result', { record });
    ```
  - Remover imports não usados (`expo-camera`, `expo-image-picker`, `scanAnimal`). Manter Haptics/insets. Permissão de câmera continua necessária (ARKit usa câmera) — manter o gate de permissão.
  - Validação: se `vertexCount < (mínimo, ex. 100)`, mostrar Alert "scan insuficiente, tente de novo" em vez de navegar.
- [ ] **Step 2:** Deixar o estado compilável para a próxima task (não commitar).

---

### Task 4: `ResultScreen` — sem fake, com categoria + peso preliminar + share

**Files:** Modify `mobile/src/screens/ResultScreen.tsx`.

- [ ] **Step 1:** Ler o `ResultScreen.tsx` atual e reescrever, REMOVENDO: `MeasurementOverlay` + foto (`record.imageUri`), banner demo (`_isDemo`), seção **Detection**, barra de **confiança**. MANTER o layout iOS HIG (cards, hero, sectionHeader). Novo conteúdo:
  - Topo (navbar): título = `record.category === 'cow' ? record.animalId : 'Scan (extra)'`. Botão share → `Sharing.shareAsync(record.meshUri)`.
  - **Badge de categoria** (pill): "Bovino" (sage) ou "Extra" (cinza).
  - **SEM hero de peso** (peso fica de fora até modelo treinado, pós-22/06). O destaque passa a ser as **medidas** + a malha. Opcional: um aviso discreto "Peso disponível após calibração com dados de campo" — sem número.
  - **Measurements**: as 5 medidas reais (mesmo card de antes) — agora a seção principal.
  - **Nova seção "Scan"**: Categoria, Origem = "LiDAR (on-device)", Vértices, Faces.
  - Footer: "Captured at …" (igual). Ações: New scan / View herd (igual).
- [ ] **Step 2:** Deixar compilável.

---

### Task 5: Herd/Analytics + remover tela temp + fechar (tsc + commit)

**Files:** Modify `mobile/src/screens/HerdScreen.tsx`, `mobile/src/screens/AnalyticsScreen.tsx`, `mobile/src/screens/HomeScreen.tsx`, `mobile/src/navigation/types.ts`, `mobile/src/navigation/AppNavigator.tsx`; Delete `mobile/src/screens/LidarTestScreen.tsx`.

- [ ] **Step 1:** Ler `HerdScreen.tsx` e `AnalyticsScreen.tsx`; adaptar ao novo `ScanRecord` (campos: `category`, `animalId`, `measurements`, `estimatedWeightKg?`). Onde liam `record.animal_id`/`record.result.estimated_weight_kg`/`detection` → trocar por `record.animalId`/`record.estimatedWeightKg`/remover. Mostrar peso só quando existir; badge de categoria na lista do Herd. Em Analytics, se agrega peso, considerar só `cow` com `estimatedWeightKg` definido.
- [ ] **Step 2: Remover a tela temp:** apagar `LidarTestScreen.tsx`; remover `LidarTest: undefined;` de `navigation/types.ts`; remover o import + `<Stack.Screen name="LidarTest" .../>` de `AppNavigator.tsx`; remover o bloco `{__DEV__ && (...LidarTest...)}` de `HomeScreen.tsx`.
- [ ] **Step 3: Typecheck até verde:**
```bash
cd mobile && npx tsc --noEmit
```
Resolver TODOS os erros remanescentes do refactor. Expected final: exit 0.
- [ ] **Step 4: Commit único do bloco 2–5:**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/src mobile/package.json
git commit -m "feat(mobile): integrate LiDAR scanner into Scan flow, add extras category, remove fake demo path"
```
(Se preferir granular, pode commitar storage+weight+api+rm demoData primeiro e o resto depois — mas só com tsc verde em cada commit.)

---

### Task 6 (verificação — consolidada com a Fase 5, no device do Talys)
- [ ] Rebuild (1x — `expo-sharing` já está; sem nativo novo) → fluxo: Home → Novo scan → escolher Bovino/Extra → escanear → Result mostra medidas reais + (bovino) peso preliminar rotulado + share do `.obj`. Conferir que **nenhuma tela mostra dado fabricado** e que o app não tem mais a tela LidarTest.

---

## Self-Review

**Spec coverage (EURODEV-77):**
- Integrar scanner no ScanScreen real → Task 3. ✅
- Categoria extras (cow/extra) → Tasks 2 (modelo) + 3 (seletor) + 4/5 (badge). ✅
- Remover fake (demoData, buildDemoResult, detection, confiança, banner, imageUri, tela temp) → Tasks 2,4,5. ✅
- Manter iOS HIG → Tasks 3,4 (reusar tokens/estilos). ✅
- Peso: **fora desta fase** (decisão Talys 08/06; entra só pós-22/06 com modelo treinado). Nenhum cálculo/estimativa de peso. ✅

**Consistência de tipos:** `ScanRecord`/`Measurements` (storage) é a única fonte; `onScanComplete` nativo emite `measurements`+counts; `RootStackParamList.Result: { record: ScanRecord }`. Removido `ScanResult`/`scanAnimal`/`_isDemo`/`detection`/peso.

**Honestidade:** zero dado fabricado — só medidas e malha reais; **nenhum número de peso** (não há modelo treinado ainda). Sem jest (não há infra no projeto). Refactor encadeado → commit só com `tsc` verde.
