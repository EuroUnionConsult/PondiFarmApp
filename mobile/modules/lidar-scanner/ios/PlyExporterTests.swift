// Teste standalone (sem ARKit).
// Rodar com swiftc (a execução do top-level exige o arquivo de entrada nomeado main.swift):
//   cp PlyExporterTests.swift main.swift && swiftc PlyExporter.swift main.swift -o /tmp/ply && /tmp/ply && rm -f main.swift /tmp/ply
// Nota: `swift PlyExporter.swift PlyExporterTests.swift` (modo interpretador) NÃO executa
// o top-level em compilação multi-arquivo — daria exit 0 falso sem rodar os asserts.
import simd
import Foundation

func check(_ cond: Bool, _ msg: String) {
  if !cond { print("❌ FAIL: \(msg)"); exit(1) }
  print("✅ \(msg)")
}

let verts: [SIMD3<Float>] = [SIMD3(0, 0, 0), SIMD3(1, 0, 0), SIMD3(0, 1, 0)]
let faces: [UInt32] = [0, 1, 2]
// Vermelho puro, verde puro, azul puro.
let colors: [SIMD3<Float>] = [SIMD3(1, 0, 0), SIMD3(0, 1, 0), SIMD3(0, 0, 1)]
let ply = PlyExporter.plyString(vertices: verts, faces: faces, colors: colors)
let lines = ply.split(separator: "\n").map(String.init)

check(lines.first == "ply", "primeira linha é 'ply'")
check(ply.contains("format ascii 1.0"), "header tem 'format ascii 1.0'")
check(ply.contains("element vertex 3"), "header tem 'element vertex 3'")
check(ply.contains("element face 1"), "header tem 'element face 1'")
check(ply.contains("property uchar red"), "header declara property uchar red")
check(ply.contains("property list uchar int vertex_indices"), "header declara lista de faces")
check(ply.contains("end_header"), "header termina com end_header")

// Linha do primeiro vértice (vermelho puro) deve terminar em '255 0 0'.
check(lines.contains("0.0 0.0 0.0 255 0 0"), "vértice 0 vermelho puro = 255 0 0")
check(lines.contains("1.0 0.0 0.0 0 255 0"), "vértice 1 verde puro = 0 255 0")
check(lines.contains("0.0 1.0 0.0 0 0 255"), "vértice 2 azul puro = 0 0 255")

// Face: '3 0 1 2' (0-based, prefixado pela contagem).
check(lines.contains("3 0 1 2"), "face '3 0 1 2'")

// Clamp: valores fora de 0–1 não devem estourar.
let clamped = PlyExporter.plyString(
  vertices: [SIMD3(0, 0, 0)],
  faces: [],
  colors: [SIMD3(1.5, -0.2, 0.5)]
)
check(clamped.contains("0.0 0.0 0.0 255 0 128"), "clamp: 1.5→255, -0.2→0, 0.5→128")

print("Todos os testes passaram.")
