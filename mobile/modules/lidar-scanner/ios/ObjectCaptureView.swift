import ExpoModulesCore
import SwiftUI
import RealityKit
import Combine

// MARK: - Expo view (disponível em qualquer iOS; o trabalho de iOS 17 vive no coordinator)

/// View Expo do "Studio mode" (Object Capture da Apple): captura guiada por fotogrametria
/// → reconstrução on-device via PhotogrammetrySession → USDZ texturizado.
///
/// Equivalente ao "capturar + renderizar" do Polycam, mas 100% nativo Apple.
/// Object Capture exige iOS 17+ e device com LiDAR (ex.: iPhone 12 Pro+). Em versões
/// anteriores a view emite `onError` com `code = "unsupported"`.
///
/// Nome evita colisão com `RealityKit.ObjectCaptureView` (a view SwiftUI da Apple).
final class ObjectCaptureExpoView: ExpoView {
  // Eventos para o JS (nomes batem com Events(...) no módulo).
  let onStateChange = EventDispatcher()
  let onProgress = EventDispatcher()
  let onComplete = EventDispatcher()
  let onError = EventDispatcher()

  private var hostingController: UIViewController?
  private var coordinatorBox: AnyObject?  // ObjectCaptureCoordinator quando iOS 17+

  /// Nível de detalhe da reconstrução; setável via prop antes do mount.
  var detailLevel: String = "reduced"

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black

    if #available(iOS 17.0, *) {
      setupObjectCapture()
    } else {
      DispatchQueue.main.async { [weak self] in
        self?.onError(["code": "unsupported", "message": "Object Capture requer iOS 17+."])
      }
    }
  }

  @available(iOS 17.0, *)
  private func setupObjectCapture() {
    let coordinator = ObjectCaptureCoordinator(
      detail: detailLevel,
      onState: { [weak self] state in self?.onStateChange(["state": state]) },
      onProgress: { [weak self] fraction in self?.onProgress(["progress": fraction]) },
      onComplete: { [weak self] url in
        self?.onComplete(["url": url.absoluteString, "path": url.path])
      },
      onError: { [weak self] code, message in
        self?.onError(["code": code, "message": message])
      }
    )
    coordinatorBox = coordinator

    let host = UIHostingController(rootView: ObjectCaptureContainerView(coordinator: coordinator))
    host.view.backgroundColor = .clear
    addSubview(host.view)
    hostingController = host
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.frame = bounds
  }

  // MARK: Controles chamados do JS

  func cancelCapture() {
    if #available(iOS 17.0, *) {
      let c = coordinatorBox as? ObjectCaptureCoordinator
      Task { @MainActor in c?.cancel() }
    }
  }
}

// MARK: - Coordinator (iOS 17+): dono da sessão + reconstrução

@available(iOS 17.0, *)
@MainActor
final class ObjectCaptureCoordinator: ObservableObject {
  @Published private(set) var session: ObjectCaptureSession?
  /// Fase exposta à UI: initializing | ready | detecting | capturing | finishing | reconstructing | done | error
  @Published private(set) var phase: String = "initializing"

  private let imagesDirectory: URL
  private let modelURL: URL
  private let detail: PhotogrammetrySession.Request.Detail

  private let onState: (String) -> Void
  private let onProgress: (Double) -> Void
  private let onComplete: (URL) -> Void
  private let onError: (String, String) -> Void

  init(
    detail detailString: String,
    onState: @escaping (String) -> Void,
    onProgress: @escaping (Double) -> Void,
    onComplete: @escaping (URL) -> Void,
    onError: @escaping (String, String) -> Void
  ) {
    self.onState = onState
    self.onProgress = onProgress
    self.onComplete = onComplete
    self.onError = onError
    self.detail = ObjectCaptureCoordinator.detail(from: detailString)

    // Diretórios de trabalho: imagens em temp, modelo final em Documents (persistente).
    let work = FileManager.default.temporaryDirectory
      .appendingPathComponent("ObjectCapture-\(UUID().uuidString)", isDirectory: true)
    self.imagesDirectory = work.appendingPathComponent("Images", isDirectory: true)
    let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    self.modelURL = docs.appendingPathComponent("pondiscan-\(Int(Date().timeIntervalSince1970)).usdz")

    do {
      try FileManager.default.createDirectory(at: imagesDirectory, withIntermediateDirectories: true)
    } catch {
      emitError("io", "Não consegui criar a pasta de imagens: \(error.localizedDescription)")
      return
    }

    guard ObjectCaptureSession.isSupported else {
      emitError("unsupported", "Este device não suporta Object Capture (precisa de LiDAR + A14+).")
      return
    }

    let session = ObjectCaptureSession()
    self.session = session
    session.start(imagesDirectory: imagesDirectory)
    observeState(session)
  }

  // MARK: Observação de estado

  private func observeState(_ session: ObjectCaptureSession) {
    // Semeia o estado atual: stateUpdates só emite MUDANÇAS, e a transição
    // initializing→ready pode ocorrer antes do for-await assinar (race) — sem
    // semear, a UI/JS ficariam presos em "initializing".
    handle(session.state)
    Task { [weak self] in
      for await state in session.stateUpdates {
        guard let self else { return }
        await self.handle(state)
      }
    }
  }

  private func handle(_ state: ObjectCaptureSession.CaptureState) {
    switch state {
    case .initializing: setPhase("initializing")
    case .ready: setPhase("ready")
    case .detecting: setPhase("detecting")
    case .capturing: setPhase("capturing")
    case .finishing: setPhase("finishing")
    case .completed:
      // Captura terminou; a pasta de imagens está pronta para reconstrução.
      setPhase("reconstructing")
      reconstruct()
    case .failed(let error):
      emitError("capture", error.localizedDescription)
    @unknown default:
      break
    }
  }

  // MARK: Controles (UI / JS)

  func startDetecting() {
    guard let session else { return }
    if session.state == .ready { _ = session.startDetecting() }
  }

  func startCapturing() {
    guard let session else { return }
    if session.state == .detecting { session.startCapturing() }
  }

  func finishCapture() {
    session?.finish()
  }

  func cancel() {
    session?.cancel()
  }

  var userCompletedScanPass: Bool {
    session?.userCompletedScanPass ?? false
  }

  // MARK: Reconstrução (o "renderizar" do Polycam) — PhotogrammetrySession on-device

  private func reconstruct() {
    let imagesDirectory = self.imagesDirectory
    let modelURL = self.modelURL
    let detail = self.detail

    Task.detached(priority: .userInitiated) { [weak self] in
      do {
        let photogrammetry = try PhotogrammetrySession(input: imagesDirectory)
        let request = PhotogrammetrySession.Request.modelFile(url: modelURL, detail: detail)
        try photogrammetry.process(requests: [request])

        for try await output in photogrammetry.outputs {
          switch output {
          case .requestProgress(_, let fraction):
            await self?.emitProgress(fraction)
          case .requestComplete(_, let result):
            if case .modelFile(let url) = result {
              await self?.emitComplete(url)
            }
          case .requestError(_, let error):
            await self?.emitError("reconstruct", error.localizedDescription)
          case .processingComplete:
            return
          case .invalidSample, .skippedSample, .automaticDownsampling,
               .processingCancelled, .inputComplete:
            break
          @unknown default:
            break
          }
        }
      } catch {
        await self?.emitError("reconstruct", error.localizedDescription)
      }
    }
  }

  // MARK: Emissores (sempre no main actor)

  private func setPhase(_ value: String) {
    phase = value
    onState(value)
  }

  private func emitProgress(_ fraction: Double) {
    onProgress(fraction)
  }

  private func emitComplete(_ url: URL) {
    phase = "done"
    onComplete(url)
  }

  private func emitError(_ code: String, _ message: String) {
    phase = "error"
    onError(code, message)
  }

  // No iOS, PhotogrammetrySession.Request.Detail expõe APENAS `.reduced`
  // (medium/full/preview/raw são macOS-only). O parâmetro fica para compat futura.
  private static func detail(from string: String) -> PhotogrammetrySession.Request.Detail {
    return .reduced
  }
}

// MARK: - SwiftUI: ObjectCaptureView da Apple + overlay mínimo de controles

@available(iOS 17.0, *)
private struct ObjectCaptureContainerView: View {
  @ObservedObject var coordinator: ObjectCaptureCoordinator

  var body: some View {
    ZStack {
      if let session = coordinator.session {
        RealityKit.ObjectCaptureView(session: session)
          .ignoresSafeArea()

        VStack {
          Spacer()
          controls(for: session)
            .padding(.bottom, 28)
            .padding(.horizontal, 20)
        }
      } else {
        Color.black.ignoresSafeArea()
        ProgressView().tint(.white)
      }
    }
  }

  // Dirige a UI direto pelo session.state (@Observable → SwiftUI re-renderiza),
  // não pelo coordinator.phase, para não depender da entrega do stateUpdates.
  @ViewBuilder
  private func controls(for session: ObjectCaptureSession) -> some View {
    switch session.state {
    case .ready:
      VStack(spacing: 10) {
        hint("Aponte para a superfície com o objeto (mesa/chão) e mova devagar para detectar o plano")
        primaryButton("Continuar") { _ = session.startDetecting() }
      }
    case .detecting:
      VStack(spacing: 10) {
        hint("Ajuste a caixa ao redor do objeto")
        primaryButton("Iniciar captura") { session.startCapturing() }
      }
    case .capturing:
      VStack(spacing: 10) {
        hint(session.userCompletedScanPass
             ? "Volta completa! Pode finalizar."
             : "Dê a volta no objeto, devagar…")
        primaryButton("Finalizar") { session.finish() }
      }
    case .finishing:
      labelBox("Salvando captura…")
    case .completed:
      labelBox("Renderizando modelo 3D…")
    default:
      EmptyView()
    }
  }

  private func primaryButton(_ title: String, _ action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(title)
        .font(.headline)
        .foregroundColor(.black)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Color.white)
        .clipShape(Capsule())
    }
  }

  private func hint(_ text: String) -> some View {
    Text(text)
      .font(.subheadline)
      .foregroundColor(.white)
      .padding(.horizontal, 14).padding(.vertical, 8)
      .background(.black.opacity(0.5))
      .clipShape(Capsule())
  }

  private func labelBox(_ text: String) -> some View {
    HStack(spacing: 10) {
      ProgressView().tint(.white)
      Text(text).font(.headline).foregroundColor(.white)
    }
    .padding(.horizontal, 18).padding(.vertical, 14)
    .background(.black.opacity(0.6))
    .clipShape(Capsule())
  }
}
