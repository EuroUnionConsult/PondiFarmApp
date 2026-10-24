import ExpoModulesCore
import SceneKit
import ModelIO
import SceneKit.ModelIO

class MeshPreviewView: ExpoView {
  private let scnView = SCNView()

  /// Modos como na versão web: «photo» (cor real do scan), «clay» (só a forma) e
  /// «points» (o que o LiDAR mediu). Por defeito «clay», o comportamento de sempre.
  private var mode = "clay"
  private var dark = false
  private var meshNodes: [SCNNode] = []
  private var photoGeometries: [SCNGeometry] = []
  private var clayGeometries: [SCNGeometry] = []
  private var cloudGeometries: [SCNGeometry?] = []

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    scnView.allowsCameraControl = true
    scnView.defaultCameraController.interactionMode = .orbitTurntable
    // Transparente: o cartão em React Native dá a cor do tema (claro ou escuro).
    // Antes era cinzento-claro fixo, que no tema escuro ficava um bloco claro. O card
    // já não é preto (era isso que escondia a malha "clay" quando isto era .clear).
    scnView.backgroundColor = .clear
    // Luz é montada por nós fixos em `load()`; a default lighting não afeta clay PBR bem.
    scnView.autoenablesDefaultLighting = false
    scnView.antialiasingMode = .multisampling4X
    addSubview(scnView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    scnView.frame = bounds
  }

  func setMode(_ value: String) {
    mode = value
    applyMode()
  }

  func setDark(_ value: Bool) {
    dark = value
    applyMode()
  }

  /// Troca materiais/visibilidade sem voltar a carregar o ficheiro.
  private func applyMode() {
    let clay = SCNMaterial()
    clay.lightingModel = .physicallyBased
    clay.diffuse.contents = UIColor(white: dark ? 0.70 : 0.80, alpha: 1)
    clay.roughness.contents = 0.55
    clay.metalness.contents = 0.0
    clay.isDoubleSided = true
    // Verde claro no fundo escuro; no claro, um verde vivo e opaco (#16A34A), como na web.
    let dot = dark ? UIColor(red: 0.35, green: 0.84, blue: 0.55, alpha: 1)
                   : UIColor(red: 0.086, green: 0.639, blue: 0.290, alpha: 1)
    // Tudo no PRÓPRIO nó da malha (troca-se a geometria): um nó novo acrescentado à cena
    // não era desenhado. A cor por vértice multiplica o material, por isso o «clay» usa
    // uma cópia sem cor e o «LiDAR» a nuvem de pontos.
    for (i, node) in meshNodes.enumerated() {
      switch mode {
      case "photo":
        node.geometry = photoGeometries[i]
      case "points":
        if let cloud = cloudGeometries[i] {
          cloud.firstMaterial?.diffuse.contents = UIColor.black
          cloud.firstMaterial?.emission.contents = dot
          node.geometry = cloud
        }
      default:
        node.geometry = clayGeometries[i]
        clayGeometries[i].materials = [clay]
      }
    }
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
      let (center, radius, sideAlongX) = MeshPreviewView.framingBounds(scene)

      let camNode = SCNNode()
      let cam = SCNCamera()
      cam.fieldOfView = 45
      cam.automaticallyAdjustsZRange = true
      camNode.camera = cam
      let dist = radius / tan(Float(22.5 * .pi / 180)) * 1.15
      // Vista lateral ligeiramente de cima, de frente para o lado COMPRIDO do animal: se o
      // corpo está ao longo de Z, olhar de +Z mostrava-o de frente (uma tira fina).
      camNode.position = sideAlongX
        ? SCNVector3(center.x, center.y + radius * 0.4, center.z + dist)
        : SCNVector3(center.x + dist, center.y + radius * 0.4, center.z)
      camNode.look(at: SCNVector3(center))
      scene.rootNode.addChildNode(camNode)

      // Nós com malha: guarda os materiais «photo» e prepara a nuvem de pontos.
      var meshes: [SCNNode] = []
      scene.rootNode.enumerateChildNodes { node, _ in
        if node.geometry != nil { meshes.append(node) }
      }
      var clays: [SCNGeometry] = []
      var clouds: [SCNGeometry?] = []
      for node in meshes {
        guard let geo = node.geometry else { continue }
        let noColor = geo.sources.filter { $0.semantic != .color }
        clays.append(SCNGeometry(sources: noColor, elements: geo.elements))
        clouds.append(MeshPreviewView.pointCloud(of: geo))
      }

      DispatchQueue.main.async {
        guard let self else { return }
        self.meshNodes = meshes
        self.photoGeometries = meshes.compactMap { $0.geometry }
        self.clayGeometries = clays
        self.cloudGeometries = clouds
        self.applyMode()
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

  /// Os vértices da malha como nuvem de pontos (modo «LiDAR»). Cada ponto é um
  /// octaedro minúsculo: a primitiva `.point` do SceneKit não desenhava nada (ecrã
  /// branco), e triângulos funcionam em qualquer aparelho. Amostra até 20 000 pontos.
  private static func pointCloud(of geo: SCNGeometry) -> SCNGeometry? {
    let all = vertexPositions(of: geo)
    guard !all.isEmpty else { return nil }
    let step = max(1, all.count / 20_000)
    let pts = stride(from: 0, to: all.count, by: step).map { all[$0] }
    var lo = pts[0], hi = pts[0]
    for p in pts { lo = simd_min(lo, p); hi = simd_max(hi, p) }
    // ~2–3 px no cartão (a malha tem metros; /260 dava menos de 1 px e não se via).
    let r = max(simd_length(hi - lo) / 2, 0.05) / 110
    let dirs: [SIMD3<Float>] = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]]
    let faces: [Int32] = [0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5]
    var verts: [SCNVector3] = []
    var idx: [Int32] = []
    verts.reserveCapacity(pts.count * 6)
    idx.reserveCapacity(pts.count * 24)
    for (k, p) in pts.enumerated() {
      for d in dirs { let q = p + d; verts.append(SCNVector3(q.x, q.y, q.z)) }
      let base = Int32(k * 6)
      for f in faces { idx.append(base + f) }
    }
    let el = SCNGeometryElement(indices: idx, primitiveType: .triangles)
    let g = SCNGeometry(sources: [SCNGeometrySource(vertices: verts)], elements: [el])
    let m = SCNMaterial()
    m.lightingModel = .constant
    m.isDoubleSided = true
    g.materials = [m]
    return g
  }

  /// Reconstrói a cena a partir do MDLAsset: material PBR duplo-face, com normais geradas
  /// (o PLY do scanner não traz normais; sem elas qualquer material iluminado renderiza
  /// preto). Se o PLY tiver cor por vértice (os da nuvem têm), o material fica branco e a
  /// cor do scan aparece no modo «photo»; sem cor, fica cinza claro.
  private static func clayScene(from url: URL) -> SCNScene? {
    let asset = MDLAsset(url: url)
    let scene = SCNScene()
    var added = false

    for case let mesh as MDLMesh in asset.childObjects(of: MDLMesh.self) {
      if mesh.vertexAttributeData(forAttributeNamed: MDLVertexAttributeNormal, as: .float3) == nil {
        mesh.addNormals(withAttributeNamed: MDLVertexAttributeNormal, creaseThreshold: 0.8)
      }
      let geometry = SCNGeometry(mdlMesh: mesh)
      let hasColor = !geometry.sources(for: .color).isEmpty
      for m in geometry.materials {
        m.lightingModel = .physicallyBased
        m.diffuse.contents = hasColor ? UIColor.white : UIColor(white: 0.80, alpha: 1)
        m.roughness.contents = hasColor ? 0.85 : 0.55
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
  private static func framingBounds(_ scene: SCNScene) -> (center: SIMD3<Float>, radius: Float, sideAlongX: Bool) {
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
      return (center, max(diag / 2, 0.05), (xhi - xlo) >= (zhi - zlo))
    }
    let (minV, maxV) = scene.rootNode.boundingBox
    let center = SIMD3<Float>((minV.x + maxV.x) / 2, (minV.y + maxV.y) / 2, (minV.z + maxV.z) / 2)
    let diag = simd_length(SIMD3<Float>(maxV.x - minV.x, maxV.y - minV.y, maxV.z - minV.z))
    return (center, max(diag / 2, 0.05), (maxV.x - minV.x) >= (maxV.z - minV.z))
  }

  /// Posições de vértice de UMA geometria.
  private static func vertexPositions(of geo: SCNGeometry) -> [SIMD3<Float>] {
    var pts: [SIMD3<Float>] = []
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
    return pts
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
