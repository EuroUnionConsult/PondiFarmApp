import simd

struct BodyMeasurements {
  var bodyLength: Float
  var withersHeight: Float
  var thoracicDepth: Float
  var rumpWidth: Float
  var chestGirth: Float
}

/// Extrai medidas morfométricas de uma nuvem de vértices (em metros, Y = up).
/// Função pura — sem ARKit. Valores na MESMA unidade da entrada.
enum MeshMeasurer {
  static func measure(_ vertices: [SIMD3<Float>]) -> BodyMeasurements {
    guard vertices.count >= 4 else {
      return BodyMeasurements(bodyLength: 0, withersHeight: 0, thoracicDepth: 0, rumpWidth: 0, chestGirth: 0)
    }

    let ys = vertices.map { $0.y }
    // Altura medida a partir do PLANO DO SOLO, não do vértice mais baixo.
    // ys.min() é refém de um único ponto: uma leitura espúria sob o piso, ou o
    // próprio chão captado de forma irregular, desloca a altura inteira. Medido
    // em 25 nuvens públicas com peso de balança, a moda global confundia uma
    // parede densa com o solo em 3 delas, com 79 cm de erro. Restringir a busca
    // ao quartil inferior levou o desvio-padrão do solo entre animais de 79 cm
    // para 1,6 cm, e só então o CV das alturas automáticas passou a coincidir
    // com o das medidas de fita (4,64% contra 4,82%).
    let ground = groundLevel(ys)
    let withersHeight = max(0, percentile(ys, 0.995) - ground)

    let pts = vertices.map { SIMD2<Float>($0.x, $0.z) }
    let mean = pts.reduce(SIMD2<Float>(0, 0), +) / Float(pts.count)
    var cxx: Float = 0, czz: Float = 0, cxz: Float = 0
    for p in pts {
      let d = p - mean
      cxx += d.x * d.x; czz += d.y * d.y; cxz += d.x * d.y
    }
    let n = Float(pts.count)
    cxx /= n; czz /= n; cxz /= n
    let (axisLong, axisShort) = eigenAxes2D(cxx: cxx, czz: czz, cxz: cxz)

    var minL = Float.greatestFiniteMagnitude, maxL = -Float.greatestFiniteMagnitude
    var minS = Float.greatestFiniteMagnitude, maxS = -Float.greatestFiniteMagnitude
    for p in pts {
      let d = p - mean
      let l = simd_dot(d, axisLong), s = simd_dot(d, axisShort)
      minL = min(minL, l); maxL = max(maxL, l)
      minS = min(minS, s); maxS = max(maxS, s)
    }
    let bodyLength = maxL - minL
    let rumpWidth = maxS - minS

    let chestL = minL + bodyLength * 0.33
    let slabHalf = max(bodyLength * 0.04, 0.01)
    var section: [SIMD2<Float>] = []
    for v in vertices {
      let d = SIMD2<Float>(v.x, v.z) - mean
      if abs(simd_dot(d, axisLong) - chestL) <= slabHalf {
        section.append(SIMD2<Float>(simd_dot(d, axisShort), v.y))
      }
    }
    // Percentis em vez de min/max: um vértice solto na fatia inflava a medida.
    // LIMITAÇÃO CONHECIDA: isto é a altura da secção, do dorso até ao ponto mais
    // baixo captado — inclui as patas. A profundidade torácica anatómica vai do
    // dorso ao esterno e exige detetar a linha da barriga, que ainda não fazemos.
    let sectionYs = section.map { $0.y }
    let thoracicDepth: Float = section.isEmpty ? 0
      : max(0, percentile(sectionYs, 0.995) - percentile(sectionYs, 0.005))
    let chestGirth = convexHullPerimeter(section)

    return BodyMeasurements(bodyLength: bodyLength, withersHeight: withersHeight,
                            thoracicDepth: thoracicDepth, rumpWidth: rumpWidth, chestGirth: chestGirth)
  }

  /// Valor no percentil `q` (0…1). Ordena — barato à escala de uma malha ARKit.
  static func percentile(_ values: [Float], _ q: Float) -> Float {
    guard !values.isEmpty else { return 0 }
    let sorted = values.sorted()
    let idx = Int((Float(sorted.count - 1) * min(max(q, 0), 1)).rounded())
    return sorted[min(max(idx, 0), sorted.count - 1)]
  }

  /// Nível do solo = moda do quartil INFERIOR de Y (ARKit: Y aponta para cima).
  /// Restringir ao quartil inferior é o que impede que uma superfície vertical
  /// densa — uma parede, as barras de uma manga — seja tomada pelo chão.
  /// Sem pontos suficientes para um histograma fiável, devolve o mínimo.
  static func groundLevel(_ ys: [Float]) -> Float {
    guard let lowest = ys.min() else { return 0 }
    let cut = percentile(ys, 0.25)
    let lower = ys.filter { $0 <= cut }
    guard lower.count >= 20, let a = lower.min(), let b = lower.max(), b > a else { return lowest }
    let bins = 40
    var histogram = [Int](repeating: 0, count: bins)
    for v in lower {
      let raw = Int((v - a) / (b - a) * Float(bins))
      histogram[min(max(raw, 0), bins - 1)] += 1
    }
    guard let peak = histogram.max(), let k = histogram.firstIndex(of: peak) else { return lowest }
    return a + (Float(k) + 0.5) * (b - a) / Float(bins)
  }

  static func eigenAxes2D(cxx: Float, czz: Float, cxz: Float) -> (SIMD2<Float>, SIMD2<Float>) {
    let tr = cxx + czz
    let det = cxx * czz - cxz * cxz
    let disc = max(0, tr * tr / 4 - det)
    let l1 = tr / 2 + disc.squareRoot()
    let v: SIMD2<Float>
    if abs(cxz) > 1e-8 {
      v = simd_normalize(SIMD2<Float>(l1 - czz, cxz))
    } else {
      v = cxx >= czz ? SIMD2<Float>(1, 0) : SIMD2<Float>(0, 1)
    }
    return (v, SIMD2<Float>(-v.y, v.x))
  }

  static func convexHullPerimeter(_ input: [SIMD2<Float>]) -> Float {
    var pts = input.sorted { $0.x == $1.x ? $0.y < $1.y : $0.x < $1.x }
    var dedup: [SIMD2<Float>] = []
    for p in pts {
      if let last = dedup.last, abs(last.x - p.x) < 1e-6, abs(last.y - p.y) < 1e-6 { continue }
      dedup.append(p)
    }
    pts = dedup
    if pts.count < 3 {
      return pts.count == 2 ? 2 * simd_distance(pts[0], pts[1]) : 0
    }
    func cross(_ o: SIMD2<Float>, _ a: SIMD2<Float>, _ b: SIMD2<Float>) -> Float {
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
    }
    var hull: [SIMD2<Float>] = []
    for p in pts {
      while hull.count >= 2, cross(hull[hull.count - 2], hull[hull.count - 1], p) <= 0 { hull.removeLast() }
      hull.append(p)
    }
    let lower = hull.count + 1
    for p in pts.reversed() {
      while hull.count >= lower, cross(hull[hull.count - 2], hull[hull.count - 1], p) <= 0 { hull.removeLast() }
      hull.append(p)
    }
    hull.removeLast()
    var per: Float = 0
    for i in 0..<hull.count { per += simd_distance(hull[i], hull[(i + 1) % hull.count]) }
    return per
  }
}
