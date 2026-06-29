import simd

/// Serializa uma malha (vértices em coordenadas de mundo + faces como triplas de índices 0-based)
/// para o formato Wavefront OBJ. Função pura — sem dependência de ARKit.
enum ObjExporter {
  static func objString(vertices: [SIMD3<Float>], faces: [UInt32]) -> String {
    var lines: [String] = ["# PondiFarm LiDAR scan"]
    lines.reserveCapacity(vertices.count + faces.count / 3 + 1)
    for v in vertices {
      lines.append("v \(v.x) \(v.y) \(v.z)")
    }
    var i = 0
    while i + 2 < faces.count {
      // OBJ é 1-indexado
      lines.append("f \(faces[i] + 1) \(faces[i + 1] + 1) \(faces[i + 2] + 1)")
      i += 3
    }
    return lines.joined(separator: "\n")
  }
}
