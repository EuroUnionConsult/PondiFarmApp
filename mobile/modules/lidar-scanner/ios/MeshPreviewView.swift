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
    scnView.autoenablesDefaultLighting = true
    scnView.backgroundColor = .clear
    scnView.antialiasingMode = .multisampling2X
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

      // Centraliza e enquadra a câmera no conteúdo (bounding box do nó raiz).
      let root = scene.rootNode
      let (minV, maxV) = root.boundingBox
      let center = SCNVector3((minV.x + maxV.x) / 2, (minV.y + maxV.y) / 2, (minV.z + maxV.z) / 2)
      let camNode = SCNNode()
      camNode.camera = SCNCamera()
      let span = max(maxV.x - minV.x, max(maxV.y - minV.y, maxV.z - minV.z))
      camNode.position = SCNVector3(center.x, center.y, center.z + span * 2.2 + 0.5)
      camNode.look(at: center)
      scene.rootNode.addChildNode(camNode)

      DispatchQueue.main.async {
        self?.scnView.scene = scene
        self?.scnView.pointOfView = camNode
      }
    }
  }

  /// Carrega a cena.
  /// - Para `.ply` (EURODEV-80): carrega via ModelIO e reconstrói cada SCNGeometry
  ///   manualmente para PRESERVAR a cor por-vértice (o SceneKit ignora o atributo de
  ///   cor do MDLMesh ao usar `SCNScene(mdlAsset:)` diretamente — ficaria cinza).
  /// - Para os demais formatos: tenta SCNScene(url:) e cai para ModelIO.
  private static func loadScene(from url: URL) -> SCNScene {
    let ext = url.pathExtension.lowercased()
    if ext == "ply" {
      if let scene = coloredScene(from: url) { return scene }
    }
    // OBJ texturizado (com .mtl + .png irmãos): usar ModelIO + loadTextures() para
    // EFETIVAMENTE aplicar o map_Kd. SCNScene(url:) sozinho carrega a geometria mas
    // costuma deixar o material branco (textura não aplicada).
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

  /// Reconstrói a cena a partir de um MDLAsset garantindo um SCNGeometrySource com
  /// semântica `.color`, para que o SceneKit pinte os vértices. Se a malha não tiver
  /// atributo de cor, devolve a geometria normal (cinza pelo material padrão).
  private static func coloredScene(from url: URL) -> SCNScene? {
    let asset = MDLAsset(url: url)
    let scene = SCNScene()
    var added = false

    for case let mesh as MDLMesh in asset.childObjects(of: MDLMesh.self) {
      let geometry = SCNGeometry(mdlMesh: mesh)

      // Se já há fonte de cor, ótimo. Caso contrário, tenta extrair o atributo de cor
      // do MDLMesh e anexar como SCNGeometrySource(.color).
      let hasColor = geometry.sources.contains { $0.semantic == .color }
      if !hasColor, let colorSource = colorSource(from: mesh) {
        let sources = geometry.sources + [colorSource]
        let colored = SCNGeometry(sources: sources, elements: geometry.elements)
        // Materiais com lightingModel .constant deixam a cor do vértice aparecer fiel.
        for m in colored.materials { m.lightingModel = .constant }
        let node = SCNNode(geometry: colored)
        scene.rootNode.addChildNode(node)
      } else {
        if hasColor {
          for m in geometry.materials { m.lightingModel = .constant }
        }
        let node = SCNNode(geometry: geometry)
        scene.rootNode.addChildNode(node)
      }
      added = true
    }

    return added ? scene : nil
  }

  /// Extrai o atributo de cor (`MDLVertexAttributeColor`) de um MDLMesh, se existir,
  /// como SCNGeometrySource de 3 componentes float.
  private static func colorSource(from mesh: MDLMesh) -> SCNGeometrySource? {
    guard let attr = mesh.vertexAttributeData(
      forAttributeNamed: MDLVertexAttributeColor,
      as: .float3
    ) else { return nil }

    let count = mesh.vertexCount
    let stride = attr.stride
    let base = attr.map.bytes
    var colors = [SCNVector3]()
    colors.reserveCapacity(count)
    for i in 0..<count {
      let ptr = base.advanced(by: i * stride).assumingMemoryBound(to: Float.self)
      colors.append(SCNVector3(ptr[0], ptr[1], ptr[2]))
    }
    return SCNGeometrySource(vertices: colors).reinterpretedAsColor(count: count)
  }
}

private extension SCNGeometrySource {
  /// Reinterpreta uma fonte criada como vértices (3×float) como fonte de COR.
  /// SCNGeometrySource(vertices:) usa semântica .vertex; precisamos de .color.
  func reinterpretedAsColor(count: Int) -> SCNGeometrySource {
    SCNGeometrySource(
      data: data,
      semantic: .color,
      vectorCount: count,
      usesFloatComponents: true,
      componentsPerVector: 3,
      bytesPerComponent: MemoryLayout<Float>.size,
      dataOffset: 0,
      dataStride: MemoryLayout<SCNVector3>.stride
    )
  }
}
