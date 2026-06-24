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
    let withersHeight = ys.max()! - ys.min()!

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
    let thoracicDepth: Float = section.isEmpty ? 0
      : (section.map { $0.y }.max()! - section.map { $0.y }.min()!)
    let chestGirth = convexHullPerimeter(section)

    return BodyMeasurements(bodyLength: bodyLength, withersHeight: withersHeight,
                            thoracicDepth: thoracicDepth, rumpWidth: rumpWidth, chestGirth: chestGirth)
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
