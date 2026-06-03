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

  // Stubs — filled in Phase 2 (EURODEV-75).
  func startScan() { /* EURODEV-75 */ }
  func stopScan() { /* EURODEV-75 */ }
}
