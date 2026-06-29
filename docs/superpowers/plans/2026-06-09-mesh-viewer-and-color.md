# In-app 3D Mesh Viewer + Vertex Color — Implementation Plan (EURODEV-80)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** (1) Visualizar o scan **dentro do app** (visualizador 3D na tela Result, girar/zoom). (2) **Colorir** a malha amostrando a cor da câmera por vértice ao longo do scan, e mostrar/exportar colorido.

**Architecture:** Parte A (viewer) é independente e de baixo risco — uma `SceneKit SCNView` nativa que carrega o `.obj`/geometria e permite orbit. Parte B (cor) acumula cor por vértice durante o scan (subscrição ao update do RealityKit lendo `currentFrame.capturedImage`, projetando vértices e amostrando RGB), exporta **PLY com cor** e alimenta o viewer com geometria colorida.

**Tech Stack:** Swift + SceneKit (viewer) + ARKit/RealityKit (cor) + simd; expo-modules-core (nova View nativa `MeshPreview`); RN/TS. Native → rebuild.

**Base:** branch `EURODEV-80/mesh-viewer-color` a partir de `EURODEV-79/lidar-bounding-box`. (Subtask EURODEV-80 sob o Epic EURODEV-73.)

**Honestidade de escopo:**
- Viewer (A): entrega sólida.
- Cor (B): amostragem por vértice da câmera = cor **real porém v1** (qualidade depende de cobertura/luz; superfícies nunca vistas ficam cinza). NÃO é textura fotogramétrica tipo Polycam. Provável ajuste no device. Continua sem peso.

---

## PARTE A — Visualizador 3D no app

### Task 1: Branch + plano
- [ ] `git checkout EURODEV-79/lidar-bounding-box && git checkout -b EURODEV-80/mesh-viewer-color`
- [ ] commit do plano.

### Task 2: View nativa `MeshPreview` (SceneKit)
**Files:** Create `mobile/modules/lidar-scanner/ios/MeshPreviewView.swift`; Modify `LidarScannerModule.swift`; Create `mobile/modules/lidar-scanner/src/MeshPreviewView.tsx`; Modify `index.ts`.
- [ ] **iOS:** `MeshPreviewView: ExpoView` contendo um `SCNView` (`allowsCameraControl = true`, `autoenablesDefaultLighting = true`, `backgroundColor = .clear`). Prop `source: String` (file URI). Ao setar, carregar via `SCNScene(url: URL(string: source)!, options: nil)` (ou `MDLAsset`), centralizar a câmera no bounding box. Se o arquivo tiver cor (PLY), respeitar; senão cinza sombreado.
  ```swift
  // Module:
  View(MeshPreviewView.self) {
    Prop("source") { (view: MeshPreviewView, uri: String) in view.load(uri) }
  }
  ```
- [ ] **TS:** `MeshPreviewView.tsx` via `requireNativeView('MeshPreview')` (ou nome do módulo) com prop `source: string` + `style`. Exportar no `index.ts`.
- [ ] **Confirmar** que SceneKit lê `.obj` (formato que já exportamos). Se o loader exigir, converter via `MDLAsset(url:)` → `SCNScene(mdlAsset:)`.
- [ ] Commit `feat(mobile): native SceneKit mesh preview view`.

### Task 3: Usar o viewer na tela Result
**Files:** Modify `mobile/src/screens/ResultScreen.tsx`.
- [ ] Adicionar um card "Modelo 3D" com `<MeshPreviewView source={record.meshUri} style={{height: 260}} />` (ou abrir em modal ao tocar). Acima da seção de medidas. Estilo iOS HIG. Typecheck verde.
- [ ] Commit `feat(mobile): show scanned 3D model in result screen`.

> Após a Parte A, o "pedido 2" (ver no app) está resolvido — mesmo que cinza.

---

## PARTE B — Cor por vértice (amostrada da câmera)

### Task 4: Acumular cor durante o scan (Swift)
**Files:** Modify `LidarScannerView.swift`.
- [ ] **Subscrição de frame SEM roubar o delegate do RealityKit:** usar `arView.scene.subscribe(to: SceneEvents.Update.self) { [weak self] _ in self?.sampleColors() }` (guardar o cancellable). Em `sampleColors()`, se `isScanning`, pegar `arView.session.currentFrame` e, para os `ARMeshAnchor` atuais, projetar uma amostra de vértices na imagem (`frame.camera.projectPoint` ou intrínsecas + `frame.capturedImage` YUV→RGB) e guardar/atualizar a cor num dicionário keyed por `(anchorId, vertexIndex)` ou por posição quantizada de mundo (mais simples/robusto a updates de anchor): `[VoxelKey: SIMD3<Float>]` num grid fino (ex. 1 cm).
- [ ] `startScan`: `isScanning = true`, limpa o dicionário de cores; `stopScan`: `isScanning = false`.
- [ ] Em `consolidate`/`stopScan`: para cada vértice de saída, buscar a cor no grid (vizinho mais próximo / mesma voxel); default cinza (0.6,0.6,0.6) se não amostrada.
- [ ] **Performance:** amostrar no máx. N vértices por frame e a cada ~3 frames pra não travar; YUV→RGB só nos pontos amostrados.
- [ ] Commit `feat(mobile): accumulate per-vertex color from camera during scan`.

### Task 5: Exportar PLY colorido + viewer colorido
**Files:** Create `mobile/modules/lidar-scanner/ios/PlyExporter.swift` (+ test); Modify `LidarScannerView.swift` (stopScan grava `.ply` colorido além do `.obj`); `MeshPreviewView` carrega `.ply`.
- [ ] `PlyExporter.plyString(vertices, faces, colors) -> String` (formato ASCII PLY com `property uchar red/green/blue`). TDD com `swiftc` (cubo + cores → cabeçalho/contagens corretos).
- [ ] `stopScan`: gravar `scan-….ply` (com cor) e manter o `.obj` (geometria). Adicionar `meshPlyUri` ao payload/record (ou usar o PLY como `meshUri` do viewer).
- [ ] `MeshPreviewView` carregar o `.ply` (SceneKit/MDLAsset lê PLY com cor de vértice; se o SCN não exibir vertex color, construir `SCNGeometry` com `SCNGeometrySource(colors:)`).
- [ ] ResultScreen viewer usa o `.ply`; Compartilhar oferece `.ply` (colorido) e/ou `.obj`.
- [ ] Typecheck + `npx pod-install` (arquivos nativos novos) + commit.

### Task 6: Verificação no device (consolidada)
- [ ] Rebuild → escanear objeto fosco bem iluminado → no Result, **girar o modelo 3D** (Parte A) e ver **cor** nas superfícies que foram filmadas (Parte B). Compartilhar `.ply` e abrir no Mac (Preview/MeshLab) pra conferir cor.
- [ ] Honesto: superfícies não filmadas ficam cinza; luz fraca = cor ruim. Se a qualidade não compensar, manter só o viewer (Parte A) e marcar cor como experimental.

---

## Self-Review
- Pedido 2 (ver no app) → Parte A (viewer SceneKit) ✅, independente e robusto.
- Pedido 1 (cor) → Parte B (amostragem por vértice + PLY) ✅, com ressalva v1 honesta (não é fotogrametria; cinza onde não filmou).
- Sem peso; medidas inalteradas. `PlyExporter` puro com TDD. Subscrição de frame NÃO rouba o delegate do RealityKit (usa SceneEvents.Update). pod-install p/ arquivos nativos novos.
- Risco: projeção/amostragem de cor e leitura de PLY no SceneKit precisam de validação no device — Parte A entrega valor mesmo se a cor precisar de iteração.
