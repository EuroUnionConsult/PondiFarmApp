import ExpoModulesCore
import ARKit
import RealityKit
import CoreImage
import Combine

class LidarScannerView: ExpoView {
  private let arView = ARView(frame: .zero)
  // Overlay oficial da Apple que guia o usuário a mover o aparelho até o tracking
  // (VIO) inicializar — corrige o "poor slam / vio_initialized(0)".
  private let coachingOverlay = ARCoachingOverlayView()
  private let onScanComplete = EventDispatcher()

  // --- Caixa de enquadramento AR (world-anchored) ---
  private var boxAnchor: AnchorEntity?
  private var boxCage: Entity?   // contorno em arame (12 arestas), não bloco sólido
  private var boxWorldTransform: simd_float4x4 = matrix_identity_float4x4
  private let boxBaseSize = SIMD3<Float>(1.1, 1.7, 2.6)   // largura, altura, comprimento (m) — bovino
  private var boxScale: Float = 1.0

  // --- Cor por-vértice acumulada durante o scan (EURODEV-80, Tarefa 4) ---
  // Mapa voxel (2 cm) → cor RGB 0–1. Amostrado da câmera ao longo do scan.
  private var colorByVoxel: [SIMD3<Int32>: SIMD3<Float>] = [:]
  private var isScanning = false
  private var frameTick = 0
  private var sceneUpdateSub: Cancellable?

  // CIContext reutilizado (criar a cada frame é caro).
  private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

  // Tamanho do voxel (m) para a chave de cor. 1,2 cm = cor mais fina (antes 2 cm).
  private static let voxelSize: Float = 0.012

  // --- Keyframes para o bake de textura UV (Passo 1) ---
  // RGBA reduzido + proj×view + posição da câmera, distribuídos por movimento.
  private var keyframes: [TextureBaker.Frame] = []
  private var lastKeyframePos: SIMD3<Float>?
  private static let maxKeyframes = 36
  private static let keyframeWidth = 640      // largura do keyframe reduzido
  private static let keyframeMinMove: Float = 0.06  // m de deslocamento p/ novo keyframe

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    addSubview(arView)
    // Não deixar o RealityKit reconfigurar/sobrescrever a nossa sessão (sceneReconstruction).
    arView.automaticallyConfigureSession = false
    startSession()

    // Coaching overlay: guia o usuário a mover o aparelho até o tracking inicializar.
    coachingOverlay.session = arView.session
    coachingOverlay.goal = .tracking
    coachingOverlay.activatesAutomatically = true
    coachingOverlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    arView.addSubview(coachingOverlay)

    // RealityKit é dono do ARSession delegate; subscrevemos ao loop de render
    // SEM substituir o delegate. A amostragem de cor roda na main (throttled).
    sceneUpdateSub = arView.scene.subscribe(to: SceneEvents.Update.self) { [weak self] _ in
      self?.sampleColors()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    arView.frame = bounds
    coachingOverlay.frame = arView.bounds
  }

  deinit {
    sceneUpdateSub?.cancel()
    arView.session.pause()
  }

  private func startSession() {
    guard ARWorldTrackingConfiguration.isSupported else { return }
    let config = ARWorldTrackingConfiguration()
    if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
      config.sceneReconstruction = .mesh
    }
    config.environmentTexturing = .none
    arView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
  }

  func startScan() {
    guard ARWorldTrackingConfiguration.isSupported else { return }
    let config = ARWorldTrackingConfiguration()
    if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
      config.sceneReconstruction = .mesh
    }
    config.environmentTexturing = .none
    // .resetSceneReconstruction limpa a malha de scans anteriores.
    arView.session.run(config, options: [.resetTracking, .removeExistingAnchors, .resetSceneReconstruction])
    placeBoxInFront()
    // Começa a acumular cor e keyframes a partir de agora.
    colorByVoxel.removeAll()
    keyframes.removeAll()
    lastKeyframePos = nil
    frameTick = 0
    isScanning = true
  }

  /// Coloca a caixa de enquadramento ~1.8 m à frente da câmera, NIVELADA (só yaw —
  /// ignora pitch/roll da câmera). World-anchored: guarda `boxWorldTransform`.
  private func placeBoxInFront() {
    guard let cam = arView.session.currentFrame?.camera else { return }
    let camT = cam.transform
    // posição da câmera
    let camPos = SIMD3<Float>(camT.columns.3.x, camT.columns.3.y, camT.columns.3.z)
    // direção "para frente" da câmera projetada no plano horizontal (yaw)
    var fwd = -SIMD3<Float>(camT.columns.2.x, 0, camT.columns.2.z)
    if simd_length(fwd) < 1e-4 { fwd = SIMD3<Float>(0, 0, -1) }
    fwd = simd_normalize(fwd)
    let center = camPos + fwd * 1.8
    // yaw a partir de fwd
    let yaw = atan2(fwd.x, fwd.z)
    var t = simd_float4x4(simd_quatf(angle: yaw, axis: SIMD3<Float>(0, 1, 0)))
    t.columns.3 = SIMD4<Float>(center.x, center.y, center.z, 1)
    boxWorldTransform = t

    boxAnchor?.removeFromParent()
    let anchor = AnchorEntity(world: t)
    let cage = LidarScannerView.makeBoxCage(size: boxBaseSize * boxScale)
    anchor.addChild(cage)
    arView.scene.addAnchor(anchor)
    boxAnchor = anchor
    boxCage = cage
  }

  /// Regenera o contorno com o tamanho atual, NO MESMO lugar (sem recentrar).
  private func updateBoxMesh() {
    guard let anchor = boxAnchor else { return }
    boxCage?.removeFromParent()
    let cage = LidarScannerView.makeBoxCage(size: boxBaseSize * boxScale)
    anchor.addChild(cage)
    boxCage = cage
  }

  /// Contorno em arame (12 arestas finas verdes) — vê-se através, estilo Polycam.
  /// Centrado na origem; `size` = largura×altura×comprimento (m).
  private static func makeBoxCage(size: SIMD3<Float>) -> Entity {
    let cage = Entity()
    let t: Float = 0.015  // espessura das arestas (m)
    let mat = SimpleMaterial(
      color: .init(red: 0.20, green: 0.95, blue: 0.45, alpha: 1.0),
      isMetallic: false
    )
    let hx = size.x / 2, hy = size.y / 2, hz = size.z / 2

    func edge(_ dims: SIMD3<Float>, _ pos: SIMD3<Float>) {
      let m = ModelEntity(mesh: .generateBox(size: dims), materials: [mat])
      m.position = pos
      cage.addChild(m)
    }
    // 4 arestas ao longo de X (largura)
    for sy in [hy, -hy] { for sz in [hz, -hz] { edge(SIMD3(size.x, t, t), SIMD3(0, sy, sz)) } }
    // 4 arestas ao longo de Y (altura)
    for sx in [hx, -hx] { for sz in [hz, -hz] { edge(SIMD3(t, size.y, t), SIMD3(sx, 0, sz)) } }
    // 4 arestas ao longo de Z (comprimento)
    for sx in [hx, -hx] { for sy in [hy, -hy] { edge(SIMD3(t, t, size.z), SIMD3(sx, sy, 0)) } }
    return cage
  }

  func recenterBox() {
    placeBoxInFront()
  }

  func setBoxScale(_ s: Float) {
    boxScale = min(2.0, max(0.5, s))
    updateBoxMesh()
  }

  func stopScan() {
    // Snapshot do estado compartilhado SEMPRE na main (serializa com sampleColors,
    // que também roda na main). stopScan vem do Expo FORA da main → sem isto, ler
    // keyframes/colorByVoxel aqui corre com a escrita na main = EXC_BAD_ACCESS.
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.isScanning = false
      guard let frame = self.arView.session.currentFrame else {
        self.onScanComplete(["meshUri": "", "vertexCount": 0, "faceCount": 0])
        return
      }
      let meshAnchors = frame.anchors.compactMap { $0 as? ARMeshAnchor }
      let boxInv = simd_inverse(self.boxWorldTransform)
      let half = self.boxBaseSize * self.boxScale * 0.5
      let colorMap = self.colorByVoxel
      let frames = self.keyframes

      DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      let (vertices0, faces0) = LidarScannerView.consolidate(meshAnchors)
      // Recorta a malha à caixa de enquadramento ANTES de medir/exportar.
      let (vertices, faces) = MeshCropper.crop(vertices: vertices0, faces: faces0, boxInverse: boxInv, halfExtents: half)
      let obj = ObjExporter.objString(vertices: vertices, faces: faces)
      let m = MeshMeasurer.measure(vertices)

      // Cor por-vértice: lê o voxel correspondente ou cinza padrão.
      let colors = vertices.map { LidarScannerView.colorFor($0, in: colorMap) }
      let ply = PlyExporter.plyString(vertices: vertices, faces: faces, colors: colors)

      // Grava em Documents/ (persistente, compartilhável) — não em tmp/.
      let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let stamp = Int(Date().timeIntervalSince1970)
      let url = docs.appendingPathComponent("scan-\(stamp).obj")
      let plyUrl = docs.appendingPathComponent("scan-\(stamp).ply")

      var payload: [String: Any]
      do {
        try obj.write(to: url, atomically: true, encoding: .utf8)
        try ply.write(to: plyUrl, atomically: true, encoding: .utf8)
        payload = [
          "meshUri": url.absoluteString,
          "meshPlyUri": plyUrl.absoluteString,
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

        // Passos 3+4: bake de textura UV e export OBJ+MTL+PNG. Best-effort —
        // se falhar (poucos keyframes, etc.), mantém obj/ply normais.
        if let baked = TextureBaker.bake(vertices: vertices, faces: faces, frames: frames) {
          let texturedURL = try TexturedObjExporter.write(
            directory: docs,
            baseName: "scan-\(stamp)-tex",
            vertices: vertices,
            faces: faces,
            texcoords: baked.texcoords,
            atlas: baked.atlas,
            atlasSize: baked.size
          )
          payload["meshTexturedUri"] = texturedURL.absoluteString
        }
      } catch {
        print("[LidarScanner] ❌ Falha ao gravar malha: \(error)")
        payload = ["meshUri": "", "vertexCount": 0, "faceCount": 0]
      }
      DispatchQueue.main.async { self?.onScanComplete(payload) }
      }
    }
  }

  // MARK: - Amostragem de cor (EURODEV-80, Tarefa 4)

  /// Chave de voxel (2 cm) a partir de uma posição de mundo.
  static func voxelKey(_ p: SIMD3<Float>) -> SIMD3<Int32> {
    SIMD3<Int32>(
      Int32(floor(p.x / voxelSize)),
      Int32(floor(p.y / voxelSize)),
      Int32(floor(p.z / voxelSize))
    )
  }

  /// Cor do voxel correspondente, ou cinza padrão se a superfície nunca foi vista.
  static func colorFor(_ p: SIMD3<Float>, in map: [SIMD3<Int32>: SIMD3<Float>]) -> SIMD3<Float> {
    map[voxelKey(p)] ?? SIMD3<Float>(0.6, 0.6, 0.6)
  }

  /// Roda na main (loop de render do RealityKit). Throttle forte: 1 em cada 5 frames,
  /// e no máximo ~250 vértices por tick. Correção > completude: superfícies não vistas
  /// permanecem cinza. Projeta vértices da malha na imagem da câmera e lê o RGB.
  private func sampleColors() {
    guard isScanning else { return }
    frameTick += 1
    guard frameTick % 5 == 0 else { return }
    guard let frame = arView.session.currentFrame else { return }

    let pixelBuffer = frame.capturedImage
    // Tamanho da imagem capturada em pixels (CVPixelBuffer é landscape).
    let imgW = CVPixelBufferGetWidth(pixelBuffer)
    let imgH = CVPixelBufferGetHeight(pixelBuffer)

    // Converte YUV → CGImage uma vez por tick.
    let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
    guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else { return }
    let cgW = cgImage.width
    let cgH = cgImage.height

    // Lê todos os bytes para um buffer RGBA8 contíguo (acesso O(1) por pixel).
    let bytesPerPixel = 4
    let bytesPerRow = cgW * bytesPerPixel
    var raw = [UInt8](repeating: 0, count: bytesPerRow * cgH)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
      data: &raw,
      width: cgW, height: cgH,
      bitsPerComponent: 8, bytesPerRow: bytesPerRow,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return }
    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: cgW, height: cgH))

    let camera = frame.camera

    // Passo 1: captura keyframe (subamostra do `raw` já extraído — barato).
    maybeCaptureKeyframe(raw: raw, srcW: cgW, srcH: cgH, bytesPerRow: bytesPerRow, camera: camera)

    // projectPoint espera o viewport em PONTOS na orientação dada. Usamos a imagem
    // capturada em landscape (.landscapeRight é a orientação nativa do sensor) e
    // mapeamos o ponto resultante para pixels do CGImage.
    let viewport = CGSize(width: imgW, height: imgH)

    let meshAnchors = frame.anchors.compactMap { $0 as? ARMeshAnchor }
    guard !meshAnchors.isEmpty else { return }

    let camPos = SIMD3<Float>(
      camera.transform.columns.3.x,
      camera.transform.columns.3.y,
      camera.transform.columns.3.z
    )
    let camForward = -SIMD3<Float>(
      camera.transform.columns.2.x,
      camera.transform.columns.2.y,
      camera.transform.columns.2.z
    )

    // Orçamento total de vértices este tick, distribuído pelos anchors com stride.
    // 250: valor original que NÃO starvava o tracking do ARKit. Subir isto sobrecarrega
    // a main (sampleColors roda no loop de render) e impede o VIO de inicializar.
    let budget = 250
    let totalVerts = meshAnchors.reduce(0) { $0 + $1.geometry.vertices.count }
    guard totalVerts > 0 else { return }
    let stride = max(1, totalVerts / budget)
    var counter = 0

    for anchor in meshAnchors {
      let geom = anchor.geometry
      let vSrc = geom.vertices
      let vBuf = vSrc.buffer.contents()
      var i = 0
      while i < vSrc.count {
        defer { i += 1; counter += 1 }
        guard counter % stride == 0 else { continue }

        let ptr = vBuf.advanced(by: vSrc.offset + vSrc.stride * i)
          .assumingMemoryBound(to: Float.self)
        let local = SIMD4<Float>(ptr[0], ptr[1], ptr[2], 1)
        let worldH = anchor.transform * local
        let world = SIMD3<Float>(worldH.x, worldH.y, worldH.z)

        // Descarta vértices atrás da câmera.
        if simd_dot(world - camPos, camForward) <= 0 { continue }

        // Projeta para o viewport (landscapeRight, em pontos = pixels da imagem capturada).
        let projected = camera.projectPoint(
          world,
          orientation: .landscapeRight,
          viewportSize: viewport
        )
        let px = projected.x
        let py = projected.y
        if px < 0 || py < 0 || px >= viewport.width || py >= viewport.height { continue }

        // Mapeia coordenadas do viewport (imgW×imgH) para pixels do CGImage (cgW×cgH).
        let sx = Int((px / viewport.width) * CGFloat(cgW))
        let sy = Int((py / viewport.height) * CGFloat(cgH))
        if sx < 0 || sy < 0 || sx >= cgW || sy >= cgH { continue }

        let off = sy * bytesPerRow + sx * bytesPerPixel
        let r = Float(raw[off]) / 255.0
        let g = Float(raw[off + 1]) / 255.0
        let b = Float(raw[off + 2]) / 255.0
        colorByVoxel[LidarScannerView.voxelKey(world)] = SIMD3<Float>(r, g, b)
      }
    }
  }

  /// Passo 1: guarda um keyframe quando a câmera se moveu o suficiente, até o limite.
  /// BARATO: subamostra (nearest) do buffer `raw` já extraído — sem novo CGContext/draw,
  /// pra não starvar o tracking do ARKit na main.
  private func maybeCaptureKeyframe(
    raw: [UInt8], srcW: Int, srcH: Int, bytesPerRow: Int, camera: ARCamera
  ) {
    guard keyframes.count < LidarScannerView.maxKeyframes else { return }
    let c = camera.transform.columns.3
    let camPos = SIMD3<Float>(c.x, c.y, c.z)
    if let last = lastKeyframePos,
       simd_distance(last, camPos) < LidarScannerView.keyframeMinMove {
      return
    }

    // Reduz por subamostragem (nearest), mantendo o aspecto.
    let dw = LidarScannerView.keyframeWidth
    let dh = max(1, srcH * dw / srcW)
    var buf = [UInt8](repeating: 0, count: dw * dh * 4)
    for ky in 0..<dh {
      let sy = ky * srcH / dh
      let srcRow = sy * bytesPerRow
      let dstRow = ky * dw * 4
      for kx in 0..<dw {
        let sx = kx * srcW / dw
        let so = srcRow + sx * 4
        let dstOff = dstRow + kx * 4
        buf[dstOff] = raw[so]
        buf[dstOff + 1] = raw[so + 1]
        buf[dstOff + 2] = raw[so + 2]
        buf[dstOff + 3] = 255
      }
    }

    // proj×view na orientação de captura; viewport com o aspecto da imagem fonte.
    let view = camera.viewMatrix(for: .landscapeRight)
    let proj = camera.projectionMatrix(
      for: .landscapeRight,
      viewportSize: CGSize(width: srcW, height: srcH),
      zNear: 0.001, zFar: 1000
    )
    let projView = proj * view

    keyframes.append(TextureBaker.Frame(
      rgba: buf, width: dw, height: dh, projView: projView, camPos: camPos
    ))
    lastKeyframePos = camPos
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
}
