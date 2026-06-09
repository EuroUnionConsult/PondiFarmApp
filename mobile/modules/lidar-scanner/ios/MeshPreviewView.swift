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

  /// Carrega a cena. Tenta SCNScene(url:options:) primeiro; se falhar (ex.: `.obj`
  /// que o SceneKit não importa diretamente), recorre ao ModelIO via MDLAsset.
  private static func loadScene(from url: URL) -> SCNScene {
    if let scene = try? SCNScene(url: url, options: [.preserveOriginalTopology: true]) {
      return scene
    }
    let asset = MDLAsset(url: url)
    asset.loadTextures()
    return SCNScene(mdlAsset: asset)
  }
}
