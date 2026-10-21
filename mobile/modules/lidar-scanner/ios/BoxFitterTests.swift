// Teste standalone (sem ARKit). Rodar:
//   cp BoxFitterTests.swift main.swift && swiftc BoxFitter.swift main.swift -o /tmp/btest && /tmp/btest; rm -f main.swift /tmp/btest
import simd
import Foundation

func check(_ cond: Bool, _ msg: String) {
  if !cond { print("❌ FAIL: \(msg)"); exit(1) }
  print("✅ \(msg)")
}

// Vaca sintética: corpo elipsoidal (comprimento 2,0 m, largura 0,6 m, altura do
// corpo 0,7 m centrado a 1,0 m) + 4 patas de 0,7 m. Rodada por `yaw` e posta em (cx, cz).
func cow(yaw: Float, cx: Float, cz: Float, floor: Float = 0) -> [SIMD3<Float>] {
  var local: [SIMD3<Float>] = []
  let a: Float = 1.0, b: Float = 0.30, c: Float = 0.35   // semi-eixos z, x, y
  var u: Float = 0
  while u < 2 * .pi {
    var v: Float = -.pi / 2
    while v <= .pi / 2 {
      local.append(SIMD3(b * cos(v) * cos(u), 1.0 + c * sin(v), a * cos(v) * sin(u)))
      v += 0.04
    }
    u += 0.02
  }
  for (lx, lz) in [(-0.18, -0.7), (0.18, -0.7), (-0.18, 0.7), (0.18, 0.7)] as [(Float, Float)] {
    var h: Float = 0.02
    while h < 0.72 {
      var t: Float = 0
      while t < 2 * .pi { local.append(SIMD3(lx + 0.07 * cos(t), h, lz + 0.07 * sin(t))); t += 0.5 }
      h += 0.03
    }
  }
  let s = sin(yaw), co = cos(yaw)
  // +Z local → (sin yaw, cos yaw); +X local → (cos yaw, −sin yaw)
  return local.map { p in
    SIMD3(cx + p.x * co + p.z * s, floor + p.y, cz - p.x * s + p.z * co)
  }
}

func floorGrid(_ y: Float = 0) -> [SIMD3<Float>] {
  var g: [SIMD3<Float>] = []
  var x: Float = -3
  while x <= 3 { var z: Float = -3; while z <= 3 { g.append(SIMD3(x, y, z)); z += 0.05 }; x += 0.05 }
  return g
}

func angleDiffMod180(_ a: Float, _ b: Float) -> Float {
  var d = (a - b).truncatingRemainder(dividingBy: .pi)
  if d < 0 { d += .pi }
  return min(d, .pi - d)
}

// Esperado (com margem de 10 cm por lado e no topo).
let expW: Float = 0.6 + 0.2, expH: Float = 1.35 + 0.1, expL: Float = 2.0 + 0.2

// 1) Invariância à rotação: a caixa segue o eixo longo do animal.
for deg in [0, 30, 60, 90, 135, 170] as [Float] {
  let yaw = deg * .pi / 180
  let pts = cow(yaw: yaw, cx: 0.4, cz: -0.3) + floorGrid()
  guard case .success(let f) = BoxFitter.fit(points: pts, floorY: 0, searchCenter: SIMD2(0, 0)) else {
    check(false, "ajuste falhou a \(deg)°"); continue
  }
  check(angleDiffMod180(f.yaw, yaw) < 5 * .pi / 180, "yaw a \(deg)° (deu \(f.yaw * 180 / .pi)°)")
  check(abs(f.size.x - expW) < 0.12 && abs(f.size.y - expH) < 0.12 && abs(f.size.z - expL) < 0.15,
        "tamanho a \(deg)° (deu \(f.size))")
  check(simd_distance(SIMD2(f.baseCenter.x, f.baseCenter.z), SIMD2(0.4, -0.3)) < 0.1 && abs(f.baseCenter.y) < 0.01,
        "centro da base a \(deg)°")
}

// 2) Sem chão do ARKit: estima-o (chão a 0,3 m) e mede a mesma altura.
do {
  let pts = cow(yaw: 0.5, cx: 0, cz: 0, floor: 0.3) + floorGrid(0.3)
  if case .success(let f) = BoxFitter.fit(points: pts, floorY: nil, searchCenter: SIMD2(0, 0)) {
    check(abs(f.baseCenter.y - 0.3) < 0.03, "chão estimado ≈ 0,30 m (deu \(f.baseCenter.y))")
    check(abs(f.size.y - expH) < 0.12, "altura com chão estimado (deu \(f.size.y))")
  } else { check(false, "ajuste com chão estimado falhou") }
}

// 3) Outro objeto a 1,5 m (balde, poste): não se junta ao animal.
do {
  var post: [SIMD3<Float>] = []
  var h: Float = 0.1
  while h < 1.2 { var t: Float = 0; while t < 2 * .pi { post.append(SIMD3(1.6 + 0.1 * cos(t), h, 0.1 * sin(t))); t += 0.3 }; h += 0.03 }
  let pts = cow(yaw: 0, cx: 0, cz: 0) + post + floorGrid()
  if case .success(let f) = BoxFitter.fit(points: pts, floorY: 0, searchCenter: SIMD2(0, 0)) {
    check(abs(f.size.x - expW) < 0.12, "objeto vizinho ignorado (largura \(f.size.x))")
  } else { check(false, "ajuste com objeto vizinho falhou") }
}

// 4) Animal encostado a uma vedação de 6 m: o bloco junta os dois → RECUSA
// (o utilizador ajusta à mão). Nota: a caixa pelos percentis até sai parecida com
// a da vaca, mas o recorte levaria a vedação colada ao flanco.
do {
  var fence: [SIMD3<Float>] = []
  var z: Float = -3
  while z <= 3 { var h: Float = 0.1; while h < 1.3 { fence.append(SIMD3(0.32, h, z)); h += 0.04 }; z += 0.03 }
  let pts = cow(yaw: 0, cx: 0, cz: 0) + fence + floorGrid()
  if case .failure(let e) = BoxFitter.fit(points: pts, floorY: 0, searchCenter: SIMD2(0, 0)) {
    check(e == .touchingStructure, "encostado à vedação → touchingStructure (\(e))")
  } else { check(false, "encostado à vedação devia recusar") }
}

// 5) Só chão / nada: recusa sem inventar caixa.
if case .failure(let e) = BoxFitter.fit(points: floorGrid(), floorY: 0, searchCenter: SIMD2(0, 0)) {
  check(e == .nothingAboveFloor, "só chão → nothingAboveFloor")
} else { check(false, "só chão devia recusar") }
if case .failure(let e) = BoxFitter.fit(points: [], floorY: 0, searchCenter: SIMD2(0, 0)) {
  check(e == .notEnoughPoints, "sem pontos → notEnoughPoints")
} else { check(false, "sem pontos devia recusar") }

// 6) Animal fora do raio de pesquisa: não o vai buscar.
if case .failure = BoxFitter.fit(points: cow(yaw: 0, cx: 5, cz: 5) + floorGrid(), floorY: 0, searchCenter: SIMD2(0, 0)) {
  check(true, "animal fora do raio → recusa")
} else { check(false, "animal fora do raio devia recusar") }

// 7) Um animal de 3,8 m (ou dois animais lado a lado): grande demais → recusa.
do {
  let big = cow(yaw: 0, cx: 0, cz: -0.95) + cow(yaw: 0, cx: 0, cz: 0.95) + floorGrid()
  if case .failure(let e) = BoxFitter.fit(points: big, floorY: 0, searchCenter: SIMD2(0, 0)) {
    check(e == .tooLarge, "dois animais em fila → tooLarge (\(e))")
  } else { check(false, "dois animais em fila deviam recusar") }
}

print("Todos os testes passaram.")
