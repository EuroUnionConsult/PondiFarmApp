import simd
import UIKit

/// Persiste/recarrega os keyframes do scan (pro "Render" sob demanda no Result) e
/// faz o parse do OBJ cinza de volta para vértices/faces. Mantém o bake desacoplado
/// da captura: o scan salva a malha + keyframes; o render roda depois.
enum KeyframeStore {
  private struct Meta: Codable {
    let width: Int
    let height: Int
    let projView: [Float]  // 16 (column-major)
    let camPos: [Float]    // 3
  }

  // MARK: Salvar

  static func save(_ frames: [TextureBaker.Frame], to dir: URL) {
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    var metas: [Meta] = []
    for (i, f) in frames.enumerated() {
      if let jpg = jpeg(fromRGBA: f.rgba, width: f.width, height: f.height) {
        try? jpg.write(to: dir.appendingPathComponent("f\(i).jpg"))
      }
      var pv: [Float] = []
      pv.reserveCapacity(16)
      for c in 0..<4 { let col = f.projView[c]; pv += [col.x, col.y, col.z, col.w] }
      metas.append(Meta(width: f.width, height: f.height, projView: pv,
                        camPos: [f.camPos.x, f.camPos.y, f.camPos.z]))
    }
    if let data = try? JSONEncoder().encode(metas) {
      try? data.write(to: dir.appendingPathComponent("meta.json"))
    }
  }

  // MARK: Carregar

  static func load(_ dir: URL) -> [TextureBaker.Frame] {
    guard
      let data = try? Data(contentsOf: dir.appendingPathComponent("meta.json")),
      let metas = try? JSONDecoder().decode([Meta].self, from: data)
    else { return [] }

    var frames: [TextureBaker.Frame] = []
    for (i, m) in metas.enumerated() where m.projView.count == 16 {
      let url = dir.appendingPathComponent("f\(i).jpg")
      guard let rgba = rgba(fromJPEG: url, width: m.width, height: m.height) else { continue }
      let p = m.projView
      let projView = simd_float4x4(
        SIMD4<Float>(p[0], p[1], p[2], p[3]),
        SIMD4<Float>(p[4], p[5], p[6], p[7]),
        SIMD4<Float>(p[8], p[9], p[10], p[11]),
        SIMD4<Float>(p[12], p[13], p[14], p[15])
      )
      let camPos = SIMD3<Float>(m.camPos[0], m.camPos[1], m.camPos[2])
      frames.append(TextureBaker.Frame(rgba: rgba, width: m.width, height: m.height,
                                       projView: projView, camPos: camPos))
    }
    return frames
  }

  // MARK: Parse de OBJ (v / f) → vértices, faces 0-based

  static func parseOBJ(_ url: URL) -> (vertices: [SIMD3<Float>], faces: [UInt32]) {
    var vertices: [SIMD3<Float>] = []
    var faces: [UInt32] = []
    guard let text = try? String(contentsOf: url, encoding: .utf8) else { return ([], []) }
    text.enumerateLines { line, _ in
      if line.hasPrefix("v ") {
        let p = line.split(separator: " ")
        if p.count >= 4, let x = Float(p[1]), let y = Float(p[2]), let z = Float(p[3]) {
          vertices.append(SIMD3<Float>(x, y, z))
        }
      } else if line.hasPrefix("f ") {
        let p = line.split(separator: " ")
        if p.count >= 4 {
          // "f a b c" ou "f a/t a/t a/t" → pega o índice antes da '/', 1-based → 0-based
          var idx: [UInt32] = []
          for tok in p[1...] {
            let v = tok.split(separator: "/").first.flatMap { Int($0) }
            if let v, v >= 1 { idx.append(UInt32(v - 1)) }
          }
          if idx.count >= 3 { faces += [idx[0], idx[1], idx[2]] }
        }
      }
    }
    return (vertices, faces)
  }

  // MARK: Helpers de imagem

  private static func jpeg(fromRGBA rgba: [UInt8], width: Int, height: Int) -> Data? {
    let cs = CGColorSpaceCreateDeviceRGB()
    let info = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)
    guard
      let provider = CGDataProvider(data: Data(rgba) as CFData),
      let cg = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
                       bytesPerRow: width * 4, space: cs, bitmapInfo: info, provider: provider,
                       decode: nil, shouldInterpolate: false, intent: .defaultIntent)
    else { return nil }
    return UIImage(cgImage: cg).jpegData(compressionQuality: 0.85)
  }

  private static func rgba(fromJPEG url: URL, width: Int, height: Int) -> [UInt8]? {
    guard let img = UIImage(contentsOfFile: url.path), let cg = img.cgImage else { return nil }
    var buf = [UInt8](repeating: 0, count: width * height * 4)
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: &buf, width: width, height: height, bitsPerComponent: 8,
                              bytesPerRow: width * 4, space: cs,
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
    return buf
  }
}
