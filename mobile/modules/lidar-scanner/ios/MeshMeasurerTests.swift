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
check(abs(m.rumpWidth    - 2) < 0.05, "largura ≈ L")
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
check(degen.bodyLength == 0 && degen.withersHeight == 0 && degen.thoracicDepth == 0 && degen.rumpWidth == 0 && degen.chestGirth == 0, "entrada degenerada → zeros")

print("Todos os testes passaram.")
