import simd

/// Serializa uma malha colorida (vértices em coordenadas de mundo, faces como triplas
/// de índices 0-based, e cor RGB 0–1 por vértice) para o formato ASCII PLY.
/// Função pura — sem dependência de ARKit. Visível em qualquer visualizador externo
/// (MeshLab, Blender, CloudCompare) e usada também pelo viewer in-app.
enum PlyExporter {
  static func plyString(vertices: [SIMD3<Float>], faces: [UInt32], colors: [SIMD3<Float>]) -> String {
    let faceCount = faces.count / 3
    var lines: [String] = []
    lines.reserveCapacity(vertices.count + faceCount + 12)

    // Cabeçalho ASCII PLY.
    lines.append("ply")
    lines.append("format ascii 1.0")
    lines.append("comment PondiFarm LiDAR scan")
    lines.append("element vertex \(vertices.count)")
    lines.append("property float x")
    lines.append("property float y")
    lines.append("property float z")
    lines.append("property uchar red")
    lines.append("property uchar green")
    lines.append("property uchar blue")
    lines.append("element face \(faceCount)")
    lines.append("property list uchar int vertex_indices")
    lines.append("end_header")

    // Vértices: x y z r g b (cor em 0–255 uchar, com clamp).
    for (i, v) in vertices.enumerated() {
      let c = i < colors.count ? colors[i] : SIMD3<Float>(0.6, 0.6, 0.6)
      let r = uchar(c.x)
      let g = uchar(c.y)
      let b = uchar(c.z)
      lines.append("\(v.x) \(v.y) \(v.z) \(r) \(g) \(b)")
    }

    // Faces: 3 i j k.
    var i = 0
    while i + 2 < faces.count {
      lines.append("3 \(faces[i]) \(faces[i + 1]) \(faces[i + 2])")
      i += 3
    }

    return lines.joined(separator: "\n")
  }

  /// Converte um componente de cor 0–1 para uchar 0–255 com clamp.
  private static func uchar(_ f: Float) -> Int {
    let v = Int((f * 255.0).rounded())
    return min(255, max(0, v))
  }
}
