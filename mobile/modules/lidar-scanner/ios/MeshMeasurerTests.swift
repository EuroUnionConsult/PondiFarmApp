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

let degen = MeshMeasurer.measure([SIMD3<Float>(0,0,0)])
check(degen.bodyLength == 0 && degen.withersHeight == 0 && degen.thoracicDepth == 0 && degen.rumpWidth == 0 && degen.chestGirth == 0, "entrada degenerada → zeros")

print("Todos os testes passaram.")
