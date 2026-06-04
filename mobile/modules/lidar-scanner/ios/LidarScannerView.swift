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
}
