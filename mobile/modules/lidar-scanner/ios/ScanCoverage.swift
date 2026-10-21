import simd

/// Recorte da malha ao vivo (o que se desenha por cima do animal durante o scan)
/// e estimativa de cobertura por lado. Funções puras, testadas em
/// `ScanCoverageTests.swift`. Correm FORA da main: a main só gera o MeshResource.
enum ScanCoverage {
  /// Cobertura 0–1 de cada lado, RELATIVA a quem começou o scan: `near` é o lado
  /// virado para a câmara no Start, `right`/`left` os da direita/esquerda dessa
  /// posição, `far` o oposto. Não sabemos onde está a cabeça, por isso os lados
  /// não têm nome anatómico.
  ///
  /// Conta de que ÂNGULOS à volta da caixa a câmara já captou (fatias de 15°),
  /// não as normais da malha: num corpo comprido quase toda a superfície olha para
  /// os flancos, e as pontas nunca chegavam a "completas" (medido no teste).
  struct Sides: Equatable {
    var near: Float = 0, right: Float = 0, far: Float = 0, left: Float = 0
    var points = 0
    var overall: Float { (near + right + far + left) / 4 }
  }

  struct LiveMesh {
    var positions: [SIMD3<Float>]   // mundo, levantadas ao longo da normal
    var faces: [UInt32]
    var localPoints: [SIMD3<Float>] // referencial da caixa (sem levantamento)
  }

  static let binCount = 24   // fatias de 15°: as bordas caem nas fronteiras de ±45° e ±135°
  /// A câmara só conta para a cobertura entre estas distâncias ao centro da caixa
  /// (mais longe o LiDAR já não capta o animal com detalhe).
  static let minDistance: Float = 0.3, maxDistance: Float = 4.0
  /// Levanta o overlay 6 mm ao longo da normal para não entrar em conflito de
  /// profundidade com a oclusão da própria malha da cena (cintilação).
  static let lift: Float = 0.006
  /// Teto de triângulos desenhados por atualização — protege a GPU e o tracking.
  static let maxFaces = 60_000

  /// Mantém só os triângulos com os 3 vértices dentro da caixa (como o MeshCropper)
  /// e devolve-os prontos a desenhar, mais os pontos no referencial da caixa.
  static func crop(
    vertices: [SIMD3<Float>],
    normals: [SIMD3<Float>],
    faces: [UInt32],
    boxInverse: simd_float4x4,
    halfExtents: SIMD3<Float>
  ) -> LiveMesh {
    let hasNormals = normals.count == vertices.count
    var remap = [Int32](repeating: -1, count: vertices.count)
    var out = LiveMesh(positions: [], faces: [], localPoints: [])
    for i in 0..<vertices.count {
      let l4 = boxInverse * SIMD4<Float>(vertices[i], 1)
      let local = SIMD3<Float>(l4.x, l4.y, l4.z)
      guard abs(local.x) <= halfExtents.x, abs(local.y) <= halfExtents.y,
            abs(local.z) <= halfExtents.z else { continue }
      let n = hasNormals ? normals[i] : SIMD3<Float>(0, 1, 0)
      remap[i] = Int32(out.positions.count)
      out.positions.append(vertices[i] + n * lift)
      out.localPoints.append(local)
    }
    let triCount = faces.count / 3
    let step = max(1, (triCount + maxFaces - 1) / maxFaces)
    var t = 0
    while t < triCount {
      let a = Int(faces[3 * t]), b = Int(faces[3 * t + 1]), c = Int(faces[3 * t + 2])
      if a < remap.count, b < remap.count, c < remap.count,
         remap[a] >= 0, remap[b] >= 0, remap[c] >= 0 {
        out.faces.append(UInt32(remap[a])); out.faces.append(UInt32(remap[b])); out.faces.append(UInt32(remap[c]))
      }
      t += step
    }
    return out
  }

  /// Fatia (0–23) onde está a câmara, em ângulo relativo à câmara do Start, ou nil
  /// se estiver longe/perto demais para captar.
  static func bin(cameraLocal: SIMD3<Float>, startPhi: Float) -> Int? {
    let d = simd_length(SIMD2<Float>(cameraLocal.x, cameraLocal.z))
    guard d >= minDistance, d <= maxDistance else { return nil }
    let rel = wrap(atan2(cameraLocal.x, cameraLocal.z) - startPhi)        // −π…π
    let k = Int(((rel + .pi) / (2 * .pi) * Float(binCount)).rounded(.down))
    return min(binCount - 1, max(0, k))
  }

  /// Ângulo da câmara no Start (referencial da caixa) — a origem dos nomes dos lados.
  static func startPhi(cameraLocal: SIMD3<Float>) -> Float {
    atan2(cameraLocal.x, cameraLocal.z)
  }

  static func estimate(visitedBins: Set<Int>, points: Int) -> Sides {
    var count = [0, 0, 0, 0] // near, right, far, left
    var total = [0, 0, 0, 0]
    for k in 0..<binCount {
      let center = -180 + 7.5 + 15 * Float(k)   // graus, centro da fatia (nunca em ±45/±135)
      let side: Int
      if abs(center) < 45 { side = 0 }
      else if center > 45 && center < 135 { side = 1 }
      else if center < -45 && center > -135 { side = 3 }
      else { side = 2 }
      total[side] += 1
      if visitedBins.contains(k) { count[side] += 1 }
    }
    func f(_ i: Int) -> Float { Float(count[i]) / Float(max(1, total[i])) }
    return Sides(near: f(0), right: f(1), far: f(2), left: f(3), points: points)
  }

  static func wrap(_ a: Float) -> Float {
    var x = a
    while x > .pi { x -= 2 * .pi }
    while x < -.pi { x += 2 * .pi }
    return x
  }
}
