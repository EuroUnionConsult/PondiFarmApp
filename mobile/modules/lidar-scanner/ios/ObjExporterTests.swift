// Teste standalone (sem ARKit).
// Rodar com swiftc (a execução do top-level exige o arquivo de entrada nomeado main.swift):
//   cp ObjExporterTests.swift main.swift && swiftc ObjExporter.swift main.swift -o /tmp/objtest && /tmp/objtest && rm -f main.swift /tmp/objtest
// Nota: `swift ObjExporter.swift ObjExporterTests.swift` (modo interpretador) NÃO executa
// o top-level em compilação multi-arquivo — daria exit 0 falso sem rodar os asserts.
import simd
import Foundation

func check(_ cond: Bool, _ msg: String) {
  if !cond { print("❌ FAIL: \(msg)"); exit(1) }
  print("✅ \(msg)")
}

let verts: [SIMD3<Float>] = [SIMD3(0,0,0), SIMD3(1,0,0), SIMD3(0,1,0)]
let faces: [UInt32] = [0, 1, 2]
let obj = ObjExporter.objString(vertices: verts, faces: faces)

check(obj.contains("v 0.0 0.0 0.0"), "primeiro vértice")
check(obj.contains("v 1.0 0.0 0.0"), "segundo vértice")
check(obj.contains("f 1 2 3"), "face 1-indexada")
check(!obj.contains("f 0"), "índices nunca começam em 0 (OBJ é 1-based)")
print("Todos os testes passaram.")
