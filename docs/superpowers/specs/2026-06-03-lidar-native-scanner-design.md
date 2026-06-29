# Design — Scanner LiDAR nativo no PondiFarmApp

- **Data:** 2026-06-03
- **Autoria:** Talys Cordeiro (Tcordeiro)
- **Repo:** github.com/EuroUnionConsult/PondiFarmApp
- **Alvo de demo:** reunião 22/06/2026 (scan ao vivo no nosso próprio app)
- **Fase:** Phase 1 (MVP iPhone) — antecipada para a reunião de 22/06

---

## 1. Problema

O fluxo de scan atual é **fake de ponta a ponta**:

- `mobile/src/screens/ScanScreen.tsx` tira **uma foto 2D** com `expo-camera`.
- `backend/utils/geometry.py` **não mede o animal**: devolve as proporções médias
  da raça somadas a ruído aleatório (`np.random.uniform`).
- `backend/models/weight_estimator.py` usa um Random Forest treinado num **dataset
  sintético**.
- `mobile/src/lib/api.ts` + `demoData.ts` devolvem valores pré-calculados quando o
  servidor está offline.

Resultado: o app exibe números inventados, não medições. Para avançar precisamos de
**captura 3D real (LiDAR) com medidas extraídas da geometria**, dentro do nosso app.

## 2. Objetivo (e não-objetivo)

**Objetivo (22/06):** demonstrar, ao vivo no PondiFarmApp, um scan LiDAR de um
animal/objeto que produz as 5 medidas morfométricas reais derivadas da malha 3D,
100% on-device e offline.

**Não-objetivo (fica para fase com dado de campo):**
- Acurácia *validada* contra balança/fita (exige verdade-terreno que ainda não temos).
- Detecção anatômica fina de landmarks (YOLOv8-Pose / PointNet++).
- Banco de dados remoto (continua AsyncStorage local).

> **Honestidade de escopo:** entregamos "medida real da geometria 3D", não "medida
> validada como correta". São coisas diferentes.

## 3. Decisão de arquitetura — e o que ela NÃO é

O app **continua React Native / Expo**. Não revertemos a decisão de 29/05/2026
(ver `pondifarm_mvp_ios_planeamento` arquivado). Apenas adicionamos **um módulo
nativo Swift** — um *Expo Module local* — exclusivamente para a captura LiDAR, que é
impossível em JS puro. Todo o resto (navegação, telas, storage, design) permanece RN.

- Captura: **ARKit scene reconstruction** (`sceneReconstruction = .mesh`,
  `frameSemantics = .sceneDepth`) — o modo LiDAR que deu 94.4% nos testes Polycam,
  **não** o modo fotogrametria (que deu +478% de erro).
- Cálculo das medidas: **on-device em Swift**, offline. Sem dependência de servidor
  durante a demo.
- Integração: `expo prebuild` (Continuous Native Generation) +
  `npx create-expo-module --local` gerando `modules/lidar-scanner`.

## 4. Componentes (unidades isoladas)

| Unidade | Responsabilidade | Interface |
|---|---|---|
| `modules/lidar-scanner` (Swift) | Capturar malha LiDAR, limpar chão, PCA, extrair 5 medidas, exportar `.obj` | View `LidarScannerView` + `startScan()`/`stopScan()` + evento `onScanComplete({ measurements, meshUri, thumbUri })` |
| `ScanScreen.tsx` (RN, reescrita) | UX de captura: monta scanner, coaching, botão capturar, seletor de categoria | — |
| `lib/weight.ts` (RN/TS) | 5 medidas → peso estimado **preliminar** (fórmula empírica portada), rotulado como provisório | `estimateWeight(measurements)` |
| `lib/storage.ts` (estendido) | `ScanRecord` ganha `category`, `source`, `meshUri` | — |
| `Result` / `Herd` (RN) | Badge de categoria; quando `extra`, mostra só medidas | — |

## 5. Modelo de dados

`ScanRecord` (AsyncStorage, sem DB):

```ts
type ScanRecord = {
  id: string;
  scannedAt: number;
  category: 'cow' | 'extra';      // NOVO — separa teste de rebanho real
  source: 'lidar';                // NOVO — proveniência verídica
  animalId?: string;              // opcional quando 'extra'
  breed?: string;                 // opcional quando 'extra'
  measurements: Measurements;     // SEMPRE reais (geometria)
  estimatedWeightKg?: number;     // só quando 'cow'; rotulado preliminar
  meshUri: string;                // NOVO — .obj exportado
  thumbUri?: string;
};
```

## 6. A categoria "extras"

No PreScan, seletor **Bovino vs Extra (objeto/pessoa)**:
- `cow`: pede ID + raça, calcula peso preliminar.
- `extra`: pula raça/peso, salva só medidas + rótulo. Serve para testes (caixa,
  cadeira, pessoa) sem poluir o rebanho — e para **validar o scanner** medindo objeto
  de dimensão conhecida.

## 7. Matemática das medidas (Swift)

1. Remover plano do chão (ARKit plane detection).
2. PCA na nuvem de vértices → alinhar o objeto aos eixos.
3. Extrair: comprimento (eixo horizontal mais longo), cernelha (extensão vertical),
   profundidade torácica e largura da garupa (extensões em fatias), perímetro torácico
   (perímetro do convex hull de uma fatia atrás das patas dianteiras).

## 8. Nada fake no layout

Parte da entrega é **remover o fake**:
- Apagar `mobile/src/lib/demoData.ts` e `buildDemoResult` de `api.ts`.
- Result/Herd nunca exibem número inventado: mostram dado real medido ou estado
  vazio/erro honesto.
- O design segue o **padrão prevalecido** (iOS HIG / Liquid Health, sage `#5F8068`,
  tokens `lib/theme`).

## 9. Tratamento de erros / bordas

- Device sem LiDAR ou simulador → `supportsSceneReconstruction(.mesh)` falso → aviso
  claro, sem crash.
- Scan ralo / mal enquadrado → validação de nº mínimo de vértices → pede re-scan.
- Permissão de câmera (ARKit exige) → reaproveita fluxo atual de permissão.

## 10. Testes

- **Swift (XCTest):** função de medida testável sem AR — cubo de lado `L` →
  comprimento ≈ `L`. Escrito **antes** da implementação (TDD).
- **RN (jest):** montagem do `ScanRecord`, lógica de categoria, `estimateWeight`.
- **Manual no aparelho:** escanear objeto de dimensão conhecida → conferir tolerância
  (usa a própria categoria "extras").

## 11. Sequência (19 dias, risco primeiro) → mapeia em PRs empilhados

| Fase | Dias | Entrega | PR |
|---|---|---|---|
| 1 | 1–4 | Módulo nativo + prebuild + ARView aparecendo no RN | PR1 |
| 2 | 5–9 | Captura da malha + export `.obj` + visualização | PR2 |
| 3 | 10–13 | Matemática das medidas + XCTest, calibra em objetos | PR3 |
| 4 | 14–16 | Integração RN: ScanScreen, categoria, storage, peso, remover fake | PR4 |
| 5 | 17–19 | Polish + validação manual + buffer | PR5 |

## 12. Riscos

- Primeira incursão em módulo nativo iOS → Fase 1 front-loaded para de-riscar a ponte.
- Hard dependency: iPhone com LiDAR físico (✅ confirmado em mãos).
- `expo prebuild` muda o fluxo de build/EAS → validar pipeline cedo.
