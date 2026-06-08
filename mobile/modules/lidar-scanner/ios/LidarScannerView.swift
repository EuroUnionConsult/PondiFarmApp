import ExpoModulesCore
import ARKit
import RealityKit

class LidarScannerView: ExpoView {
  private let arView = ARView(frame: .zero)
  private let onScanComplete = EventDispatcher()

  // --- Caixa de enquadramento AR (world-anchored) ---
  private var boxAnchor: AnchorEntity?
  private var boxModel: ModelEntity?
  private var boxWorldTransform: simd_float4x4 = matrix_identity_float4x4
  private let boxBaseSize = SIMD3<Float>(1.1, 1.7, 2.6)   // largura, altura, comprimento (m) — bovino
  private var boxScale: Float = 1.0

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

  deinit {
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
    guard let frame = arView.session.currentFrame else {
      onScanComplete(["meshUri": "", "vertexCount": 0, "faceCount": 0])
      return
    }
    let meshAnchors = frame.anchors.compactMap { $0 as? ARMeshAnchor }

    // Lê o estado da caixa na thread principal e captura por valor (evita data race).
    let boxInv = simd_inverse(boxWorldTransform)
    let half = boxBaseSize * boxScale * 0.5

    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      let (vertices0, faces0) = LidarScannerView.consolidate(meshAnchors)
      // Recorta a malha à caixa de enquadramento ANTES de medir/exportar.
      let (vertices, faces) = MeshCropper.crop(vertices: vertices0, faces: faces0, boxInverse: boxInv, halfExtents: half)
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
        print("[LidarScanner] ❌ Falha ao gravar OBJ: \(error)")
        payload = ["meshUri": "", "vertexCount": 0, "faceCount": 0]
      }
      DispatchQueue.main.async { self?.onScanComplete(payload) }
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
}
