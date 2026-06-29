# LiDAR Native Module Scaffold — Implementation Plan (EURODEV-74, Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um módulo Expo nativo local (`lidar-scanner`) que renderiza uma `ARView` (RealityKit/ARKit) dentro de uma tela React Native num iPhone com LiDAR, e expor uma checagem `isLidarSupported()` com fallback — provando a ponte nativa antes da captura (Fase 2).

**Architecture:** O app continua RN/Expo managed (SDK 54, newArch). Saímos do managed-puro para um **development build** (`expo-dev-client`) e criamos um **Expo Module local** (`modules/lidar-scanner`) com uma `ExpoView` que embute uma `ARView`. A sessão ARKit roda com `sceneReconstruction = .mesh` quando suportado, e mostra a malha (`showSceneUnderstanding`) para confirmação visual. `startScan`/`stopScan`/`onScanComplete` ficam como stubs (preenchidos na Fase 2).

**Tech Stack:** Expo SDK 54, React Native 0.81.5, expo-modules-core (Module DSL), Swift, ARKit, RealityKit, expo-dev-client, expo-build-properties.

**Escopo:** Só a EURODEV-74. Captura de malha = EURODEV-75; medidas = EURODEV-76.

**Pré-requisitos de hardware/conta:** iPhone com LiDAR (12 Pro+) ligado por cabo, Xcode instalado, conta Apple Developer para assinar o dev build no device (team `tcord`).

---

### Task 1: Branch + dependências do dev build

**Files:**
- Modify: `mobile/app.json`
- Modify: `mobile/package.json` (via instalador)

- [ ] **Step 1: Criar a branch a partir de `main`**

Run (na raiz do repo):
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git checkout main && git pull --ff-only
git checkout -b EURODEV-74/lidar-native-module-scaffold
```

- [ ] **Step 2: Instalar expo-dev-client e expo-build-properties**

Run (dentro de `mobile/`):
```bash
cd mobile
npx expo install expo-dev-client expo-build-properties
```
Expected: ambos adicionados em `package.json` com versões compatíveis com SDK 54.

- [ ] **Step 3: Configurar deployment target iOS via plugin**

Em `mobile/app.json`, dentro do array `"plugins"`, adicionar como **primeiro** item:
```json
[
  "expo-build-properties",
  {
    "ios": { "deploymentTarget": "15.1" }
  }
],
```
(Mantém os plugins `expo-camera` e `expo-image-picker` existentes logo abaixo.)

- [ ] **Step 4: Confirmar permissão de câmera (ARKit usa a câmera)**

Verificar que `mobile/app.json` → `expo.ios.infoPlist.NSCameraUsageDescription` já existe (existe: "A câmera é usada para escanear o animal..."). Nenhuma chave extra é necessária para ARKit além da câmera. Nada a alterar.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/app.json mobile/package.json mobile/package-lock.json
git commit -m "build(mobile): add dev client and build-properties for native LiDAR module"
```

---

### Task 2: Scaffold do módulo local `lidar-scanner`

**Files:**
- Create: `mobile/modules/lidar-scanner/**` (gerado)

- [ ] **Step 1: Gerar o módulo local**

Run (dentro de `mobile/`):
```bash
cd mobile
npx create-expo-module@latest --local lidar-scanner
```
Quando perguntar, responder:
- Native module name: `LidarScanner`
- JS/TS name: `LidarScanner`
- description / author: livres (autor: Talys Cordeiro)

Expected: cria `mobile/modules/lidar-scanner/` com `index.ts`, `expo-module.config.json`, `src/`, `ios/`, `android/`.

- [ ] **Step 2: Confirmar autolink do módulo**

Run:
```bash
cat modules/lidar-scanner/expo-module.config.json
```
Expected: contém `"name": "LidarScanner"` e plataformas `ios`/`android`. (Módulos em `modules/` são autolinkados pelo Expo.)

- [ ] **Step 3: Commit do scaffold**

```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/modules/lidar-scanner
git commit -m "feat(mobile): scaffold local lidar-scanner expo module"
```

---

### Task 3: Módulo iOS — ARView + checagem LiDAR (Swift)

**Files:**
- Modify: `mobile/modules/lidar-scanner/ios/LidarScannerModule.swift`
- Modify: `mobile/modules/lidar-scanner/ios/LidarScannerView.swift`

- [ ] **Step 1: Implementar o módulo (Module DSL)**

Substituir o conteúdo de `mobile/modules/lidar-scanner/ios/LidarScannerModule.swift` por:
```swift
import ExpoModulesCore
import ARKit

public class LidarScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LidarScanner")

    // Checagem de suporte com fallback — chamável de JS sem montar a view.
    Function("isLidarSupported") { () -> Bool in
      return ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
    }

    View(LidarScannerView.self) {
      Events("onScanComplete")

      AsyncFunction("startScan") { (view: LidarScannerView) in
        view.startScan()
      }

      AsyncFunction("stopScan") { (view: LidarScannerView) in
        view.stopScan()
      }
    }
  }
}
```

- [ ] **Step 2: Implementar a ARView nativa**

Substituir o conteúdo de `mobile/modules/lidar-scanner/ios/LidarScannerView.swift` por:
```swift
import ExpoModulesCore
import ARKit
import RealityKit

class LidarScannerView: ExpoView {
  private let arView = ARView(frame: .zero)
  private let onScanComplete = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    addSubview(arView)
    startSession()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    arView.frame = bounds
  }

  private func startSession() {
    let config = ARWorldTrackingConfiguration()
    if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
      config.sceneReconstruction = .mesh
      // Mostra a malha do LiDAR — confirmação visual da Fase 1.
      arView.debugOptions.insert(.showSceneUnderstanding)
    }
    config.environmentTexturing = .none
    arView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
  }

  // Stubs — preenchidos na Fase 2 (EURODEV-75).
  func startScan() { /* EURODEV-75 */ }
  func stopScan() { /* EURODEV-75 */ }
}
```

- [ ] **Step 3: (Sem build ainda) — só salvar.** O build acontece na Task 6 (precisa do device).

- [ ] **Step 4: Commit**

```bash
git add mobile/modules/lidar-scanner/ios
git commit -m "feat(mobile): native ARKit ARView + LiDAR support check in lidar-scanner"
```

---

### Task 4: Superfície TS do módulo

**Files:**
- Modify: `mobile/modules/lidar-scanner/index.ts`
- Create: `mobile/modules/lidar-scanner/src/LidarScannerView.tsx`

- [ ] **Step 1: Definir tipos + API em `index.ts`**

Substituir o conteúdo de `mobile/modules/lidar-scanner/index.ts` por:
```ts
import { requireNativeModule } from 'expo-modules-core';

import LidarScannerView from './src/LidarScannerView';

export type Measurements = {
  body_length_cm: number;
  withers_height_cm: number;
  thoracic_depth_cm: number;
  rump_width_cm: number;
  chest_girth_cm: number;
};

export type ScanCompleteEvent = {
  measurements: Measurements;
  meshUri: string;
  thumbUri?: string;
};

const LidarScannerModule = requireNativeModule('LidarScanner');

/** True só em iPhones com LiDAR (12 Pro+). False em simulador/devices sem LiDAR. */
export function isLidarSupported(): boolean {
  return LidarScannerModule.isLidarSupported();
}

export { LidarScannerView };
```

- [ ] **Step 2: Definir a view RN em `src/LidarScannerView.tsx`**

Substituir o conteúdo de `mobile/modules/lidar-scanner/src/LidarScannerView.tsx` por:
```tsx
import { requireNativeView } from 'expo';
import * as React from 'react';
import type { ViewProps } from 'react-native';

import type { ScanCompleteEvent } from '../index';

export type LidarScannerViewProps = ViewProps & {
  onScanComplete?: (event: { nativeEvent: ScanCompleteEvent }) => void;
};

const NativeView: React.ComponentType<LidarScannerViewProps> =
  requireNativeView('LidarScanner');

export default function LidarScannerView(props: LidarScannerViewProps) {
  return <NativeView {...props} />;
}
```

- [ ] **Step 3: Typecheck**

Run (dentro de `mobile/`):
```bash
cd mobile
npx tsc --noEmit
```
Expected: PASS (sem erros). Se acusar tipo do módulo nativo, garantir que os imports acima batem com os arquivos gerados.

- [ ] **Step 4: Commit**

```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/modules/lidar-scanner/index.ts mobile/modules/lidar-scanner/src/LidarScannerView.tsx
git commit -m "feat(mobile): typescript surface for lidar-scanner (isLidarSupported, view)"
```

---

### Task 5: Tela de teste temporária + rota

**Files:**
- Create: `mobile/src/screens/LidarTestScreen.tsx`
- Modify: `mobile/src/navigation/types.ts`
- Modify: `mobile/src/navigation/AppNavigator.tsx`
- Modify: `mobile/src/screens/HomeScreen.tsx` (botão dev temporário)

> Toda esta task é marcada com `// TEMP EURODEV-74` e será removida na Fase 4 (EURODEV-77), quando o scanner entra no fluxo real do ScanScreen.

- [ ] **Step 1: Criar a tela de teste**

Create `mobile/src/screens/LidarTestScreen.tsx`:
```tsx
// TEMP EURODEV-74 — tela de verificação do módulo nativo. Remover na Fase 4.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LidarScannerView, isLidarSupported } from '../../modules/lidar-scanner';
import { ios } from '../lib/theme';

export default function LidarTestScreen() {
  const insets = useSafeAreaInsets();
  const supported = isLidarSupported();

  return (
    <View style={styles.container}>
      <LidarScannerView style={StyleSheet.absoluteFill} />
      <View style={[styles.badge, { top: insets.top + 12 }]}>
        <Text style={styles.badgeText}>
          LiDAR suportado: {supported ? '✅ sim' : '❌ não'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  badge: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 14 },
});
```

- [ ] **Step 2: Registrar a rota nos tipos**

Abrir `mobile/src/navigation/types.ts` e adicionar a entrada `LidarTest: undefined;` ao type `RootStackParamList` (seguir o formato das rotas existentes, ex. `Result: { record: ScanRecord };`).

- [ ] **Step 3: Registrar a tela no navigator**

Abrir `mobile/src/navigation/AppNavigator.tsx`, importar `LidarTestScreen` e adicionar `<Stack.Screen name="LidarTest" component={LidarTestScreen} />` junto às outras `Stack.Screen` (mesmo padrão das existentes).

- [ ] **Step 4: Botão dev temporário na Home**

Em `mobile/src/screens/HomeScreen.tsx`, adicionar um botão temporário que navega para a tela (usar o hook de navegação já presente no arquivo):
```tsx
{/* TEMP EURODEV-74 — remover na Fase 4 */}
{__DEV__ && (
  <TouchableOpacity onPress={() => nav.navigate('LidarTest')} style={{ padding: 16 }}>
    <Text style={{ color: ios.accent }}>▶ Testar scanner LiDAR (dev)</Text>
  </TouchableOpacity>
)}
```
(Ajustar o nome da variável de navegação ao que já existe no HomeScreen; importar `ios` de `../lib/theme` se ainda não importado.)

- [ ] **Step 5: Typecheck**

Run:
```bash
cd mobile && npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/src
git commit -m "feat(mobile): temp LiDAR test screen and route for EURODEV-74 verification"
```

---

### Task 6: Dev build no device + verificação (acceptance)

**Files:** nenhum (build + verificação manual).

- [ ] **Step 1: Gerar e instalar o dev build no iPhone LiDAR**

Conectar o iPhone por cabo. Run (dentro de `mobile/`):
```bash
cd mobile
npx expo run:ios --device
```
- Selecionar o iPhone físico quando perguntado.
- Na primeira vez, abrir `ios/PondiFarm.xcworkspace` no Xcode, em **Signing & Capabilities** escolher o Team (`tcord`) para assinar, e rodar de novo se necessário.

Expected: app dev client instala e abre no device. (Alternativa EAS: `eas build --profile development --platform ios` e instalar o build.)

- [ ] **Step 2: Verificação on-device (critérios da EURODEV-74)**

Abrir o app → tocar no botão dev "▶ Testar scanner LiDAR (dev)" na Home. Confirmar:
- [ ] A **câmera AR aparece** preenchendo a tela (a `ARView` está embutida no RN). ✅ "ARView visível numa tela RN"
- [ ] O badge mostra **"LiDAR suportado: ✅ sim"** no iPhone Pro. ✅ "supportsSceneReconstruction checado"
- [ ] Movendo o aparelho, aparece a **malha do LiDAR sobreposta** (debug `showSceneUnderstanding`), confirmando que a reconstrução de cena está ativa.
- [ ] O build compilou sem erro. ✅ "build prebuild verde"

- [ ] **Step 3: Verificar o fallback (sem LiDAR)**

Rodar no **simulador** (`npx expo run:ios`) e confirmar que o badge mostra **"LiDAR suportado: ❌ não"** e o app **não crasha** (a sessão simplesmente não ativa a malha).

- [ ] **Step 4: Push e atualizar o PR/Jira**

```bash
git push -u origin EURODEV-74/lidar-native-module-scaffold
```
Abrir PR contra `main` com título `EURODEV-74 feat(mobile): native LiDAR module scaffold + ARView bridge` (o prefixo `EURODEV-74` liga ao Jira). Mover a subtask EURODEV-74 para "Em curso/Done" conforme o estado.

---

## Self-Review

**Spec coverage (vs EURODEV-74):**
- "Módulo nativo + ponte ARView no RN" → Tasks 2–5. ✅
- "expo prebuild (CNG) + create-expo-module --local" → Task 1 (dev-client) + Task 2. ✅
- "supportsSceneReconstruction(.mesh) checado com fallback" → Task 3 Step 1 (`isLidarSupported`) + Task 6 Step 3. ✅
- "ARView nativo visível numa tela RN" → Task 5 + Task 6 Step 2. ✅
- "build prebuild verde" → Task 6 Step 1–2. ✅

**Type consistency:** `LidarScanner` (Name nativo) == `requireNativeModule('LidarScanner')` == `requireNativeView('LidarScanner')`. `Measurements`/`ScanCompleteEvent` definidos em `index.ts` e reusados em `LidarScannerView.tsx`. `isLidarSupported`/`startScan`/`stopScan` consistentes entre Swift e TS. ✅

**Placeholders:** `startScan`/`stopScan` são stubs intencionais e rotulados (Fase 2), não placeholders de plano. Os passos que tocam `types.ts`/`AppNavigator.tsx`/`HomeScreen.tsx` nomeiam o símbolo exato a adicionar e mandam seguir o padrão existente do arquivo (conteúdo não reproduzido porque varia; é leitura de 1 arquivo no momento). ✅

**Honestidade de teste:** a Fase 1 não tem lógica pura para TDD; o gate automatizado é `tsc --noEmit` e a aceitação é a verificação on-device. TDD com testes-primeiro entra na Fase 3 (EURODEV-76, medições).
