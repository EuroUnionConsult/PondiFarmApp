import ExpoModulesCore
import ARKit

public class LidarScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LidarScanner")

    // LiDAR support check with fallback — callable from JS without mounting the view.
    Function("isLidarSupported") { () -> Bool in
      return ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
    }

    // Render sob demanda: bakeia a textura (OBJ cinza + keyframes salvos → OBJ+MTL+PNG
    // texturizado). Roda fora da main (AsyncFunction), pesado mas não bloqueia a UI.
    AsyncFunction("renderTexture") { (meshUri: String, keyframesDir: String) -> [String: String] in
      guard let meshURL = URL(string: meshUri) ?? URL(fileURLWithPath: meshUri) as URL?,
            let kfURL = URL(string: keyframesDir) ?? URL(fileURLWithPath: keyframesDir) as URL? else {
        throw NSError(domain: "LidarScanner", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "URLs inválidas"])
      }
      let (vertices, faces) = KeyframeStore.parseOBJ(meshURL)
      let frames = KeyframeStore.load(kfURL)
      guard !vertices.isEmpty, !faces.isEmpty, !frames.isEmpty,
            let baked = TextureBaker.bake(vertices: vertices, faces: faces, frames: frames) else {
        throw NSError(domain: "LidarScanner", code: 2,
                      userInfo: [NSLocalizedDescriptionKey: "Sem dados suficientes para renderizar (poucos keyframes?)"])
      }
      let dir = meshURL.deletingLastPathComponent()
      let base = meshURL.deletingPathExtension().lastPathComponent + "-tex"
      let out = try TexturedObjExporter.write(
        directory: dir, baseName: base,
        vertices: vertices, faces: faces,
        texcoords: baked.texcoords, atlas: baked.atlas, atlasSize: baked.size
      )
      return ["url": out.absoluteString]
    }

    View(LidarScannerView.self) {
      Events("onScanComplete")

      AsyncFunction("startScan") { (view: LidarScannerView) in
        view.startScan()
      }

      AsyncFunction("stopScan") { (view: LidarScannerView) in
        view.stopScan()
      }

      AsyncFunction("setBoxScale") { (view: LidarScannerView, scale: Double) in
        view.setBoxScale(Float(scale))
      }

      AsyncFunction("recenterBox") { (view: LidarScannerView) in
        view.recenterBox()
      }
    }
  }
}
