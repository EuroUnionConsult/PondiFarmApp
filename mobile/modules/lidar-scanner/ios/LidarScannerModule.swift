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
      Events("onScanComplete", "onScanProgress", "onBoxFit")

      // Todas na MAIN: numa View UIKit as AsyncFunction correm numa fila própria do
      // Expo, e estas mexem no estado da caixa e em entidades do RealityKit
      // (@MainActor) que o loop de render lê ao mesmo tempo (revisão do PR #112).

      AsyncFunction("startScan") { (view: LidarScannerView) in
        view.startScan()
      }.runOnQueue(.main)

      AsyncFunction("stopScan") { (view: LidarScannerView) in
        view.stopScan()
      }.runOnQueue(.main)

      AsyncFunction("setBoxScale") { (view: LidarScannerView, scale: Double) in
        view.setBoxScale(Float(scale))
      }.runOnQueue(.main)

      AsyncFunction("recenterBox") { (view: LidarScannerView) in
        view.recenterBox()
      }.runOnQueue(.main)

      AsyncFunction("rotateBox") { (view: LidarScannerView, degrees: Double) in
        view.rotateBox(Float(degrees))
      }.runOnQueue(.main)

      AsyncFunction("autoFitBox") { (view: LidarScannerView) in
        view.autoFitBox()
      }.runOnQueue(.main)

      AsyncFunction("cancelAutoFit") { (view: LidarScannerView) in
        view.cancelAutoFit()
      }.runOnQueue(.main)
    }
  }
}
