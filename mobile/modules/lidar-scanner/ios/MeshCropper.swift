import simd

/// Recorta uma malha mantendo só os vértices dentro de uma caixa orientada (OBB),
/// definida pelo inverso da sua transformação de mundo + meias-extensões.
/// Mantém uma face só se os 3 vértices estiverem dentro; remapeia índices. Função pura.
enum MeshCropper {
  static func crop(
    vertices: [SIMD3<Float>],
    faces: [UInt32],
    boxInverse: simd_float4x4,
    halfExtents: SIMD3<Float>
  ) -> (vertices: [SIMD3<Float>], faces: [UInt32]) {
    var inside = [Bool](repeating: false, count: vertices.count)
    var remap = [Int32](repeating: -1, count: vertices.count)
    var out: [SIMD3<Float>] = []
    for i in 0..<vertices.count {
      let local = boxInverse * SIMD4<Float>(vertices[i], 1)
      if abs(local.x) <= halfExtents.x && abs(local.y) <= halfExtents.y && abs(local.z) <= halfExtents.z {
        inside[i] = true
        remap[i] = Int32(out.count)
        out.append(vertices[i])
      }
    }
    var outFaces: [UInt32] = []
    var j = 0
    while j + 2 < faces.count {
      let a = Int(faces[j]), b = Int(faces[j+1]), c = Int(faces[j+2])
      if a < inside.count && b < inside.count && c < inside.count && inside[a] && inside[b] && inside[c] {
        outFaces.append(UInt32(remap[a])); outFaces.append(UInt32(remap[b])); outFaces.append(UInt32(remap[c]))
      }
      j += 3
    }
    return (out, outFaces)
  }
}
