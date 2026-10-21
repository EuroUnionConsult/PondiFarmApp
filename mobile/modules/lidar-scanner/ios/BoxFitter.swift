import simd

/// Encaixa a caixa de enquadramento no animal a partir da malha do LiDAR, só com
/// geometria (sem IA): tira o chão, junta o que sobra numa grelha 2D vista de cima,
/// fica com o maior bloco perto do centro de pesquisa e mede-o por PCA.
///
/// LIMITAÇÃO CONHECIDA (medida em 20/08/2026 nos scans de junho): com o animal
/// encostado à manga, a malha passa do flanco para as barras sem interrupção e o
/// bloco junta os dois. Aqui isso aparece como um bloco grande demais, e o ajuste
/// é RECUSADO (`.tooLarge`) em vez de devolver uma caixa errada — o utilizador
/// ajusta à mão. Uma caixa errada recortava o animal e estragava as medidas.
/// Função pura, testada em `BoxFitterTests.swift`.
enum BoxFitter {
  struct Fit: Equatable {
    /// Centro da base da caixa (no chão), em coordenadas de mundo.
    var baseCenter: SIMD3<Float>
    /// Rotação em torno de Y. O eixo local +Z da caixa (comprimento) aponta para
    /// (sin yaw, 0, cos yaw) — a mesma convenção de `placeBoxInFront`.
    var yaw: Float
    /// Largura (x), altura (y), comprimento (z), já com margem, em metros.
    var size: SIMD3<Float>
  }

  enum Failure: String, Error {
    case notEnoughPoints, nothingAboveFloor, tooSmall, tooLarge, touchingStructure
  }

  static let cell: Float = 0.05          // grelha de 5 cm vista de cima
  static let floorClearance: Float = 0.08 // ignora 8 cm acima do chão (ruído do piso)
  static let margin: Float = 0.10         // folga em cada lado / no topo
  // Limites plausíveis para um bovino (sem margem). Fora deles: recusar.
  static let minLength: Float = 0.6, maxLength: Float = 3.4
  static let minWidth: Float = 0.25, maxWidth: Float = 1.6
  static let minHeight: Float = 0.4, maxHeight: Float = 2.2

  /// - Parameters:
  ///   - points: vértices de mundo (pode incluir chão, paredes, manga).
  ///   - floorY: altura do chão conhecida (raycast do ARKit), ou nil para estimar.
  ///   - searchCenter: X/Z por onde procurar o animal (centro atual da caixa).
  ///   - searchRadius: raio da pesquisa em X/Z.
  static func fit(
    points: [SIMD3<Float>],
    floorY: Float?,
    searchCenter: SIMD2<Float>,
    searchRadius: Float = 2.2
  ) -> Result<Fit, Failure> {
    let r2 = searchRadius * searchRadius
    let near = points.filter {
      let dx = $0.x - searchCenter.x, dz = $0.z - searchCenter.y
      return dx * dx + dz * dz <= r2
    }
    guard near.count >= 200 else { return .failure(.notEnoughPoints) }
    let floorH = floorY ?? estimateFloor(near)

    let above = near.filter { $0.y > floorH + floorClearance && $0.y < floorH + 2.6 }
    guard above.count >= 150 else { return .failure(.nothingAboveFloor) }

    // Grelha de ocupação vista de cima.
    var cells: [SIMD2<Int32>: [Int]] = [:]
    for (i, p) in above.enumerated() {
      cells[key(p), default: []].append(i)
    }

    // Componentes ligados (vizinhança de 8). Escolhe o bloco que melhor combina
    // tamanho e proximidade ao centro: o maior entre os que tocam a zona central.
    var seen = Set<SIMD2<Int32>>()
    var best: [SIMD2<Int32>] = []
    var bestScore: Float = -1
    let centerKey = SIMD2<Int32>(Int32((searchCenter.x / cell).rounded(.down)),
                                 Int32((searchCenter.y / cell).rounded(.down)))
    for start in cells.keys where !seen.contains(start) {
      var comp: [SIMD2<Int32>] = []
      var stack = [start]
      seen.insert(start)
      while let c = stack.popLast() {
        comp.append(c)
        for dx in -1...1 { for dz in -1...1 where dx != 0 || dz != 0 {
          let n = SIMD2<Int32>(c.x + Int32(dx), c.y + Int32(dz))
          if cells[n] != nil && !seen.contains(n) { seen.insert(n); stack.append(n) }
        } }
      }
      // Distância (em células) da célula do bloco mais próxima do centro.
      var dmin = Float.greatestFiniteMagnitude
      for c in comp {
        let d = simd_length(SIMD2<Float>(Float(c.x - centerKey.x), Float(c.y - centerKey.y)))
        dmin = min(dmin, d)
      }
      let proximity: Float = dmin * cell <= 0.8 ? 1.0 : 0.15
      let score = Float(comp.count) * proximity
      if score > bestScore { bestScore = score; best = comp }
    }

    var pts: [SIMD3<Float>] = []
    for c in best { for i in cells[c] ?? [] { pts.append(above[i]) } }
    guard pts.count >= 100, best.count >= 20 else { return .failure(.tooSmall) }

    // PCA em X/Z → eixo longo.
    var mean = SIMD2<Float>(0, 0)
    for p in pts { mean += SIMD2(p.x, p.z) }
    mean /= Float(pts.count)
    var sxx: Float = 0, sxz: Float = 0, szz: Float = 0
    for p in pts {
      let dx = p.x - mean.x, dz = p.z - mean.y
      sxx += dx * dx; sxz += dx * dz; szz += dz * dz
    }
    let theta = 0.5 * atan2(2 * sxz, sxx - szz)          // ângulo do eixo maior a partir de +X
    let major = SIMD2<Float>(cos(theta), sin(theta))       // (x, z)
    let minor = SIMD2<Float>(-major.y, major.x)

    // Extensões robustas (percentis 2–98) para ignorar pontas soltas de malha.
    let along = pts.map { simd_dot(SIMD2($0.x, $0.z) - mean, major) }.sorted()
    let across = pts.map { simd_dot(SIMD2($0.x, $0.z) - mean, minor) }.sorted()
    let heights = pts.map { $0.y - floorH }.sorted()
    let (a0, a1) = (percentile(along, 0.02), percentile(along, 0.98))
    let (c0, c1) = (percentile(across, 0.02), percentile(across, 0.98))
    let length = a1 - a0, width = c1 - c0, height = percentile(heights, 0.98)

    // O bloco estende-se muito para lá do corpo (percentis) → está ligado a uma
    // estrutura comprida: vedação, manga, parede. A caixa até podia parecer certa
    // (o animal domina os percentis), mas o recorte apanharia a estrutura colada
    // ao flanco — o defeito medido nos scans de junho. Recusa e pede ajuste manual.
    let rawLength = (along.last ?? 0) - (along.first ?? 0)
    let rawWidth = (across.last ?? 0) - (across.first ?? 0)
    if rawLength - length > 0.8 || rawWidth - width > 0.6 { return .failure(.touchingStructure) }
    if length > maxLength || width > maxWidth || height > maxHeight { return .failure(.tooLarge) }
    if length < minLength || width < minWidth || height < minHeight { return .failure(.tooSmall) }

    let mid = mean + major * ((a0 + a1) / 2) + minor * ((c0 + c1) / 2)
    return .success(Fit(
      baseCenter: SIMD3<Float>(mid.x, floorH, mid.y),
      yaw: atan2(major.x, major.y),   // +Z local = (sin yaw, cos yaw) = major
      size: SIMD3<Float>(width + 2 * margin, height + margin, length + 2 * margin)
    ))
  }

  /// Chão = moda da altura no quartil inferior (bins de 2 cm). É o método que levou
  /// o erro do solo de 79 cm para 1,6 cm nas nuvens públicas (extrator.py, 21/08).
  static func estimateFloor(_ pts: [SIMD3<Float>]) -> Float {
    let ys = pts.map { $0.y }.sorted()
    let q = Array(ys.prefix(max(1, ys.count / 4)))
    var bins: [Int32: Int] = [:]
    for y in q { bins[Int32((y / 0.02).rounded(.down)), default: 0] += 1 }
    let top = bins.max { $0.value < $1.value }?.key ?? 0
    return (Float(top) + 0.5) * 0.02
  }

  private static func key(_ p: SIMD3<Float>) -> SIMD2<Int32> {
    SIMD2<Int32>(Int32((p.x / cell).rounded(.down)), Int32((p.z / cell).rounded(.down)))
  }

  private static func percentile(_ sorted: [Float], _ q: Float) -> Float {
    guard !sorted.isEmpty else { return 0 }
    let i = min(sorted.count - 1, max(0, Int((Float(sorted.count - 1) * q).rounded())))
    return sorted[i]
  }
}
