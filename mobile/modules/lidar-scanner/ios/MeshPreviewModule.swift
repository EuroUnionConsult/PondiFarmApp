import ExpoModulesCore

public class MeshPreviewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MeshPreview")

    View(MeshPreviewView.self) {
      Prop("source") { (view: MeshPreviewView, uri: String) in
        view.load(uri)
      }
      Prop("mode") { (view: MeshPreviewView, mode: String) in
        view.setMode(mode)
      }
      Prop("dark") { (view: MeshPreviewView, dark: Bool) in
        view.setDark(dark)
      }
    }
  }
}
