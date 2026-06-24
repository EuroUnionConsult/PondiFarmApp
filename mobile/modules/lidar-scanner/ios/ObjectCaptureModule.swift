import ExpoModulesCore
import RealityKit
import SwiftUI   // expõe ObjectCaptureSession (vive no overlay _RealityKit_SwiftUI)
import ModelIO

/// Módulo "ObjectCapture" — Studio mode (fotogrametria guiada da Apple → USDZ texturizado).
/// Ver `ObjectCaptureExpoView` e `ObjectCaptureCoordinator`.
public class ObjectCaptureModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ObjectCapture")

    // Suporte: iOS 17+ e device com hardware compatível (LiDAR + A14+).
    AsyncFunction("isSupported") { () -> Bool in
      if #available(iOS 17.0, *) {
        return await MainActor.run { ObjectCaptureSession.isSupported }
      }
      return false
    }

    // Dimensões reais (metros) do modelo via bounding box do ModelIO. O USDZ do
    // Object Capture vem em escala métrica, então isto valida a medição (ex.: o "carro
    // = 1,25 m" do Polycam). Retorna largura×altura×profundidade.
    AsyncFunction("measureBounds") { (urlString: String) -> [String: Double] in
      guard let url = URL(string: urlString) ?? URL(fileURLWithPath: urlString) as URL? else {
        throw NSError(domain: "ObjectCapture", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "URL inválida"])
      }
      let asset = MDLAsset(url: url)
      let box = asset.boundingBox
      let width = Double(box.maxBounds.x - box.minBounds.x)
      let height = Double(box.maxBounds.y - box.minBounds.y)
      let depth = Double(box.maxBounds.z - box.minBounds.z)
      return ["width": width, "height": height, "depth": depth]
    }

    View(ObjectCaptureExpoView.self) {
      Events("onStateChange", "onProgress", "onComplete", "onError")

      Prop("detail") { (view: ObjectCaptureExpoView, detail: String) in
        view.detailLevel = detail
      }

      AsyncFunction("cancel") { (view: ObjectCaptureExpoView) in
        view.cancelCapture()
      }
    }
  }
}
