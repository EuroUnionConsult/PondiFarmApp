import ExpoModulesCore

public class MeshPreviewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MeshPreview")

    View(MeshPreviewView.self) {
      Prop("source") { (view: MeshPreviewView, uri: String) in
        view.load(uri)
      }
    }
  }
}
