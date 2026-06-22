import simd
import UIKit

/// Passo 4: escreve uma malha texturizada como OBJ + MTL + PNG no diretório dado.
///
/// - `vertices`: posições (mundo).
/// - `faces`: índices 0-based (triplas).
/// - `texcoords`: 1 UV por face-corner (alinhado a `faces`), origem OBJ (v de baixo p/ cima).
/// - `atlas`: RGBA8 `atlasSize`×`atlasSize` (origem topo-esquerda).
///
/// O `.obj` referencia o `.mtl` (mtllib) que referencia o `.png` (map_Kd). O
/// `MeshPreviewView` carrega isso direto (SceneKit + loadTextures).
enum TexturedObjExporter {
  enum ExportError: Error { case pngEncodingFailed }

  @discardableResult
  static func write(
    directory: URL,
    baseName: String,
    vertices: [SIMD3<Float>],
    faces: [UInt32],
    texcoords: [SIMD2<Float>],
    atlas: [UInt8],
    atlasSize: Int
  ) throws -> URL {
    let objURL = directory.appendingPathComponent("\(baseName).obj")
    let mtlURL = directory.appendingPathComponent("\(baseName).mtl")
    let pngURL = directory.appendingPathComponent("\(baseName).png")

    // PNG do atlas.
    let pngData = try encodePNG(rgba: atlas, size: atlasSize)
    try pngData.write(to: pngURL)

    // MTL.
    let mtl = """
    newmtl pondimat
    Ka 1.000 1.000 1.000
    Kd 1.000 1.000 1.000
    d 1.0
    illum 1
    map_Kd \(baseName).png
    """
    try mtl.write(to: mtlURL, atomically: true, encoding: .utf8)

    // OBJ.
    let triCount = faces.count / 3
    var lines: [String] = []
    lines.reserveCapacity(vertices.count + faces.count + triCount + 4)
    lines.append("# PondiFarm textured LiDAR scan")
    lines.append("mtllib \(baseName).mtl")

    for v in vertices {
      lines.append("v \(v.x) \(v.y) \(v.z)")
    }
    for t in texcoords {
      lines.append("vt \(t.x) \(t.y)")
    }
    lines.append("usemtl pondimat")

    // Face f: v/vt. v = índice original (1-based); vt = sequencial por face-corner (1-based).
    for t in 0..<triCount {
      let v0 = faces[t * 3] + 1
      let v1 = faces[t * 3 + 1] + 1
      let v2 = faces[t * 3 + 2] + 1
      let t0 = t * 3 + 1
      let t1 = t * 3 + 2
      let t2 = t * 3 + 3
      lines.append("f \(v0)/\(t0) \(v1)/\(t1) \(v2)/\(t2)")
    }

    try lines.joined(separator: "\n").write(to: objURL, atomically: true, encoding: .utf8)
    return objURL
  }

  /// Codifica RGBA8 (alfa ignorado, tratado como opaco) em PNG.
  private static func encodePNG(rgba: [UInt8], size: Int) throws -> Data {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)
    guard
      let provider = CGDataProvider(data: Data(rgba) as CFData),
      let cgImage = CGImage(
        width: size,
        height: size,
        bitsPerComponent: 8,
        bitsPerPixel: 32,
        bytesPerRow: size * 4,
        space: colorSpace,
        bitmapInfo: bitmapInfo,
        provider: provider,
        decode: nil,
        shouldInterpolate: false,
        intent: .defaultIntent
      ),
      let png = UIImage(cgImage: cgImage).pngData()
    else {
      throw ExportError.pngEncodingFailed
    }
    return png
  }
}
