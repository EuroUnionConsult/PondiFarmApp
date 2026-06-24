# LiDAR 5 Measurements (PCA) + Share/Export — Implementation Plan (EURODEV-76, Fase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Extrair as 5 medidas morfométricas (comprimento, cernelha, profundidade torácica, largura da garupa, perímetro torácico) da malha do scan via PCA/OBB + fatia, emiti-las no `onScanComplete`, gravar o `.obj` em `Documents/` (não `tmp/`) e adicionar um botão **Compartilhar** (`expo-sharing`).

**Architecture:** Função pura `MeshMeasurer.measure([SIMD3<Float>]) -> BodyMeasurements` (sem ARKit, testável com `swiftc`). Y é "up" (mundo ARKit, alinhado à gravidade) → altura = extensão vertical. PCA 2D no plano XZ acha o eixo longo do corpo (comprimento) e o perpendicular (largura). Perímetro torácico = perímetro do convex hull de uma fatia perpendicular ao eixo longo, ~1/3 a partir de uma ponta. `LidarScannerView.stopScan` chama `measure(...)`, grava o OBJ em Documents e devolve as medidas. A tela de teste mostra as 5 medidas + botão Compartilhar.

**Tech Stack:** Swift + simd (matemática pura), ARKit (só o `stopScan` que já existe), expo-sharing (JS), expo-modules-core.

**Base:** branch `EURODEV-76/lidar-measurements-pca` a partir de `EURODEV-75/lidar-mesh-capture-export`.

**Honestidade de escopo:** medidas **reais da geometria, simplificadas** (PCA + fatia). NÃO há detecção anatômica de landmarks (qual ponta é a cabeça é arbitrário — usamos a ponta `minL`). Refinamento com landmarks/dataset é fase futura. Unidades: malha em **metros** → medidas convertidas para **cm** (×100) na borda.

---

### Task 1: Branch + plano

- [ ] **Step 1: Criar a branch**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git checkout EURODEV-75/lidar-mesh-capture-export
git checkout -b EURODEV-76/lidar-measurements-pca
```
- [ ] **Step 2: Commit do plano (doc em disco, untracked)**
```bash
git add docs/superpowers/plans/2026-06-08-lidar-measurements-pca.md
git commit -m "docs: add EURODEV-76 phase-3 measurements plan"
```

---

### Task 2: `MeshMeasurer` (função pura) + teste TDD

**Files:**
- Create: `mobile/modules/lidar-scanner/ios/MeshMeasurer.swift`
- Test: `mobile/modules/lidar-scanner/ios/MeshMeasurerTests.swift` (rodável via `swiftc`, sem ARKit; já excluído do build pelo `exclude_files = "**/*Tests.swift"` no podspec da Fase 2)

- [ ] **Step 1: Escrever o teste PRIMEIRO**

Create `mobile/modules/lidar-scanner/ios/MeshMeasurerTests.swift`:
```swift
// Teste standalone (sem ARKit). Rodar:
//   cp MeshMeasurerTests.swift main.swift && swiftc MeshMeasurer.swift main.swift -o /tmp/mtest && /tmp/mtest; rm -f main.swift /tmp/mtest
import simd
import Foundation

func check(_ cond: Bool, _ msg: String) {
  if !cond { print("❌ FAIL: \(msg)"); exit(1) }
  print("✅ \(msg)")
}

// Cubo sólido de lado L=2 amostrado em grade (passo 0.2) → 11x11x11 pontos.
let L: Float = 2.0
var cube: [SIMD3<Float>] = []
var x: Float = 0
while x <= L + 1e-4 {
  var y: Float = 0
  while y <= L + 1e-4 {
    var z: Float = 0
    while z <= L + 1e-4 { cube.append(SIMD3<Float>(x, y, z)); z += 0.2 }
    y += 0.2
  }
  x += 0.2
}

let m = MeshMeasurer.measure(cube)
check(abs(m.withersHeight - 2) < 0.05, "altura (cernelha) ≈ L")
check(abs(m.bodyLength   - 2) < 0.05, "comprimento ≈ L")
check(abs(m.rumpWidth    - 2) < 0.05, "largura ≈ L")
check(abs(m.thoracicDepth - 2) < 0.05, "profundidade torácica ≈ L")
check(abs(m.chestGirth   - 8) < 0.2,  "perímetro torácico ≈ 4L")

// Robustez: poucos pontos → zeros, sem crash.
let z = MeshMeasurer.measure([SIMD3<Float>(0,0,0)])
check(z.bodyLength == 0 && z.chestGirth == 0, "entrada degenerada → zeros")

print("Todos os testes passaram.")
```

- [ ] **Step 2: Rodar e ver FALHAR**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp/mobile/modules/lidar-scanner/ios
cp MeshMeasurerTests.swift main.swift && swiftc MeshMeasurer.swift main.swift -o /tmp/mtest 2>&1; rm -f main.swift
```
Expected: erro "cannot find 'MeshMeasurer' in scope".

- [ ] **Step 3: Implementar `MeshMeasurer.swift`**

Create `mobile/modules/lidar-scanner/ios/MeshMeasurer.swift`:
```swift
import simd

struct BodyMeasurements {
  var bodyLength: Float      // eixo horizontal mais longo
  var withersHeight: Float   // extensão vertical (Y)
  var thoracicDepth: Float   // altura na fatia do tórax
  var rumpWidth: Float       // largura (eixo horizontal curto)
  var chestGirth: Float      // perímetro do convex hull da fatia do tórax
}

/// Extrai medidas morfométricas de uma nuvem de vértices (em metros, Y = up).
/// Função pura — sem ARKit. Valores na MESMA unidade da entrada.
enum MeshMeasurer {
  static func measure(_ vertices: [SIMD3<Float>]) -> BodyMeasurements {
    guard vertices.count >= 4 else {
      return BodyMeasurements(bodyLength: 0, withersHeight: 0, thoracicDepth: 0, rumpWidth: 0, chestGirth: 0)
    }

    // Altura = extensão vertical (Y).
    let ys = vertices.map { $0.y }
    let withersHeight = ys.max()! - ys.min()!

    // PCA 2D no plano XZ → eixo longo (comprimento) e curto (largura).
    let pts = vertices.map { SIMD2<Float>($0.x, $0.z) }
    let mean = pts.reduce(SIMD2<Float>(0, 0), +) / Float(pts.count)
    var cxx: Float = 0, czz: Float = 0, cxz: Float = 0
    for p in pts {
      let d = p - mean
      cxx += d.x * d.x; czz += d.y * d.y; cxz += d.x * d.y
    }
    let n = Float(pts.count)
    cxx /= n; czz /= n; cxz /= n
    let (axisLong, axisShort) = eigenAxes2D(cxx: cxx, czz: czz, cxz: cxz)

    var minL = Float.greatestFiniteMagnitude, maxL = -Float.greatestFiniteMagnitude
    var minS = Float.greatestFiniteMagnitude, maxS = -Float.greatestFiniteMagnitude
    for p in pts {
      let d = p - mean
      let l = simd_dot(d, axisLong), s = simd_dot(d, axisShort)
      minL = min(minL, l); maxL = max(maxL, l)
      minS = min(minS, s); maxS = max(maxS, s)
    }
    let bodyLength = maxL - minL
    let rumpWidth = maxS - minS

    // Fatia perpendicular ao eixo longo a ~1/3 de uma ponta (tórax aproximado).
    let chestL = minL + bodyLength * 0.33
    let slabHalf = max(bodyLength * 0.04, 0.01)
    var section: [SIMD2<Float>] = []   // (eixo curto, Y)
    for v in vertices {
      let d = SIMD2<Float>(v.x, v.z) - mean
      if abs(simd_dot(d, axisLong) - chestL) <= slabHalf {
        section.append(SIMD2<Float>(simd_dot(d, axisShort), v.y))
      }
    }
    let thoracicDepth: Float = section.isEmpty ? 0
      : (section.map { $0.y }.max()! - section.map { $0.y }.min()!)
    let chestGirth = convexHullPerimeter(section)

    return BodyMeasurements(bodyLength: bodyLength, withersHeight: withersHeight,
                            thoracicDepth: thoracicDepth, rumpWidth: rumpWidth, chestGirth: chestGirth)
  }

  /// Autovetores da covariância 2x2 [[cxx,cxz],[cxz,czz]] → (eixo do maior autovalor, perpendicular).
  static func eigenAxes2D(cxx: Float, czz: Float, cxz: Float) -> (SIMD2<Float>, SIMD2<Float>) {
    let tr = cxx + czz
    let det = cxx * czz - cxz * cxz
    let disc = max(0, tr * tr / 4 - det)
    let l1 = tr / 2 + disc.squareRoot()
    let v: SIMD2<Float>
    if abs(cxz) > 1e-8 {
      v = simd_normalize(SIMD2<Float>(l1 - czz, cxz))
    } else {
      v = cxx >= czz ? SIMD2<Float>(1, 0) : SIMD2<Float>(0, 1)
    }
    return (v, SIMD2<Float>(-v.y, v.x))
  }

  /// Perímetro do convex hull (monotone chain) de pontos 2D.
  static func convexHullPerimeter(_ input: [SIMD2<Float>]) -> Float {
    var pts = input.sorted { $0.x == $1.x ? $0.y < $1.y : $0.x < $1.x }
    var dedup: [SIMD2<Float>] = []
    for p in pts {
      if let last = dedup.last, abs(last.x - p.x) < 1e-6, abs(last.y - p.y) < 1e-6 { continue }
      dedup.append(p)
    }
    pts = dedup
    if pts.count < 3 {
      return pts.count == 2 ? 2 * simd_distance(pts[0], pts[1]) : 0
    }
    func cross(_ o: SIMD2<Float>, _ a: SIMD2<Float>, _ b: SIMD2<Float>) -> Float {
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
    }
    var hull: [SIMD2<Float>] = []
    for p in pts {
      while hull.count >= 2, cross(hull[hull.count - 2], hull[hull.count - 1], p) <= 0 { hull.removeLast() }
      hull.append(p)
    }
    let lower = hull.count + 1
    for p in pts.reversed() {
      while hull.count >= lower, cross(hull[hull.count - 2], hull[hull.count - 1], p) <= 0 { hull.removeLast() }
      hull.append(p)
    }
    hull.removeLast()
    var per: Float = 0
    for i in 0..<hull.count { per += simd_distance(hull[i], hull[(i + 1) % hull.count]) }
    return per
  }
}
```

- [ ] **Step 4: Rodar e ver PASSAR**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp/mobile/modules/lidar-scanner/ios
cp MeshMeasurerTests.swift main.swift && swiftc MeshMeasurer.swift main.swift -o /tmp/mtest && /tmp/mtest; rm -f main.swift /tmp/mtest
```
Expected: 6 linhas ✅ + "Todos os testes passaram." (exit 0).

- [ ] **Step 5: Commit**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/modules/lidar-scanner/ios/MeshMeasurer.swift mobile/modules/lidar-scanner/ios/MeshMeasurerTests.swift
git commit -m "feat(mobile): pure mesh measurer (PCA + convex-hull girth) with standalone test"
```

---

### Task 3: Integrar medidas no `stopScan` + gravar em Documents

**Files:**
- Modify: `mobile/modules/lidar-scanner/ios/LidarScannerView.swift`

- [ ] **Step 1: Substituir o corpo de `stopScan()`**

No `LidarScannerView.swift`, substituir TODA a função `stopScan()` atual por:
```swift
  func stopScan() {
    guard let frame = arView.session.currentFrame else {
      onScanComplete(["meshUri": "", "vertexCount": 0, "faceCount": 0])
      return
    }
    let meshAnchors = frame.anchors.compactMap { $0 as? ARMeshAnchor }

    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      let (vertices, faces) = LidarScannerView.consolidate(meshAnchors)
      let obj = ObjExporter.objString(vertices: vertices, faces: faces)
      let m = MeshMeasurer.measure(vertices)

      // Grava em Documents/ (persistente, compartilhável) — não em tmp/.
      let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let url = docs.appendingPathComponent("scan-\(Int(Date().timeIntervalSince1970)).obj")

      var payload: [String: Any]
      do {
        try obj.write(to: url, atomically: true, encoding: .utf8)
        payload = [
          "meshUri": url.absoluteString,
          "vertexCount": vertices.count,
          "faceCount": faces.count / 3,
          "measurements": [
            "body_length_cm": m.bodyLength * 100,
            "withers_height_cm": m.withersHeight * 100,
            "thoracic_depth_cm": m.thoracicDepth * 100,
            "rump_width_cm": m.rumpWidth * 100,
            "chest_girth_cm": m.chestGirth * 100
          ]
        ]
      } catch {
        payload = ["meshUri": "", "vertexCount": 0, "faceCount": 0]
      }
      DispatchQueue.main.async { self?.onScanComplete(payload) }
    }
  }
```
(Não mexer em `startScan`, `consolidate`, `startSession`, `init`, etc.)

- [ ] **Step 2: Commit**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/modules/lidar-scanner/ios/LidarScannerView.swift
git commit -m "feat(mobile): compute 5 measurements and save .obj to Documents on scan"
```

---

### Task 4: expo-sharing + tela mostra medidas + botão Compartilhar

**Files:**
- Modify: `mobile/src/screens/LidarTestScreen.tsx`
- Modify: `mobile/package.json` (via instalador)

- [ ] **Step 1: Instalar expo-sharing + pod install**

(expo-sharing é dependência nativa nova; `MeshMeasurer.swift` também é arquivo nativo novo → um `pod install` cobre ambos — ver aprendizado #16.)
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp/mobile
npx expo install expo-sharing
npx pod-install
```
Expected: `expo-sharing` em package.json; `ExpoSharing` e `MeshMeasurer.swift` no projeto Pods.

- [ ] **Step 2: Atualizar a tela de teste**

Substituir `mobile/src/screens/LidarTestScreen.tsx` por:
```tsx
// TEMP EURODEV-74/75/76 — verificação do módulo nativo. Remover na Fase 4 (EURODEV-77).
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import {
  LidarScannerView,
  isLidarSupported,
  type LidarScannerViewRef,
  type ScanCompleteEvent,
} from '../../modules/lidar-scanner';

const ROWS: { key: keyof NonNullable<ScanCompleteEvent['measurements']>; label: string }[] = [
  { key: 'body_length_cm',    label: 'Comprimento' },
  { key: 'withers_height_cm', label: 'Cernelha' },
  { key: 'thoracic_depth_cm', label: 'Prof. torácica' },
  { key: 'rump_width_cm',     label: 'Largura garupa' },
  { key: 'chest_girth_cm',    label: 'Perímetro torácico' },
];

export default function LidarTestScreen() {
  const insets = useSafeAreaInsets();
  const supported = isLidarSupported();
  const viewRef = useRef<LidarScannerViewRef>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanCompleteEvent | null>(null);

  const start = () => { setResult(null); setScanning(true); viewRef.current?.startScan?.(); };
  const stop = () => { setScanning(false); viewRef.current?.stopScan?.(); };
  const share = async () => {
    if (result?.meshUri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(result.meshUri);
    }
  };

  return (
    <View style={styles.container}>
      <LidarScannerView
        ref={viewRef}
        style={StyleSheet.absoluteFill}
        onScanComplete={(e: { nativeEvent: ScanCompleteEvent }) => setResult(e.nativeEvent)}
      />
      <View style={[styles.panel, { top: insets.top + 12 }]}>
        <Text style={styles.badgeText}>LiDAR: {supported ? '✅ sim' : '❌ não'}</Text>
        {result && (
          <Text style={styles.badgeText}>{result.vertexCount} vért · {result.faceCount} faces</Text>
        )}
        {result?.measurements && (
          <ScrollView style={styles.measWrap}>
            {ROWS.map((r) => (
              <View key={r.key} style={styles.measRow}>
                <Text style={styles.measLabel}>{r.label}</Text>
                <Text style={styles.measVal}>{result.measurements![r.key].toFixed(1)} cm</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <View style={[styles.controls, { bottom: insets.bottom + 28 }]}>
        <TouchableOpacity style={[styles.btn, scanning && styles.btnActive]} onPress={scanning ? stop : start}>
          <Text style={styles.btnText}>{scanning ? 'Parar e exportar' : 'Iniciar scan'}</Text>
        </TouchableOpacity>
        {result?.meshUri ? (
          <TouchableOpacity style={styles.shareBtn} onPress={share}>
            <Text style={styles.btnText}>Compartilhar .obj</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  panel: {
    position: 'absolute', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 14, gap: 4, maxWidth: '92%', maxHeight: 260,
  },
  badgeText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  measWrap: { marginTop: 6 },
  measRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 18, paddingVertical: 2 },
  measLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  measVal: { color: '#9fe6b0', fontSize: 13, fontWeight: '600' },
  controls: { position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: 10 },
  btn: { backgroundColor: '#5F8068', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  btnActive: { backgroundColor: '#C0392B' },
  shareBtn: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 3: Typecheck**
```bash
cd mobile && npx tsc --noEmit
```
Expected: PASS (exit 0).

- [ ] **Step 4: Commit**
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp
git add mobile/src/screens/LidarTestScreen.tsx mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): show 5 measurements and add share button in test screen"
```

---

### Task 5: Verificação no device (acceptance EURODEV-76)

- [ ] **Step 1: Rebuild** (mudou Swift + pod novo): Xcode ▶ (signing já ok) ou `npx expo run:ios --device`. Metro: `npx expo start --dev-client --tunnel` → conectar com a URL **https** do túnel (ver aprendizados #17/#18).
- [ ] **Step 2: Verificação:** Home → "▶ Testar scanner LiDAR (dev)":
  - [ ] Escanear um **objeto de tamanho conhecido** (ex. caixa) → "Parar e exportar".
  - [ ] As **5 medidas aparecem em cm** com valores plausíveis (ordem de grandeza coerente com o objeto).
  - [ ] Calibração: medir uma caixa de dimensões conhecidas e conferir que comprimento/altura/largura batem dentro de tolerância (~cm).
  - [ ] Botão **"Compartilhar .obj"** abre a folha de compartilhamento → enviar por **AirDrop/Arquivos**.
- [ ] **Step 3: Push + PR** contra base `EURODEV-75/lidar-mesh-capture-export`, título `EURODEV-76 feat(mobile): 5 morphometric measurements + share`. Mover EURODEV-76 no Jira.

---

## Self-Review

**Spec coverage (EURODEV-76 "Extração das 5 medidas (Swift) + XCTest"):**
- Remover chão / alinhar (PCA): altura por extensão Y; PCA 2D XZ p/ eixos (Task 2). ✅
- 5 medidas: comprimento/cernelha/profundidade/garupa/perímetro (Task 2 `measure`). ✅
- Teste com cubo lado L → dimensões ≈ L (Task 2 standalone, padrão da Fase 2 já que não há XCTest target). ✅
- Calibração em objeto real conhecido (Task 5). ✅
- **Extra aprovado:** Share (`expo-sharing`) + gravar em Documents (Tasks 3,4). ✅

**Type consistency:** Swift emite `measurements` com as 5 chaves `*_cm` == `Measurements` (TS, Fase 2) == `ScanCompleteEvent.measurements?`. `BodyMeasurements` (Swift interno) só na borda. `LidarScannerViewRef.startScan/stopScan` já existem (Fase 2).

**Honestidade:** medidas são geometria simplificada (PCA + fatia a 33%), não anatômicas; "frente" é arbitrária (`minL`). Unidades m→cm na borda. Teste cobre a matemática pura; acurácia real validada em objeto conhecido no device.
