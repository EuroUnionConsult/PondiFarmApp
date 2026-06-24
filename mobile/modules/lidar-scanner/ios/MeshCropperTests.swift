// Rodar: cp MeshCropperTests.swift main.swift && swiftc MeshCropper.swift main.swift -o /tmp/ctest && /tmp/ctest; rm -f main.swift /tmp/ctest
import simd
import Foundation
func check(_ c: Bool, _ m: String){ if !c { print("❌ \(m)"); exit(1) }; print("✅ \(m)") }

let inv = matrix_identity_float4x4
let half = SIMD3<Float>(1,1,1)
let verts: [SIMD3<Float>] = [SIMD3(0,0,0), SIMD3(0.5,0,0), SIMD3(0,0.5,0), SIMD3(5,5,5)]
let faces: [UInt32] = [0,1,2,  0,1,3]
let (v, f) = MeshCropper.crop(vertices: verts, faces: faces, boxInverse: inv, halfExtents: half)
check(v.count == 3, "mantém só os 3 vértices dentro")
check(f.count == 3, "mantém só a face cujos 3 vértices estão dentro (1 triângulo)")
check(f == [0,1,2], "índices remapeados para a nova lista")
let (v2, f2) = MeshCropper.crop(vertices: [SIMD3(9,9,9)], faces: [], boxInverse: inv, halfExtents: half)
check(v2.isEmpty && f2.isEmpty, "fora da caixa → vazio")
print("Todos os testes passaram.")
