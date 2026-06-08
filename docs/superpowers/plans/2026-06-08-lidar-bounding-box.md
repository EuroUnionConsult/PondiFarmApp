# Manual AR Bounding Box (subject isolation) — Implementation Plan (EURODEV-79)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Resolver o I5 — medir/exportar **só o sujeito**, não a cena. Uma **caixa AR fixa à frente da câmera** (world-anchored ao iniciar), com **controle de escala** + "Reposicionar". Ao parar, recortar a malha acumulada para dentro da caixa, e só então medir (`MeshMeasurer`) e exportar o `.obj`.

**Architecture:** No `startScan`, ancorar uma caixa (RealityKit) ~1.8 m à frente da câmera, tamanho padrão de bovino (L 2.6 × A 1.7 × La 1.1 m), nivelada (só yaw da câmera). Renderizar translúcida. Bridge: `setBoxScale(Double)` e `recenterBox()`. No `stopScan`: `MeshCropper.crop` filtra vértices/faces para dentro da caixa (world→box-local), depois `MeshMeasurer.measure(cropped)` e exporta o OBJ recortado.

**Tech Stack:** Swift + RealityKit + ARKit + simd; expo-modules-core (AsyncFunctions); RN/TS (controles). Native → exige rebuild (entra no rebuild único do teste consolidado).

**Base:** branch `EURODEV-79/lidar-bounding-box` a partir de `EURODEV-77/scan-rn-integration-extras`. (Criar subtask EURODEV-79 no Jira sob o Epic EURODEV-73.)

---

### Task 1: Branch + plano
- [ ] `git checkout EURODEV-77/scan-rn-integration-extras && git checkout -b EURODEV-79/lidar-bounding-box`
- [ ] `git add docs/superpowers/plans/2026-06-08-lidar-bounding-box.md && git commit -m "docs: add EURODEV-79 manual bounding box plan"`

---

### Task 2: `MeshCropper` (função pura) + teste TDD

**Files:** Create `mobile/modules/lidar-scanner/ios/MeshCropper.swift`, `MeshCropperTests.swift` (excluído do build pelo `exclude_files` existente).

- [ ] **Step 1: Teste primeiro** — `MeshCropperTests.swift`:
```swift
// Rodar: cp MeshCropperTests.swift main.swift && swiftc MeshCropper.swift main.swift -o /tmp/ctest && /tmp/ctest; rm -f main.swift /tmp/ctest
import simd
import Foundation
func check(_ c: Bool, _ m: String){ if !c { print("❌ \(m)"); exit(1) }; print("✅ \(m)") }

// Caixa centrada na origem, half-extents (1,1,1), sem rotação → inverse = identidade.
let inv = matrix_identity_float4x4
let half = SIMD3<Float>(1,1,1)
// 3 vértices dentro (formam 1 face) + 1 fora.
let verts: [SIMD3<Float>] = [SIMD3(0,0,0), SIMD3(0.5,0,0), SIMD3(0,0.5,0), SIMD3(5,5,5)]
let faces: [UInt32] = [0,1,2,  0,1,3]   // face A dentro; face B toca o vértice 3 (fora)
let (v, f) = MeshCropper.crop(vertices: verts, faces: faces, boxInverse: inv, halfExtents: half)
check(v.count == 3, "mantém só os 3 vértices dentro")
check(f.count == 3, "mantém só a face cujos 3 vértices estão dentro (1 triângulo)")
check(f == [0,1,2], "índices remapeados para a nova lista")
// Caixa vazia (nada dentro) → vazio, sem crash.
let (v2, f2) = MeshCropper.crop(vertices: [SIMD3(9,9,9)], faces: [], boxInverse: inv, halfExtents: half)
check(v2.isEmpty && f2.isEmpty, "fora da caixa → vazio")
print("Todos os testes passaram.")
```

- [ ] **Step 2: Rodar e ver FALHAR** (`swiftc` — arquivo nomeado `main.swift`):
```bash
cd /Users/macbookaireucportugal/Documents/Notas/Cods/PondiFarmApp/mobile/modules/lidar-scanner/ios
cp MeshCropperTests.swift main.swift && swiftc MeshCropper.swift main.swift -o /tmp/ctest 2>&1; rm -f main.swift
```

- [ ] **Step 3: Implementar `MeshCropper.swift`:**
```swift
import simd

/// Recorta uma malha mantendo só os vértices dentro de uma caixa orientada (OBB),
/// definida pelo inverso da sua transformação de mundo + meias-extensões.
/// Mantém uma face só se os 3 vértices estiverem dentro; remapeia índices. Função pura.
enum MeshCropper {
  static func crop(
    vertices: [SIMD3<Float>],
    faces: [UInt32],
    boxInverse: simd_float4x4,
    halfExtents: SIMD3<Float>
  ) -> (vertices: [SIMD3<Float>], faces: [UInt32]) {
    // 1) marcar quais vértices estão dentro + construir remap.
    var inside = [Bool](repeating: false, count: vertices.count)
    var remap = [Int32](repeating: -1, count: vertices.count)
    var out: [SIMD3<Float>] = []
    for i in 0..<vertices.count {
      let local = boxInverse * SIMD4<Float>(vertices[i], 1)
      if abs(local.x) <= halfExtents.x && abs(local.y) <= halfExtents.y && abs(local.z) <= halfExtents.z {
        inside[i] = true
        remap[i] = Int32(out.count)
        out.append(vertices[i])
      }
    }
    // 2) manter faces com os 3 vértices dentro, remapeadas.
    var outFaces: [UInt32] = []
    var j = 0
    while j + 2 < faces.count {
      let a = Int(faces[j]), b = Int(faces[j+1]), c = Int(faces[j+2])
      if a < inside.count && b < inside.count && c < inside.count && inside[a] && inside[b] && inside[c] {
        outFaces.append(UInt32(remap[a])); outFaces.append(UInt32(remap[b])); outFaces.append(UInt32(remap[c]))
      }
      j += 3
    }
    return (out, outFaces)
  }
}
```
> Nota do teste: o segundo triângulo `[0,1,3]` é descartado (vértice 3 fora) — restando `[0,1,2]`. `while j+2 < faces.count` cobre todas as triplas completas (igual ao ObjExporter).

- [ ] **Step 4: Rodar e ver PASSAR** (mesmo comando do Step 2 com `&& /tmp/ctest`). Esperado: 5 ✅ + "Todos os testes passaram."
- [ ] **Step 5: Commit** `feat(mobile): pure mesh cropper (OBB containment) with standalone test`.

---

### Task 3: Caixa AR + recorte no `stopScan` (Swift)

**Files:** Modify `mobile/modules/lidar-scanner/ios/LidarScannerView.swift`, `LidarScannerModule.swift`.

- [ ] **Step 1: `LidarScannerView`** — adicionar:
  - Propriedades: `private var boxAnchor: AnchorEntity?`, `private var boxHalfExtents = SIMD3<Float>(0.55, 0.85, 1.3)` (metade de La1.1×A1.7×L2.6), `private var boxScale: Float = 1.0`.
  - `private func placeBoxInFront()`: pega `arView.session.currentFrame?.camera.transform`; calcula um ponto ~1.8 m à frente (no plano horizontal — zerar componente Y da direção), com **yaw** da câmera (sem pitch/roll). Cria/move um `AnchorEntity` nesse transform. Adiciona um `ModelEntity` caixa translúcida: `MeshResource.generateBox(size: [La,A,L])` com `SimpleMaterial(color: .green.withAlphaComponent(0.14), isMetallic: false)` escalada por `boxScale`. Guardar o transform de mundo da caixa.
  - Chamar `placeBoxInFront()` no fim de `startScan()`.
  - `func recenterBox()` → `placeBoxInFront()`.
  - `func setBoxScale(_ s: Float)` → `boxScale = clamp(s, 0.5, 2.0)`; atualizar a escala do ModelEntity.
- [ ] **Step 2: `stopScan()`** — antes de medir/exportar: calcular `boxInverse = simd_inverse(boxWorldTransform)` e `extents = boxHalfExtents * boxScale`; `let (cv, cf) = MeshCropper.crop(vertices: vertices, faces: faces, boxInverse: boxInverse, halfExtents: extents)`. Usar `cv`/`cf` para `ObjExporter`, `MeshMeasurer.measure(cv)` e os counts. (Se `cv` vazio → emitir payload vazio, como no guard existente.)
- [ ] **Step 3: `LidarScannerModule`** — adicionar AsyncFunctions:
```swift
AsyncFunction("setBoxScale") { (view: LidarScannerView, scale: Double) in view.setBoxScale(Float(scale)) }
AsyncFunction("recenterBox") { (view: LidarScannerView) in view.recenterBox() }
```
- [ ] **Step 4: Commit** `feat(mobile): AR framing box + crop mesh to box before measure/export`.

---

### Task 4: Bridge TS + controles na tela

**Files:** Modify `mobile/modules/lidar-scanner/src/LidarScannerView.tsx`, `index.ts`, `mobile/src/screens/ScanScreen.tsx`.

- [ ] **Step 1:** Em `LidarScannerView.tsx`, adicionar ao `LidarScannerViewRef`: `setBoxScale(scale: number): Promise<void>; recenterBox(): Promise<void>;`.
- [ ] **Step 2:** No `ScanScreen.tsx`, durante o scan ativo, mostrar controles discretos (estilo iOS HIG sobre a câmera): **− / escala / +** (passo 0.1, range 0.5–2.0 → `scannerRef.current?.setBoxScale(next)`) e botão **"Reposicionar"** (`recenterBox()`). Texto de ajuda: "Enquadre o animal na caixa verde".
- [ ] **Step 3:** Typecheck `cd mobile && npx tsc --noEmit` → exit 0.
- [ ] **Step 4:** `npx pod-install` (arquivo nativo novo `MeshCropper.swift`). Commit `feat(mobile): box scale/recenter controls in scan screen`.

---

### Task 5: Verificação no device (consolidada)
- [ ] Rebuild (Xcode ▶ + Metro túnel https). Iniciar scan → **caixa verde** aparece à frente → andar ao redor do animal/objeto, ajustar escala pra enquadrar → Parar.
- [ ] Conferir: medidas agora refletem **o objeto enquadrado** (testar com objeto de tamanho conhecido — comprimento/altura/largura batem na régua, sem inflar com parede/chão). `.obj` exportado contém só a malha recortada.
- [ ] Push + PR base `EURODEV-77`.

---

## Self-Review
- **I5 resolvido:** crop por caixa OBB isola o sujeito antes de medir/exportar. ✅
- **TDD real:** `MeshCropper` puro testado com `swiftc` (dentro/fora/face parcial/vazio). ✅
- **Tipos:** `setBoxScale`/`recenterBox` no `LidarScannerViewRef`; AsyncFunctions casam. Crop roda antes de `MeshMeasurer`/`ObjExporter` (que já existem).
- **Honestidade:** continua sem peso; medidas agora do sujeito real enquadrado. Caixa translúcida v1 (wireframe = polish futuro). Limitação: chão sob o animal dentro da caixa ainda conta (refinável com remoção de plano depois).
