import ExpoModulesCore
import ARKit
import RealityKit
import CoreImage
import Combine

class LidarScannerView: ExpoView {
  private let arView = ARView(frame: .zero)
  private let onScanComplete = EventDispatcher()

  // --- Caixa de enquadramento AR (world-anchored) ---
  private var boxAnchor: AnchorEntity?
  private var boxModel: ModelEntity?
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
    startSession()
    // RealityKit é dono do ARSession delegate; subscrevemos ao loop de render
    // SEM substituir o delegate. A amostragem de cor roda na main (throttled).
    sceneUpdateSub = arView.scene.subscribe(to: SceneEvents.Update.self) { [weak self] _ in
      self?.sampleColors()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    arView.frame = bounds
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
      // Show the LiDAR mesh — visual confirmation for Phase 1.
      arView.debugOptions.insert(.showSceneUnderstanding)
    }
    config.environmentTexturing = .none
    arView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
  }

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
    let size = boxBaseSize * boxScale
    let mesh = MeshResource.generateBox(size: size)
    let mat = SimpleMaterial(color: .init(red: 0.37, green: 0.50, blue: 0.41, alpha: 0.16), isMetallic: false)
    let model = ModelEntity(mesh: mesh, materials: [mat])
    anchor.addChild(model)
    arView.scene.addAnchor(anchor)
    boxAnchor = anchor
    boxModel = model
  }

  /// Regenera a malha da caixa visual com o tamanho atual (boxBaseSize * boxScale).
  private func updateBoxMesh() {
    guard let model = boxModel else { return }
    model.scale = SIMD3<Float>(repeating: 1)
    model.model?.mesh = MeshResource.generateBox(size: boxBaseSize * boxScale)
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

    // Passo 1: captura keyframe para o bake de textura (distribuído por movimento).
    maybeCaptureKeyframe(cgImage: cgImage, camera: camera, srcW: imgW, srcH: imgH)

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
    // 600: bom equilíbrio entre cobertura de cor e carga na main (1500 sobrecarregava
    // a main e starvava o tracking do ARKit → "poor slam").
    let budget = 600
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

  /// Passo 1: guarda um keyframe (RGBA reduzido + proj×view + posição) quando a câmera
  /// se moveu o suficiente, até o limite. Usado pelo bake de textura no fim do scan.
  private func maybeCaptureKeyframe(cgImage: CGImage, camera: ARCamera, srcW: Int, srcH: Int) {
    guard keyframes.count < LidarScannerView.maxKeyframes else { return }
    let c = camera.transform.columns.3
    let camPos = SIMD3<Float>(c.x, c.y, c.z)
    if let last = lastKeyframePos,
       simd_distance(last, camPos) < LidarScannerView.keyframeMinMove {
      return
    }

    // Reduz mantendo o aspecto da imagem fonte.
    let dw = LidarScannerView.keyframeWidth
    let dh = max(1, Int((Float(dw) * Float(srcH) / Float(srcW)).rounded()))
    let bpr = dw * 4
    var buf = [UInt8](repeating: 0, count: bpr * dh)
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
      data: &buf, width: dw, height: dh,
      bitsPerComponent: 8, bytesPerRow: bpr, space: cs,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return }
    ctx.interpolationQuality = .medium
    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: dw, height: dh))

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
