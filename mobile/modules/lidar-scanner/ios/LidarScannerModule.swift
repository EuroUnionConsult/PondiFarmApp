import ExpoModulesCore
import ARKit

public class LidarScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LidarScanner")

    // LiDAR support check with fallback — callable from JS without mounting the view.
    Function("isLidarSupported") { () -> Bool in
      return ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
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
