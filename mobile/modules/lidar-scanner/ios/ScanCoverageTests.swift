// Teste standalone (sem ARKit). Rodar:
//   cp ScanCoverageTests.swift main.swift && swiftc ScanCoverage.swift main.swift -o /tmp/stest && /tmp/stest; rm -f main.swift /tmp/stest
import simd
import Foundation

func check(_ cond: Bool, _ msg: String) {
  if !cond { print("❌ FAIL: \(msg)"); exit(1) }
  print("✅ \(msg)")
}

// Câmara a dar a volta à caixa (referencial da caixa), a 2 m do centro.
func camAt(_ deg: Float) -> SIMD3<Float> {
  let r = deg * .pi / 180
  return SIMD3<Float>(2 * sin(r), 1.2, 2 * cos(r))
}
let start = camAt(0)
let phi0 = ScanCoverage.startPhi(cameraLocal: start)

// 1) Volta completa → os 4 lados a 100%.
var all = Set<Int>()
var d: Float = 0
while d < 360 { if let k = ScanCoverage.bin(cameraLocal: camAt(d), startPhi: phi0) { all.insert(k) }; d += 2 }
let full = ScanCoverage.estimate(visitedBins: all, points: 1000)
check(full.near == 1 && full.right == 1 && full.far == 1 && full.left == 1, "volta completa → 4 lados a 100%")
check(full.overall == 1, "volta completa → total 100%")

// 2) Parado no Start (±20°) → só near, e só em parte.
var front = Set<Int>()
d = -20
while d <= 20 { if let k = ScanCoverage.bin(cameraLocal: camAt(d), startPhi: phi0) { front.insert(k) }; d += 1 }
let fr = ScanCoverage.estimate(visitedBins: front, points: 10)
check(fr.near > 0.3 && fr.near < 0.7 && fr.right == 0 && fr.far == 0 && fr.left == 0, "parado no Start → só near parcial (\(fr.near))")

// 3) Lados relativos a quem começou: andar para +90° (a direita de quem olha
// para a caixa) enche `right`; começar noutro sítio roda os nomes junto.
var toRight = Set<Int>()
d = 50
while d <= 130 { if let k = ScanCoverage.bin(cameraLocal: camAt(d), startPhi: phi0) { toRight.insert(k) }; d += 1 }
let rr = ScanCoverage.estimate(visitedBins: toRight, points: 10)
check(rr.right == 1 && rr.left == 0 && rr.near == 0 && rr.far == 0, "50–130° → right a 100%")
let phi90 = ScanCoverage.startPhi(cameraLocal: camAt(90))
var same = Set<Int>()
d = 50
while d <= 130 { if let k = ScanCoverage.bin(cameraLocal: camAt(d), startPhi: phi90) { same.insert(k) }; d += 1 }
check(ScanCoverage.estimate(visitedBins: same, points: 10).near == 1, "Start em 90°: os mesmos ângulos passam a near")

// 3b) Longe ou perto demais não conta.
check(ScanCoverage.bin(cameraLocal: SIMD3(0, 1, 6), startPhi: phi0) == nil, "câmara a 6 m não conta")
check(ScanCoverage.bin(cameraLocal: SIMD3(0.1, 1, 0.1), startPhi: phi0) == nil, "câmara dentro da caixa não conta")

// 4) Recorte ao vivo: mantém o que está dentro, levanta ao longo da normal, remapeia faces.
let verts: [SIMD3<Float>] = [SIMD3(0, 0, 0), SIMD3(0.1, 0, 0), SIMD3(0, 0.1, 0), SIMD3(5, 5, 5)]
let norms: [SIMD3<Float>] = [SIMD3(0, 1, 0), SIMD3(0, 1, 0), SIMD3(0, 1, 0), SIMD3(0, 1, 0)]
let live = ScanCoverage.crop(vertices: verts, normals: norms, faces: [0, 1, 2, 0, 1, 3],
                             boxInverse: matrix_identity_float4x4, halfExtents: SIMD3(1, 1, 1))
check(live.positions.count == 3 && live.faces == [0, 1, 2], "recorte: 3 vértices e 1 triângulo")
check(abs(live.positions[0].y - ScanCoverage.lift) < 1e-6, "recorte: overlay levantado \(ScanCoverage.lift) m ao longo da normal")
check(live.localPoints[0] == SIMD3(0, 0, 0), "recorte: pontos locais sem o levantamento (medem a malha real)")

// 5) Caixa rodada: o recorte usa o referencial da caixa.
var t = simd_float4x4(simd_quatf(angle: .pi / 2, axis: SIMD3(0, 1, 0)))
t.columns.3 = SIMD4(2, 0, 0, 1)
let rot = ScanCoverage.crop(vertices: [SIMD3(2, 0, 0.9), SIMD3(2.9, 0, 0)], normals: [SIMD3(0, 1, 0), SIMD3(0, 1, 0)],
                            faces: [], boxInverse: simd_inverse(t), halfExtents: SIMD3(1, 1, 0.5))
check(rot.positions.count == 1, "caixa rodada 90°: só o ponto dentro do comprimento rodado")

// 6) Teto de triângulos: muitas faces → desenha no máximo maxFaces.
var many: [UInt32] = []
for _ in 0..<(ScanCoverage.maxFaces * 2 + 10) { many += [0, 1, 2] }
let capped = ScanCoverage.crop(vertices: Array(verts.prefix(3)), normals: Array(norms.prefix(3)), faces: many,
                               boxInverse: matrix_identity_float4x4, halfExtents: SIMD3(1, 1, 1))
check(capped.faces.count / 3 <= ScanCoverage.maxFaces, "teto: \(capped.faces.count / 3) ≤ \(ScanCoverage.maxFaces) triângulos")

// 7) Nada captado → tudo a zero.
check(ScanCoverage.estimate(visitedBins: [], points: 0) == ScanCoverage.Sides(), "sem ângulos → cobertura zero")

print("Todos os testes passaram.")
