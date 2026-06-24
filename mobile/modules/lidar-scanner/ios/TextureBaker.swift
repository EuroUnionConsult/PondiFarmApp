import simd

/// Bake de textura por projeção (Passo 3 do pipeline de textura UV).
///
/// Estratégia v1 — **atlas por-triângulo**: cada triângulo recebe uma célula quadrada
/// no atlas; escolhemos o melhor keyframe (mais de frente + dentro do frustum) e
/// projetamos cada texel da célula naquele keyframe pra amostrar a cor. Sem unwrap de
/// UV (determinístico, sem dependência externa). Limitações conhecidas (a iterar):
/// sem oclusão, sem blending entre vistas (seams visíveis entre células).
enum TextureBaker {
  /// Um keyframe capturado durante o scan: imagem RGBA já reduzida + matriz
  /// proj×view (mundo→clip) + posição da câmera no mundo.
  struct Frame {
    let rgba: [UInt8]   // RGBA8, linha-major, topo primeiro
    let width: Int
    let height: Int
    let projView: simd_float4x4
    let camPos: SIMD3<Float>
  }

  struct Result {
    let texcoords: [SIMD2<Float>]  // 1 por face-corner (alinhado a faces); origem OBJ (v de baixo p/ cima)
    let atlas: [UInt8]             // RGBA8 size×size
    let size: Int
  }

  static func bake(
    vertices: [SIMD3<Float>],
    faces: [UInt32],
    frames: [Frame],
    size: Int = 2048
  ) -> Result? {
    let triCount = faces.count / 3
    guard triCount > 0, !frames.isEmpty else { return nil }

    let cells = max(1, Int(ceil(Double(triCount).squareRoot())))
    let cellPx = size / cells
    guard cellPx >= 3 else { return nil }  // triângulos demais p/ esse atlas
    let inset = 1

    var atlas = [UInt8](repeating: 0, count: size * size * 4)
    var texcoords = [SIMD2<Float>](repeating: .zero, count: faces.count)

    for t in 0..<triCount {
      let i0 = Int(faces[t * 3]), i1 = Int(faces[t * 3 + 1]), i2 = Int(faces[t * 3 + 2])
      guard i0 < vertices.count, i1 < vertices.count, i2 < vertices.count else { continue }
      let a = vertices[i0], b = vertices[i1], c = vertices[i2]
      let centroid = (a + b + c) / 3

      var normal = simd_cross(b - a, c - a)
      let nlen = simd_length(normal)
      if nlen > 0 { normal /= nlen }

      // Melhor keyframe: maior alinhamento normal·(câmera−centroide), com os 3
      // vértices dentro do frustum.
      var best = -1
      var bestScore: Float = 0.05
      for (fi, f) in frames.enumerated() {
        let dir = f.camPos - centroid
        let dlen = simd_length(dir)
        if dlen <= 0 { continue }
        let score = simd_dot(normal, dir / dlen)
        if score <= bestScore { continue }
        if project(a, f) == nil || project(b, f) == nil || project(c, f) == nil { continue }
        best = fi
        bestScore = score
      }

      // Retângulo da célula no atlas.
      let cx = (t % cells) * cellPx
      let cy = (t / cells) * cellPx

      // UVs dos 3 cantos (com inset). OBJ usa v de baixo p/ cima → 1 − atlasV.
      let u0 = Float(cx + inset) / Float(size)
      let u1 = Float(cx + cellPx - inset) / Float(size)
      let av0 = Float(cy + inset) / Float(size)
      let av1 = Float(cy + cellPx - inset) / Float(size)
      texcoords[t * 3]     = SIMD2(u0, 1 - av0)  // A
      texcoords[t * 3 + 1] = SIMD2(u1, 1 - av0)  // B
      texcoords[t * 3 + 2] = SIMD2(u0, 1 - av1)  // C

      guard best >= 0 else {
        fillCell(&atlas, size: size, cx: cx, cy: cy, cellPx: cellPx, rgb: (150, 150, 150))
        continue
      }
      let f = frames[best]

      // Bake: itera os texels do triângulo-canto da célula (lu+lv ≤ 1).
      for py in cy..<(cy + cellPx) {
        for px in cx..<(cx + cellPx) {
          let lu = (Float(px) - Float(cx)) / Float(cellPx)
          let lv = (Float(py) - Float(cy)) / Float(cellPx)
          if lu + lv > 1 { continue }
          let world = a + lu * (b - a) + lv * (c - a)
          guard let (sx, sy) = project(world, f) else { continue }
          let so = (sy * f.width + sx) * 4
          let ao = (py * size + px) * 4
          guard so + 2 < f.rgba.count else { continue }
          atlas[ao] = f.rgba[so]
          atlas[ao + 1] = f.rgba[so + 1]
          atlas[ao + 2] = f.rgba[so + 2]
          atlas[ao + 3] = 255
        }
      }
    }

    return Result(texcoords: texcoords, atlas: atlas, size: size)
  }

  /// Projeta ponto-mundo → pixel do keyframe via proj×view. nil se fora do frustum/imagem.
  private static func project(_ w: SIMD3<Float>, _ f: Frame) -> (Int, Int)? {
    let clip = f.projView * SIMD4<Float>(w.x, w.y, w.z, 1)
    if clip.w <= 0 { return nil }
    let ndcx = clip.x / clip.w
    let ndcy = clip.y / clip.w
    if ndcx < -1 || ndcx > 1 || ndcy < -1 || ndcy > 1 { return nil }
    let px = Int((ndcx * 0.5 + 0.5) * Float(f.width))
    let py = Int((1 - (ndcy * 0.5 + 0.5)) * Float(f.height))
    if px < 0 || py < 0 || px >= f.width || py >= f.height { return nil }
    return (px, py)
  }

  private static func fillCell(
    _ atlas: inout [UInt8], size: Int, cx: Int, cy: Int, cellPx: Int,
    rgb: (UInt8, UInt8, UInt8)
  ) {
    for py in cy..<min(cy + cellPx, size) {
      for px in cx..<min(cx + cellPx, size) {
        let o = (py * size + px) * 4
        atlas[o] = rgb.0; atlas[o + 1] = rgb.1; atlas[o + 2] = rgb.2; atlas[o + 3] = 255
      }
    }
  }
}
