import ExpoModulesCore
import SceneKit
import ModelIO
import SceneKit.ModelIO

class MeshPreviewView: ExpoView {
  private let scnView = SCNView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    scnView.allowsCameraControl = true
    scnView.defaultCameraController.interactionMode = .orbitTurntable
    // Fundo estúdio claro OPACO: o viewer deixa de depender do card JS e a malha "clay"
    // lê bem em qualquer iluminação de captura (antes: .clear sobre card preto = malha
    // escura sumia no fundo).
    scnView.backgroundColor = UIColor(red: 0.93, green: 0.94, blue: 0.96, alpha: 1)
    // Luz é montada por nós fixos em `load()`; a default lighting não afeta clay PBR bem.
    scnView.autoenablesDefaultLighting = false
    scnView.antialiasingMode = .multisampling4X
    addSubview(scnView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    scnView.frame = bounds
  }

  func load(_ uri: String) {
    guard let url = URL(string: uri) else { return }
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      let scene = MeshPreviewView.loadScene(from: url)

      // Malha do scanner é aberta (só o lado visto pelo operador) e a câmera de preview
      // cai num eixo arbitrário — sem double-sided ela veria só as costas dos triângulos
      // (culling) = tela preta. Garante double-sided em TODOS os materiais.
      scene.rootNode.enumerateChildNodes { node, _ in
        node.geometry?.materials.forEach { $0.isDoubleSided = true }
      }

      // Iluminação estúdio fixa (ambient de preenchimento + key direcional 3/4).
      let amb = SCNNode()
      amb.light = SCNLight()
      amb.light!.type = .ambient
      amb.light!.intensity = 400
      scene.rootNode.addChildNode(amb)
      let key = SCNNode()
      key.light = SCNLight()
      key.light!.type = .directional
      key.light!.intensity = 900
      key.eulerAngles = SCNVector3(-Float.pi / 3, Float.pi / 4, 0)
      scene.rootNode.addChildNode(key)

      // Enquadramento ROBUSTO: bounding box por percentil (2–98) ignora o disco de chão
      // e vértices soltos que antes inflavam o `span` e jogavam a câmera a metros de
      // distância (objeto minúsculo). Fallback para a bbox crua se houver poucos pontos.
      let (center, radius) = MeshPreviewView.framingBounds(scene)

      let camNode = SCNNode()
      let cam = SCNCamera()
      cam.fieldOfView = 45
      cam.automaticallyAdjustsZRange = true
      camNode.camera = cam
      let dist = radius / tan(Float(22.5 * .pi / 180)) * 1.15
      // Vista 3/4 ligeiramente de cima: o chão lê como chão, não como uma linha no meio.
      camNode.position = SCNVector3(center.x, center.y + radius * 0.4, center.z + dist)
      camNode.look(at: SCNVector3(center))
      scene.rootNode.addChildNode(camNode)

      DispatchQueue.main.async {
        guard let self else { return }
        self.scnView.scene = scene
        self.scnView.pointOfView = camNode
        self.scnView.defaultCameraController.target = SCNVector3(center)
      }
    }
  }

  /// Carrega a cena.
  /// - Para `.ply` (malha do scanner): reconstrói via ModelIO como "clay" iluminado
  ///   (material PBR cinza + normais geradas). A cor por-vértice foi desativada de
  ///   propósito no preview — 250 amostras/tick em luz fraca deixavam a malha suja/escura;
  ///   o clay com sombreamento de normais lê bem, estilo modo padrão do Polycam.
  /// - Para `.obj` texturizado (Object Capture / Render): ModelIO + loadTextures().
  private static func loadScene(from url: URL) -> SCNScene {
    let ext = url.pathExtension.lowercased()
    if ext == "ply" {
      if let scene = clayScene(from: url) { return scene }
    }
    // OBJ texturizado (com .mtl + .png irmãos): ModelIO + loadTextures() aplica o map_Kd.
    if ext == "obj" {
      let asset = MDLAsset(url: url)
      asset.loadTextures()
      return SCNScene(mdlAsset: asset)
    }
    if let scene = try? SCNScene(url: url, options: [.preserveOriginalTopology: true]) {
      return scene
    }
    let asset = MDLAsset(url: url)
    asset.loadTextures()
    return SCNScene(mdlAsset: asset)
  }

  /// Reconstrói a cena a partir do MDLAsset como malha "clay": material PBR cinza claro,
  /// duplo-face, com normais geradas (o PLY do scanner não traz normais; sem elas qualquer
  /// material iluminado renderiza preto).
  private static func clayScene(from url: URL) -> SCNScene? {
    let asset = MDLAsset(url: url)
    let scene = SCNScene()
    var added = false

    for case let mesh as MDLMesh in asset.childObjects(of: MDLMesh.self) {
      if mesh.vertexAttributeData(forAttributeNamed: MDLVertexAttributeNormal, as: .float3) == nil {
        mesh.addNormals(withAttributeNamed: MDLVertexAttributeNormal, creaseThreshold: 0.8)
      }
      let geometry = SCNGeometry(mdlMesh: mesh)
      for m in geometry.materials {
        m.lightingModel = .physicallyBased
        m.diffuse.contents = UIColor(white: 0.80, alpha: 1)   // clay
        m.roughness.contents = 0.55
        m.metalness.contents = 0.0
        m.isDoubleSided = true
      }
      scene.rootNode.addChildNode(SCNNode(geometry: geometry))
      added = true
    }
    return added ? scene : nil
  }

  /// Bounding box por percentil (2–98) em cada eixo, para não deixar o chão/outliers
  /// inflarem o enquadramento. Devolve centro + raio (metade da diagonal). Cai para a
  /// bbox crua do nó raiz se houver menos de 8 pontos.
  private static func framingBounds(_ scene: SCNScene) -> (center: SIMD3<Float>, radius: Float) {
    let pts = allVertexPositions(scene)
    if pts.count >= 8 {
      func pct(_ vals: [Float]) -> (Float, Float) {
        let s = vals.sorted()
        let lo = s[min(s.count - 1, Int(Float(s.count) * 0.02))]
        let hi = s[min(s.count - 1, Int(Float(s.count) * 0.98))]
        return (lo, hi)
      }
      let (xlo, xhi) = pct(pts.map { $0.x })
      let (ylo, yhi) = pct(pts.map { $0.y })
      let (zlo, zhi) = pct(pts.map { $0.z })
      let center = SIMD3<Float>((xlo + xhi) / 2, (ylo + yhi) / 2, (zlo + zhi) / 2)
      let diag = simd_length(SIMD3<Float>(xhi - xlo, yhi - ylo, zhi - zlo))
      return (center, max(diag / 2, 0.05))
    }
    let (minV, maxV) = scene.rootNode.boundingBox
    let center = SIMD3<Float>((minV.x + maxV.x) / 2, (minV.y + maxV.y) / 2, (minV.z + maxV.z) / 2)
    let diag = simd_length(SIMD3<Float>(maxV.x - minV.x, maxV.y - minV.y, maxV.z - minV.z))
    return (center, max(diag / 2, 0.05))
  }

  /// Extrai todas as posições de vértice (semântica `.vertex`) das geometrias da cena.
  private static func allVertexPositions(_ scene: SCNScene) -> [SIMD3<Float>] {
    var pts: [SIMD3<Float>] = []
    scene.rootNode.enumerateChildNodes { node, _ in
      guard let geo = node.geometry else { return }
      for src in geo.sources where src.semantic == .vertex {
        let stride = src.dataStride
        let offset = src.dataOffset
        let count = src.vectorCount
        src.data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
          guard let base = raw.baseAddress else { return }
          for i in 0..<count {
            let p = base.advanced(by: offset + i * stride).assumingMemoryBound(to: Float.self)
            pts.append(SIMD3<Float>(p[0], p[1], p[2]))
          }
        }
      }
    }
    return pts
  }
}
