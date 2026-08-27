// Teste standalone (sem ARKit). Rodar:
//   cp MeshMeasurerTests.swift main.swift && swiftc MeshMeasurer.swift main.swift -o /tmp/mtest && /tmp/mtest; rm -f main.swift /tmp/mtest
import simd
import Foundation

func check(_ cond: Bool, _ msg: String) {
  if !cond { print("❌ FAIL: \(msg)"); exit(1) }
  print("✅ \(msg)")
}

// Cubo sólido de lado L=2 amostrado em grade (passo 0.2) → 11x11x11 pontos.
let L: Float = 2.0
var cube: [SIMD3<Float>] = []
var x: Float = 0
while x <= L + 1e-4 {
  var y: Float = 0
  while y <= L + 1e-4 {
    var z: Float = 0
    while z <= L + 1e-4 { cube.append(SIMD3<Float>(x, y, z)); z += 0.2 }
    y += 0.2
  }
  x += 0.2
}

let m = MeshMeasurer.measure(cube)
check(abs(m.withersHeight - 2) < 0.05, "altura (cernelha) ≈ L")
check(abs(m.bodyLength   - 2) < 0.05, "comprimento ≈ L")
check(abs(m.maxBodyWidth - 2) < 0.05, "largura máxima ≈ L")
check(abs(m.thoracicDepth - 2) < 0.05, "profundidade torácica ≈ L")
check(abs(m.chestGirth   - 8) < 0.2,  "perímetro torácico ≈ 4L")

// --- solo: a altura tem de vir do plano do chão, não do vértice mais baixo ---

// 1) Um único ponto espúrio 3 m abaixo. Com ys.min() a altura dava 5 m.
var comRuido = cube
comRuido.append(SIMD3<Float>(1, -3, 1))
let mr = MeshMeasurer.measure(comRuido)
check(abs(mr.withersHeight - 2) < 0.15, "ponto espúrio 3 m abaixo não infla a altura (deu \(mr.withersHeight))")

// 2) Cubo pousado sobre uma laje de chão densa e ligeiramente irregular.
//    O chão está em y≈0; o cubo vai de 0 a 2. A altura correta continua a ser 2.
var comChao = cube
var fx: Float = -1
while fx <= 3 {
  var fz: Float = -1
  while fz <= 3 {
    comChao.append(SIMD3<Float>(fx, Float((Int(fx*10) % 3)) * 0.004, fz))
    fz += 0.1
  }
  fx += 0.1
}
let mc = MeshMeasurer.measure(comChao)
check(abs(mc.withersHeight - 2) < 0.15, "laje de chão densa não desloca a altura (deu \(mc.withersHeight))")

// 3) O solo é o quartil inferior, não uma parede vertical densa mais acima.
var comParede = cube
var wy: Float = 0
while wy <= 2 { comParede.append(SIMD3<Float>(-0.5, wy, -0.5)); wy += 0.002 }
let g = MeshMeasurer.groundLevel(comParede.map { $0.y })
check(g < 0.35, "parede vertical densa não é tomada pelo chão (solo em \(g))")

// 4) Percentil básico
let vs: [Float] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
check(MeshMeasurer.percentile(vs, 0) == 1 && MeshMeasurer.percentile(vs, 1) == 10, "percentis nos extremos")

let degen = MeshMeasurer.measure([SIMD3<Float>(0,0,0)])
check(degen.bodyLength == 0 && degen.withersHeight == 0 && degen.thoracicDepth == 0
        && degen.maxBodyWidth == 0 && degen.chestGirth == 0 && degen.chestWidth == 0
        && degen.rumpWidth == 0 && degen.tailHeight == 0,
      "entrada degenerada → zeros")

// ─── 5) Descritores anatómicos alinhados com a base Limousine ───────────────
// Animal sintético em cunha: estreito à frente (0,30 m no pescoço) e largo
// atrás (1,00 m na garupa). A assimetria é o que torna a orientação detectável
// e é também o que expõe erros de orientação — num cubo tudo passa.
func cunha(_ rotacaoGraus: Float) -> [SIMD3<Float>] {
  var pts: [SIMD3<Float>] = []
  var l: Float = 0
  while l <= 2.0 + 1e-4 {
    let t = l / 2.0
    let meiaLargura = 0.15 + 0.35 * t
    let altura: Float = 1.2 + 0.2 * t
    var w = -meiaLargura
    while w <= meiaLargura + 1e-4 {
      var h: Float = 0
      while h <= altura + 1e-4 { pts.append(SIMD3<Float>(l, h, w)); h += 0.05 }
      w += 0.05
    }
    l += 0.05
  }
  let a = rotacaoGraus * .pi / 180, c = cos(a), sn = sin(a)
  return pts.map { SIMD3<Float>($0.x * c - $0.z * sn, $0.y, $0.x * sn + $0.z * c) }
}

// Larguras esperadas nas fatias: 2*(0,15 + 0,35*fracção).
let larguraEsperadaPeito: Float = 2 * (0.15 + 0.35 * 0.33)   // ≈ 0,531 m
let larguraEsperadaGarupa: Float = 2 * (0.15 + 0.35 * 0.85)  // ≈ 0,895 m

for rot in [Float(0), 45, 90, 120, 135, 180, 225, 270, 315] {
  let mm = MeshMeasurer.measure(cunha(rot))
  check(abs(mm.chestWidth - larguraEsperadaPeito) < 0.03,
        "largura do peito estável a \(rot)° (deu \(mm.chestWidth))")
  check(abs(mm.rumpWidth - larguraEsperadaGarupa) < 0.03,
        "largura da garupa estável a \(rot)° (deu \(mm.rumpWidth))")
  check(mm.rumpWidth > mm.chestWidth,
        "garupa mais larga do que o peito a \(rot)°")
  check(abs(mm.tailHeight - 1.35) < 0.05,
        "altura na base da cauda estável a \(rot)° (deu \(mm.tailHeight))")
}

// A detecção de orientação tem de acompanhar a rotação, não ficar fixa.
let orientacoes = [Float(0), 45, 90, 120, 135, 180, 225, 270, 315]
  .map { MeshMeasurer.measure(cunha($0)).headAtMinL }
check(Set(orientacoes).count == 2, "a dianteira é detectada em ambos os extremos do eixo")

// Num corpo simétrico não há informação para orientar: devolve o valor por
// omissão em vez de escolher ao acaso.
check(MeshMeasurer.measure(cube).headAtMinL, "corpo simétrico → orientação por omissão")

// ─── 6) Guarda de regressão sobre as medidas de PRODUÇÃO ────────────────────
// Estas quatro alimentam o modelo de peso embarcado. Os valores foram fixados
// com o comportamento anterior à introdução dos descritores anatómicos: se
// alguma se mexer, o peso mostrado ao utilizador mexeu-se também.
let prod = MeshMeasurer.measure(cunha(0))
check(abs(prod.bodyLength    - 2.0006533) < 1e-4, "regressão: comprimento inalterado")
check(abs(prod.chestGirth    - 3.5347977) < 1e-4, "regressão: perímetro torácico inalterado")
check(abs(prod.thoracicDepth - 1.2499999) < 1e-4, "regressão: profundidade torácica inalterada")
check(abs(prod.maxBodyWidth  - 0.9999995) < 1e-4, "regressão: largura máxima inalterada")

print("Todos os testes passaram.")
