# LiDAR Mesh Capture + OBJ Export — Implementation Plan (EURODEV-75, Fase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Capturar a malha 3D do LiDAR durante um scan e exportá-la para um arquivo `.obj` on-device, preenchendo os stubs `startScan`/`stopScan` e emitindo `onScanComplete({ meshUri, vertexCount, faceCount })`.

**Architecture:** A `ARView` já roda `sceneReconstruction = .mesh` (Fase 1). `startScan()` reinicia a sessão com `.resetSceneReconstruction` (limpa malha anterior). Enquanto o usuário move o aparelho, o ARKit acumula `ARMeshAnchor`s na sessão. `stopScan()` lê `arView.session.currentFrame.anchors`, consolida todos os `ARMeshAnchor` (vértices→mundo + faces) numa lista única, serializa para OBJ (função pura `ObjExporter`) e grava no `temporaryDirectory`, emitindo o evento com o caminho e contagens.

**Tech Stack:** Swift, ARKit (`ARMeshGeometry`, `ARGeometrySource`/`ARGeometryElement`), RealityKit `ARView`, simd, expo-modules-core EventDispatcher.

**Base:** branch `EURODEV-75/lidar-mesh-capture-export` a partir de `EURODEV-74/lidar-native-module-scaffold` (Fase 1 ainda não mergeada no épico; PR da 75 terá base = EURODEV-74).

**Não-objetivo:** extrair as 5 medidas (Fase 3, EURODEV-76). Aqui só capturamos+exportamos a geometria.

---

### Task 1: Branch

- [ ] **Step 1: Criar a branch a partir da Fase 1**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git checkout EURODEV-74/lidar-native-module-scaffold
git checkout -b EURODEV-75/lidar-mesh-capture-export
```

- [ ] **Step 2: Commit do plano (doc já em disco, untracked)**
```bash
git add docs/superpowers/plans/2026-06-04-lidar-mesh-capture-export.md
git commit -m "docs: add EURODEV-75 phase-2 mesh capture plan"
```

---

### Task 2: `ObjExporter` (função pura) + teste standalone

**Files:**
- Create: `mobile/modules/lidar-scanner/ios/ObjExporter.swift`
- Test: `mobile/modules/lidar-scanner/ios/ObjExporterTests.swift` (rodável via `swift`, sem ARKit)

- [ ] **Step 1: Escrever o teste primeiro (TDD)**

Create `mobile/modules/lidar-scanner/ios/ObjExporterTests.swift`:
```swift
// Teste standalone (sem ARKit) — rodar com: swift ObjExporter.swift ObjExporterTests.swift
import simd

func assert(_ cond: Bool, _ msg: String) {
  if !cond { print("❌ FAIL: \(msg)"); exit(1) }
  print("✅ \(msg)")
}

let verts: [SIMD3<Float>] = [SIMD3(0,0,0), SIMD3(1,0,0), SIMD3(0,1,0)]
let faces: [UInt32] = [0, 1, 2]
let obj = ObjExporter.objString(vertices: verts, faces: faces)

assert(obj.contains("v 0.0 0.0 0.0"), "primeiro vértice")
assert(obj.contains("v 1.0 0.0 0.0"), "segundo vértice")
assert(obj.contains("f 1 2 3"), "face 1-indexada")
assert(!obj.contains("f 0"), "índices nunca começam em 0 (OBJ é 1-based)")
print("Todos os testes passaram.")
```

- [ ] **Step 2: Rodar o teste e ver FALHAR** (ObjExporter ainda não existe)
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp/mobile/modules/lidar-scanner/ios
swift ObjExporter.swift ObjExporterTests.swift
```
Expected: erro de compilação "cannot find 'ObjExporter'".

- [ ] **Step 3: Implementar `ObjExporter.swift`**

Create `mobile/modules/lidar-scanner/ios/ObjExporter.swift`:
```swift
import simd

/// Serializa uma malha (vértices em coordenadas de mundo + faces como triplas de índices 0-based)
/// para o formato Wavefront OBJ. Função pura — sem dependência de ARKit.
enum ObjExporter {
  static func objString(vertices: [SIMD3<Float>], faces: [UInt32]) -> String {
    var lines: [String] = ["# PondiFarm LiDAR scan"]
    lines.reserveCapacity(vertices.count + faces.count / 3 + 1)
    for v in vertices {
      lines.append("v \(v.x) \(v.y) \(v.z)")
    }
    var i = 0
    while i + 2 < faces.count {
      // OBJ é 1-indexado
      lines.append("f \(faces[i] + 1) \(faces[i + 1] + 1) \(faces[i + 2] + 1)")
      i += 3
    }
    return lines.joined(separator: "\n")
  }
}
```

- [ ] **Step 4: Rodar o teste e ver PASSAR**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp/mobile/modules/lidar-scanner/ios
swift ObjExporter.swift ObjExporterTests.swift
```
Expected: "Todos os testes passaram."

- [ ] **Step 5: Commit**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/modules/lidar-scanner/ios/ObjExporter.swift mobile/modules/lidar-scanner/ios/ObjExporterTests.swift
git commit -m "feat(mobile): pure OBJ serializer for lidar mesh export with standalone test"
```

---

### Task 3: Captura + consolidação da malha no `LidarScannerView`

**Files:**
- Modify: `mobile/modules/lidar-scanner/ios/LidarScannerView.swift`

- [ ] **Step 1: Implementar consolidação + startScan/stopScan**

Substituir os stubs `startScan()`/`stopScan()` em `LidarScannerView.swift` por:
```swift
  func startScan() {
    guard ARWorldTrackingConfiguration.isSupported else { return }
    let config = ARWorldTrackingConfiguration()
    if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
      config.sceneReconstruction = .mesh
      arView.debugOptions.insert(.showSceneUnderstanding)
    }
    config.environmentTexturing = .none
    // .resetSceneReconstruction limpa a malha de scans anteriores.
    arView.session.run(config, options: [.resetTracking, .removeExistingAnchors, .resetSceneReconstruction])
  }

  func stopScan() {
    let meshAnchors = (arView.session.currentFrame?.anchors ?? [])
      .compactMap { $0 as? ARMeshAnchor }
    let (vertices, faces) = Self.consolidate(meshAnchors)

    let obj = ObjExporter.objString(vertices: vertices, faces: faces)
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent("scan-\(Int(Date().timeIntervalSince1970)).obj")
    do {
      try obj.write(to: url, atomically: true, encoding: .utf8)
      onScanComplete([
        "meshUri": url.absoluteString,
        "vertexCount": vertices.count,
        "faceCount": faces.count / 3
      ])
    } catch {
      onScanComplete(["meshUri": "", "vertexCount": 0, "faceCount": 0])
    }
  }

  /// Consolida todos os ARMeshAnchor em uma lista de vértices (mundo) e faces (índices 0-based).
  private static func consolidate(_ anchors: [ARMeshAnchor]) -> (vertices: [SIMD3<Float>], faces: [UInt32]) {
    var vertices: [SIMD3<Float>] = []
    var faces: [UInt32] = []
    for anchor in anchors {
      let geom = anchor.geometry
      let baseIndex = UInt32(vertices.count)

      let vSrc = geom.vertices
      let vBuf = vSrc.buffer.contents()
      for i in 0..<vSrc.count {
        let ptr = vBuf.advanced(by: vSrc.offset + vSrc.stride * i)
          .assumingMemoryBound(to: Float.self)
        let local = SIMD4<Float>(ptr[0], ptr[1], ptr[2], 1)
        let world = anchor.transform * local
        vertices.append(SIMD3<Float>(world.x, world.y, world.z))
      }

      let fEl = geom.faces
      let fBuf = fEl.buffer.contents()
      let totalIndices = fEl.count * fEl.indexCountPerPrimitive
      for j in 0..<totalIndices {
        let idx: UInt32
        if fEl.bytesPerIndex == 4 {
          idx = fBuf.advanced(by: j * 4).assumingMemoryBound(to: UInt32.self).pointee
        } else {
          idx = UInt32(fBuf.advanced(by: j * 2).assumingMemoryBound(to: UInt16.self).pointee)
        }
        faces.append(baseIndex + idx)
      }
    }
    return (vertices, faces)
  }
```

> Nota: `import ARKit` já está no topo do arquivo (Fase 1). A `consolidate` é `static` para poder ser exercida sem instância. O delegate da sessão NÃO é tocado (RealityKit usa o dele) — lemos os anchors via `currentFrame`.

- [ ] **Step 2: Commit**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/modules/lidar-scanner/ios/LidarScannerView.swift
git commit -m "feat(mobile): capture and consolidate LiDAR mesh, export to .obj on stopScan"
```

---

### Task 4: TS — tipo do evento + controles na tela de teste

**Files:**
- Modify: `mobile/modules/lidar-scanner/src/LidarScanner.types.ts`
- Modify: `mobile/src/screens/LidarTestScreen.tsx`

- [ ] **Step 1: Atualizar o tipo do evento**

Substituir `ScanCompleteEvent` em `src/LidarScanner.types.ts` por:
```ts
export type Measurements = {
  body_length_cm: number;
  withers_height_cm: number;
  thoracic_depth_cm: number;
  rump_width_cm: number;
  chest_girth_cm: number;
};

export type ScanCompleteEvent = {
  meshUri: string;
  vertexCount: number;
  faceCount: number;
  measurements?: Measurements; // adicionado na Fase 3 (EURODEV-76)
  thumbUri?: string;
};
```

- [ ] **Step 2: Controles Start/Stop + resultado na tela de teste**

Substituir `mobile/src/screens/LidarTestScreen.tsx` por:
```tsx
// TEMP EURODEV-74/75 — verificação do módulo nativo. Remover na Fase 4 (EURODEV-77).
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LidarScannerView,
  isLidarSupported,
  type ScanCompleteEvent,
} from '../../modules/lidar-scanner';

export default function LidarTestScreen() {
  const insets = useSafeAreaInsets();
  const supported = isLidarSupported();
  const viewRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanCompleteEvent | null>(null);

  const start = () => {
    setResult(null);
    setScanning(true);
    viewRef.current?.startScan?.();
  };
  const stop = () => {
    setScanning(false);
    viewRef.current?.stopScan?.();
  };

  return (
    <View style={styles.container}>
      <LidarScannerView
        ref={viewRef}
        style={StyleSheet.absoluteFill}
        onScanComplete={(e: { nativeEvent: ScanCompleteEvent }) => setResult(e.nativeEvent)}
      />
      <View style={[styles.badge, { top: insets.top + 12 }]}>
        <Text style={styles.badgeText}>LiDAR: {supported ? '✅ sim' : '❌ não'}</Text>
        {result && (
          <Text style={styles.badgeText}>
            {result.vertexCount} vértices · {result.faceCount} faces
          </Text>
        )}
        {result?.meshUri ? (
          <Text style={styles.path} numberOfLines={1}>{result.meshUri}</Text>
        ) : null}
      </View>
      <View style={[styles.controls, { bottom: insets.bottom + 28 }]}>
        <TouchableOpacity
          style={[styles.btn, scanning && styles.btnActive]}
          onPress={scanning ? stop : start}
        >
          <Text style={styles.btnText}>{scanning ? 'Parar e exportar' : 'Iniciar scan'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  badge: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, gap: 2, maxWidth: '90%',
  },
  badgeText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  path: { color: '#9fe6b0', fontSize: 10 },
  controls: { position: 'absolute', alignSelf: 'center' },
  btn: {
    backgroundColor: '#5F8068', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
  },
  btnActive: { backgroundColor: '#C0392B' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

> A view nativa expõe `startScan`/`stopScan` como AsyncFunction (Fase 1). Via ref, `viewRef.current.startScan()` chama o método nativo (expo-modules-core mapeia AsyncFunctions de View para métodos no ref).

- [ ] **Step 3: Typecheck**
```bash
cd mobile && npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/modules/lidar-scanner/src/LidarScanner.types.ts mobile/src/screens/LidarTestScreen.tsx
git commit -m "feat(mobile): scan controls and mesh result display in test screen"
```

---

### Task 5: Verificação no device (acceptance EURODEV-75)

**Files:** nenhum (rebuild + verificação manual no iPhone).

- [ ] **Step 1: Rebuild (código nativo mudou)**
Como mudou Swift, precisa rebuildar: no Xcode aperta ▶ (signing já configurado), ou `cd mobile && npx expo run:ios --device`. Iniciar o Metro antes: `cd mobile && npx expo start --dev-client` e conectar o iPhone em `http://172.20.10.4:8081`.

- [ ] **Step 2: Verificação (critérios da EURODEV-75)**
Home → "▶ Testar scanner LiDAR (dev)":
- [ ] Tocar **"Iniciar scan"** → mover o iPhone ao redor de um objeto por alguns segundos (a malha do LiDAR cobre a superfície).
- [ ] Tocar **"Parar e exportar"** → o badge mostra **nº de vértices > 0 e nº de faces > 0** e um caminho `file://…/scan-….obj`. ✅ "scan gera .obj válido; vértices coerentes; evento devolve meshUri"
- [ ] Repetir um 2º scan → "Iniciar scan" limpa a malha anterior (graças a `.resetSceneReconstruction`) e gera contagens novas.

- [ ] **Step 3: (Opcional) Conferir o .obj**
Para inspecionar o arquivo, dá para compartilhá-lo do device ou, em dev, logar o conteúdo. Critério mínimo: vértices/faces > 0. Visualização rica fica para Fase 3/4.

- [ ] **Step 4: Push + PR**
```bash
git push -u origin EURODEV-75/lidar-mesh-capture-export
```
PR contra **`EURODEV-74/lidar-native-module-scaffold`** (base), título `EURODEV-75 feat(mobile): LiDAR mesh capture + OBJ export`. Mover EURODEV-75 no Jira.

---

## Self-Review

**Spec coverage (EURODEV-75 "Captura da malha LiDAR + export .obj"):**
- Reiniciar/limpar malha → `startScan` com `.resetSceneReconstruction` (Task 3). ✅
- Acumular ARMeshAnchors → ARKit acumula na sessão; lidos via `currentFrame.anchors` (Task 3). ✅
- Consolidar + exportar `.obj` local → `consolidate` + `ObjExporter` + write (Tasks 2,3). ✅
- Evento devolve `meshUri` + contagens → `onScanComplete` (Task 3) + tipo (Task 4). ✅
- Aceite "vértices coerentes" → verificação device (Task 5). ✅

**Type consistency:** `onScanComplete` emite `{meshUri, vertexCount, faceCount}` (Swift) == `ScanCompleteEvent` (TS, measurements opcional p/ Fase 3). `startScan`/`stopScan` já expostos como AsyncFunction no módulo (Fase 1) → chamados via ref na tela.

**Honestidade de teste:** `ObjExporter` (lógica pura) tem TDD real via `swift` CLI standalone (sem ARKit). A captura/consolidação depende de ARKit → verificada no device. Sem XCTest target no projeto (gerado pelo Expo, frágil a prebuild).
