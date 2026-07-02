# Changelog

## [0.6.0](https://github.com/EuroUnionConsult/PondiFarmApp/compare/v0.5.1...v0.6.0) (2026-07-02)


### Features

* **backend:** A.1 — AnimalScanCreate aceita medidas+peso + enum lidar + scan completed ([a0e0171](https://github.com/EuroUnionConsult/PondiFarmApp/commit/a0e0171c59c5512a538bdc50c86d969f69b32f86))
* **backend:** add scan estimate-weight endpoint (takeover of [#47](https://github.com/EuroUnionConsult/PondiFarmApp/issues/47)) ([#68](https://github.com/EuroUnionConsult/PondiFarmApp/issues/68)) ([3aca83e](https://github.com/EuroUnionConsult/PondiFarmApp/commit/3aca83ec5498ad7144cdfc7a89f844b5f3e82f02))
* **backend:** add secure animal document management ([24668e5](https://github.com/EuroUnionConsult/PondiFarmApp/commit/24668e5ef62bd22b93527c92ffc4f065c38cb5fb))
* **backend:** add veterinary appointment endpoints ([b47e3b6](https://github.com/EuroUnionConsult/PondiFarmApp/commit/b47e3b6765bee750ca7e9cc904cd700a3c2000ff))
* **backend:** auth JWT multi-tenant (register/login/me) + resiliência Azure SQL ([5120d23](https://github.com/EuroUnionConsult/PondiFarmApp/commit/5120d2384b5cb0b41a754b2bddcf1024590a3079))
* **backend:** C4 — idempotência do push de scan (client_scan_id UNIQUE) ([4fcde3e](https://github.com/EuroUnionConsult/PondiFarmApp/commit/4fcde3ee7f52673e052fc1275e0e7b670e61c030))
* **backend:** M3-A — proteção por token + scope por organização (isolamento multi-tenant) ([fb9c257](https://github.com/EuroUnionConsult/PondiFarmApp/commit/fb9c257c00a944cf018160978be0988cd2aa076c))
* **backend:** ML weight-training pipeline (takeover of EURODEV-89) ([#69](https://github.com/EuroUnionConsult/PondiFarmApp/issues/69)) ([11d6cc0](https://github.com/EuroUnionConsult/PondiFarmApp/commit/11d6cc0e05e70b421d2a35523da28ea8b6bdde1d))
* **mobile:** animação de entrada no Login (fade + slide-up, easing iOS, Animated nativo) ([b918da8](https://github.com/EuroUnionConsult/PondiFarmApp/commit/b918da8daa0bd9fc260c3b5bd1e0908c56d98ad5))
* **mobile:** brand palette + Liquid Glass tokens ([1149121](https://github.com/EuroUnionConsult/PondiFarmApp/commit/114912127ca180ad502bf07e79a52acfecb1fb9b))
* **mobile:** D2 — derivar organização do token (remove org hardcoded) ([7745d73](https://github.com/EuroUnionConsult/PondiFarmApp/commit/7745d7345bd229451e8b342f501ddd0ef1d296f1))
* **mobile:** dados da nuvem em Home/Análises + tela de detalhe estilizada (M4) ([75c2a34](https://github.com/EuroUnionConsult/PondiFarmApp/commit/75c2a34b1750746cfdb747aebab3d8a3a5b2d91b))
* **mobile:** embed trained weight model on-device (offline) ([#70](https://github.com/EuroUnionConsult/PondiFarmApp/issues/70)) ([3e2e560](https://github.com/EuroUnionConsult/PondiFarmApp/commit/3e2e56060b09e49fac46d1c1760f0289f0289b8f))
* **mobile:** envia clientScanId top-level no push (C4 idempotência) ([ee060e4](https://github.com/EuroUnionConsult/PondiFarmApp/commit/ee060e459aad096dfd11551aa8a55b73064ad6d2))
* **mobile:** i18n EN + tab bar flutuante (pill iOS 26) + contraste (Fable) ([805b496](https://github.com/EuroUnionConsult/PondiFarmApp/commit/805b496b42a88c5b2ed16b72c5a5730a1e355649))
* **mobile:** i18n EN + tab bar flutuante animada (iOS 26) + contraste ([7168677](https://github.com/EuroUnionConsult/PondiFarmApp/commit/7168677fc3deff0591a3660683cfc1418454a761))
* **mobile:** Liquid Glass nativo iOS 26 (expo-glass-effect) + wrapper com fallback ([7af19d3](https://github.com/EuroUnionConsult/PondiFarmApp/commit/7af19d34150849ad50db4cb9e34c574378ac8b4c))
* **mobile:** Liquid Glass no Login/Registro (vidro navy + gradiente + blobs) ([8bb9486](https://github.com/EuroUnionConsult/PondiFarmApp/commit/8bb948617b84ef4d5ca1688d5087bff98eb233ee))
* **mobile:** Liquid Glass no TEMA CLARO — Login refeito, tab bar de vidro, Home hero (plano Fable) ([d99e67a](https://github.com/EuroUnionConsult/PondiFarmApp/commit/d99e67a88402e7fde16c3e02c2ff7c4bf4e44f8b))
* **mobile:** Liquid Glass surfaces on scanner overlays (iOS 26) ([4940159](https://github.com/EuroUnionConsult/PondiFarmApp/commit/494015962a0af28633831d3a5182b964381c2585))
* **mobile:** Liquid Glass tema claro — Login + tab bar + Home (Fable) ([64c8fc9](https://github.com/EuroUnionConsult/PondiFarmApp/commit/64c8fc90c52b1f8c618b359a3653722561384f88))
* **mobile:** login/registro JWT (Keychain via SecureStore) + gate de auth ([4dd9b73](https://github.com/EuroUnionConsult/PondiFarmApp/commit/4dd9b733f2c8353b913c0972c67e0377231a9f22))
* **mobile:** M3-B — push offline-first do scan pro backend ([144469f](https://github.com/EuroUnionConsult/PondiFarmApp/commit/144469fe08f3554179d30ee0c06f644aab42f31f))
* **mobile:** sincronização com a nuvem por toggle + URL do backend fora da UI ([9ab950d](https://github.com/EuroUnionConsult/PondiFarmApp/commit/9ab950dfa78fc74952ee65f65bc5d0f18e698324))
* **mobile:** tab bar com realce ANIMADO que desliza pra aba ativa (iOS 26) ([a4dbcce](https://github.com/EuroUnionConsult/PondiFarmApp/commit/a4dbccea70a6c27db6f42355789537c573b4d0e7))


### Bug Fixes

* **backend:** /health/db toca o DB (keep-alive do Azure SQL free-tier) ([e97762a](https://github.com/EuroUnionConsult/PondiFarmApp/commit/e97762a610d5cd4ecca965fb883fe17514c33b68))
* **backend:** auth em species/breeds (C3) + tolerância de skew no scannedAt (I6) ([f240d0c](https://github.com/EuroUnionConsult/PondiFarmApp/commit/f240d0c5faca241c432a2ae57558f357cf069362))
* **backend:** fecha IDOR/auth restantes — users, members, estimate-weight, /scan, predictions ([198f4dd](https://github.com/EuroUnionConsult/PondiFarmApp/commit/198f4dd2a7f309279bc47871f0cbef88084a1dc9))
* **backend:** fecha IDOR/broken-auth (security review + auditoria Fable) ([f5955af](https://github.com/EuroUnionConsult/PondiFarmApp/commit/f5955afa692463bc936cb028ade7761c76913b20))
* **backend:** IDOR/auth em animal_documents + veterinary_appointments (CRITICAL) ([6cde989](https://github.com/EuroUnionConsult/PondiFarmApp/commit/6cde989ab584cbf0ae7845c5afc7ef9b218bf3c5))
* **backend:** raw_result_json None → SQL NULL (none_as_null) — CHECK chk_animal_scans_raw_json ([6d78404](https://github.com/EuroUnionConsult/PondiFarmApp/commit/6d78404306dbab3189e563c9843095edca26322f))
* **backend:** resolve CI compatibility and ruff format checks ([877349e](https://github.com/EuroUnionConsult/PondiFarmApp/commit/877349ecb7975e2d5d52d62201f61b13fca463fb))
* **deploy:** pin bookworm (Debian 12) p/ msodbcsql18 + diagnóstico ODBC no build ([d82cc2c](https://github.com/EuroUnionConsult/PondiFarmApp/commit/d82cc2c54826b7f22eae889a33ea5c373ace299f))
* **ios:** build RN from source + patch fmt consteval for Xcode 26 ([8880fb5](https://github.com/EuroUnionConsult/PondiFarmApp/commit/8880fb5984ff9739dc9538d848bd38bcb42a6fd6))
* **mobile:** hardening do M3-B (revisão Fable) — dedup, idempotência, classificação de erro ([1cda0a0](https://github.com/EuroUnionConsult/PondiFarmApp/commit/1cda0a0fd4d31900a77b9bf5fbf12299276f6f54))
* **mobile:** hardening do M3-B sync (revisão Fable) ([01c30b2](https://github.com/EuroUnionConsult/PondiFarmApp/commit/01c30b2e2333b536a71d9355093dc1c2fe6924a0))
* **mobile:** Home sem redundância (anel=sync) + idioma consistente (EN) + base syncState ([2f3a74e](https://github.com/EuroUnionConsult/PondiFarmApp/commit/2f3a74e6e4eaf55b900b8e0ce7433b03d3f74e4b))
* **mobile:** Login em inglês + CTA verde SÓLIDO (botão estava invisível) ([09c56ad](https://github.com/EuroUnionConsult/PondiFarmApp/commit/09c56ad19f2c9163351702c031a5de9bb2c3c8ad))
* **mobile:** Login inglês + CTA sólido visível ([3c1137f](https://github.com/EuroUnionConsult/PondiFarmApp/commit/3c1137f406701eab09a80d0be1e0818ad4453214))
* **mobile:** realign RN/React deps to Expo SDK 54 (unblock native build) ([202e286](https://github.com/EuroUnionConsult/PondiFarmApp/commit/202e286e4529116e77c02a3850f504519f27f5cb))
* **scanner:** 3D mesh preview clay viewer + hide broken Render texture ([45870c1](https://github.com/EuroUnionConsult/PondiFarmApp/commit/45870c1729a48577d1feee7bee1047043efd6270))
* **scanner:** caixa verde ancorada no piso + arrasto contido + oclusão (LiDAR) ([5c00ba8](https://github.com/EuroUnionConsult/PondiFarmApp/commit/5c00ba8070d66836e787638589b154d2e6bc9b55))
* **scanner:** hide the low-quality per-triangle Render texture button ([85177e2](https://github.com/EuroUnionConsult/PondiFarmApp/commit/85177e24657c58e386b0a8c89a6188f48351a6a5))
* **scanner:** render 3D mesh preview as lit clay on a studio background ([94cee4e](https://github.com/EuroUnionConsult/PondiFarmApp/commit/94cee4e6f035d31cd2d1cc484d788abe153433e3))


### Performance Improvements

* **mobile:** cache da nuvem — telas instantâneas + atualização em 2º plano ([a37e14f](https://github.com/EuroUnionConsult/PondiFarmApp/commit/a37e14fa6c3bbf1fcbe83d95fde0f9705f3157e4))


### Miscellaneous Chores

* **assets:** fixed app icon, flattened on brand navy ([#57](https://github.com/EuroUnionConsult/PondiFarmApp/issues/57)) ([c411e03](https://github.com/EuroUnionConsult/PondiFarmApp/commit/c411e03c22b72a250ca2cc5217e3c0dd509e8dd4))
* **deploy:** Dockerfile (msodbcsql18) + requirements-api enxuto + CORS por env (M5) ([72ff0f4](https://github.com/EuroUnionConsult/PondiFarmApp/commit/72ff0f4176a8c5cf10e84d9e81924173a1c49792))
* **deploy:** M5 — backend no Azure App Service (Container) ([248cc0e](https://github.com/EuroUnionConsult/PondiFarmApp/commit/248cc0e178a27f5f018c7ad411224777e119a95d))
* **mobile:** apontar o app pro backend no Azure (M5) ([cdafe5b](https://github.com/EuroUnionConsult/PondiFarmApp/commit/cdafe5b2a70136d34c0d8850d4e372be7c41c06a))

## [0.5.1](https://github.com/EuroUnionConsult/PondiFarmApp/compare/v0.5.0...v0.5.1) (2026-06-24)


### Miscellaneous Chores

* single-source version + refresh README ([#55](https://github.com/EuroUnionConsult/PondiFarmApp/issues/55)) ([3588763](https://github.com/EuroUnionConsult/PondiFarmApp/commit/35887632b9fb36de30077388edb6b7c8f53d9e27))

## [0.5.0](https://github.com/EuroUnionConsult/PondiFarmApp/compare/v0.4.0...v0.5.0) (2026-06-24)


### Features

* **mobile:** on-demand 'Render texture' button (decouple bake from capture) ([6871f5b](https://github.com/EuroUnionConsult/PondiFarmApp/commit/6871f5be7f61014c44ef25ae98cc1617ded89567))
* **mobile:** on-device formula weight estimate (offline) ([c82c115](https://github.com/EuroUnionConsult/PondiFarmApp/commit/c82c115096f0fa21e204f6e40d215cdb919f226c))
* **mobile:** Path B — hide Studio 3D, seat framing box on floor ([841540b](https://github.com/EuroUnionConsult/PondiFarmApp/commit/841540b50bda09a0c22605b9076f9b3454e1fe0a))
* **mobile:** texture bake v2 — multi-view blending ([2db60ad](https://github.com/EuroUnionConsult/PondiFarmApp/commit/2db60ad526cd5e7ce1b8c79768669a7c2cc45a92))
* **mobile:** texture bake v2 — multi-view blending ([b895bac](https://github.com/EuroUnionConsult/PondiFarmApp/commit/b895bac01a5fe3b38d27011628e6b8975cf048a1))


### Bug Fixes

* **mobile:** load OBJ texture in viewer (was showing white) ([eeaa3e2](https://github.com/EuroUnionConsult/PondiFarmApp/commit/eeaa3e257cdf7740031b4b2a7ffd825f12ff2587))
* **mobile:** preserve tracking at scan start + draggable framing box ([6546c31](https://github.com/EuroUnionConsult/PondiFarmApp/commit/6546c314fa1eef0ac54d6fe02e9b2f0947861b13))

## [0.4.0](https://github.com/EuroUnionConsult/PondiFarmApp/compare/v0.3.0...v0.4.0) (2026-06-24)


### Features

* **backend:** add formula-based LiDAR weight prediction baseline ([#46](https://github.com/EuroUnionConsult/PondiFarmApp/issues/46)) ([7ab6aac](https://github.com/EuroUnionConsult/PondiFarmApp/commit/7ab6aac76bebbd718ee26176ac0b7f40f5022583))
* **mobile:** AR framing box (place/scale/recenter) and crop mesh to box before measure/export ([6dd2e2d](https://github.com/EuroUnionConsult/PondiFarmApp/commit/6dd2e2db4023c1c67d59a97edb97cb297ebf2f64))
* **mobile:** box scale/recenter controls in scan screen ([00a20ff](https://github.com/EuroUnionConsult/PondiFarmApp/commit/00a20ff523eb874b5cef83c95dc6420afc2b0fc9))
* **mobile:** capture and consolidate LiDAR mesh, export to .obj on stopScan ([73fb957](https://github.com/EuroUnionConsult/PondiFarmApp/commit/73fb9577e96e92013ec2e7a3e961458390eba415))
* **mobile:** compute 5 measurements and save .obj to Documents on scan ([6223038](https://github.com/EuroUnionConsult/PondiFarmApp/commit/62230385495460c30b4010d2a7db6086a9944af0))
* **mobile:** denser per-vertex color for LiDAR mesh ([a6dc611](https://github.com/EuroUnionConsult/PondiFarmApp/commit/a6dc611f38d7f4dee237304ddde0117f6bbac283))
* **mobile:** export colored PLY and use it in the 3D viewer ([c95b29a](https://github.com/EuroUnionConsult/PondiFarmApp/commit/c95b29ad944967a2d5a36f30352b67cd1b8e5fef))
* **mobile:** integrate LiDAR scanner into Scan flow, add extras category, remove fake demo path ([51fe069](https://github.com/EuroUnionConsult/PondiFarmApp/commit/51fe0697451e62c120fab4c1e9bd74d894810fb6))
* **mobile:** native ARKit ARView and LiDAR support check ([c136122](https://github.com/EuroUnionConsult/PondiFarmApp/commit/c1361224a04dea3a61e2c3850d4b9151a5312226))
* **mobile:** native SceneKit mesh preview view ([9dd55c3](https://github.com/EuroUnionConsult/PondiFarmApp/commit/9dd55c380bdf05a2ba9327e58bb1a96b1ff0876b))
* **mobile:** Object Capture studio mode — textured USDZ scan + measurement ([8e1605c](https://github.com/EuroUnionConsult/PondiFarmApp/commit/8e1605c331b256ffae999b4a497cc17bca34fbcd))
* **mobile:** pure mesh cropper (OBB containment) with standalone test ([6e63b65](https://github.com/EuroUnionConsult/PondiFarmApp/commit/6e63b65a9b7185f350f1a7803bc4e56a7e138cf3))
* **mobile:** pure mesh measurer (PCA + convex-hull girth) with standalone test ([a89e7e7](https://github.com/EuroUnionConsult/PondiFarmApp/commit/a89e7e7ee9955a03b716363b35bbe089e964efe4))
* **mobile:** pure OBJ serializer for lidar mesh export with standalone test ([652f522](https://github.com/EuroUnionConsult/PondiFarmApp/commit/652f522a351e9e642a3f7720ddf8d861d677c98a))
* **mobile:** retry button + capture hints for Object Capture ([baf24d5](https://github.com/EuroUnionConsult/PondiFarmApp/commit/baf24d52fd8f5166286fdb42c47af984b2510e29))
* **mobile:** sample per-vertex color from camera during scan ([51357a4](https://github.com/EuroUnionConsult/PondiFarmApp/commit/51357a48ddd0a9fba469f10b64e2f8b06df996f3))
* **mobile:** scaffold local lidar-scanner expo module ([83b7c84](https://github.com/EuroUnionConsult/PondiFarmApp/commit/83b7c84beb5609a3fafdf9660a950f87f5dc1ec4))
* **mobile:** scan controls, ref forwarding, mesh result display in test screen ([ccf578e](https://github.com/EuroUnionConsult/PondiFarmApp/commit/ccf578e762fb4e3f82637fef27f26bd0bffea521))
* **mobile:** show 5 measurements and add share button in test screen ([dc478dd](https://github.com/EuroUnionConsult/PondiFarmApp/commit/dc478dd8682ea4ae17eec155cfc3655fd8111458))
* **mobile:** show scanned 3D model at top of result screen ([7078b6b](https://github.com/EuroUnionConsult/PondiFarmApp/commit/7078b6bc2d5b86e3f2a38ebabe94f8013795655d))
* **mobile:** temp LiDAR test screen and route for EURODEV-74 verification ([f60b292](https://github.com/EuroUnionConsult/PondiFarmApp/commit/f60b2927b3a97a59f7cf54c3003f9c012a9b658f))
* **mobile:** typescript surface for lidar-scanner (isLidarSupported, view, types) ([91dd191](https://github.com/EuroUnionConsult/PondiFarmApp/commit/91dd1915d0ed4e6b4375a4c0723416ef402adf84))
* **mobile:** UV texture bake for LiDAR mesh — Polycam-style textured scan ([6bc0d8c](https://github.com/EuroUnionConsult/PondiFarmApp/commit/6bc0d8cfaf81ac16fdb1f2daf3c0f91a983f2b04))
* **mobile:** UV texture bake for LiDAR mesh (Polycam-style textured scan) ([a1b5eb7](https://github.com/EuroUnionConsult/PondiFarmApp/commit/a1b5eb7bae0f65e2e686e9188d3e540599380f59))


### Bug Fixes

* **ios:** disable user script sandboxing via config plugin ([6808093](https://github.com/EuroUnionConsult/PondiFarmApp/commit/68080931793000068d3d8e7e27bafbc865f0f7cc))
* **mobile:** add expo-font dependency for vector-icons in native dev build ([27ceb37](https://github.com/EuroUnionConsult/PondiFarmApp/commit/27ceb37ef19a22405760068cdec8473c45dd0b03))
* **mobile:** EXC_BAD_ACCESS on stopScan — snapshot shared state on main ([810ae93](https://github.com/EuroUnionConsult/PondiFarmApp/commit/810ae93535a7749b6865a2e102efc69914cdf176))
* **mobile:** framing box as wireframe cage, not solid block ([54c9bde](https://github.com/EuroUnionConsult/PondiFarmApp/commit/54c9bdee165a1d4415f314cdcf36b39210a7356f))
* **mobile:** guard AR session, add world-sensing usage, align podspec, web stubs ([6e91f62](https://github.com/EuroUnionConsult/PondiFarmApp/commit/6e91f62fcac37d1c3f42b2b20568d99283d2aebf))
* **mobile:** import Combine for Cancellable in LidarScannerView ([1752146](https://github.com/EuroUnionConsult/PondiFarmApp/commit/1752146e57313424935e0184130fe091c111d4a5))
* **mobile:** improve AR tracking init (coaching overlay + own session) ([10a3c6d](https://github.com/EuroUnionConsult/PondiFarmApp/commit/10a3c6d09cad021937a2e8d351a89664abf738fa))
* **mobile:** make framing box visible + English UI strings ([793bfd9](https://github.com/EuroUnionConsult/PondiFarmApp/commit/793bfd9944fff598b3bc56c90f5af7dbf6a5516d))
* **mobile:** run mesh consolidation off main thread, guard nil frame ([95acc30](https://github.com/EuroUnionConsult/PondiFarmApp/commit/95acc30c1a872498a9362a4a5823f2691f9ed9b3))
* **mobile:** stop starving ARKit tracking during scan ([b172158](https://github.com/EuroUnionConsult/PondiFarmApp/commit/b172158ed85b7c96d1364fdc227147b8e7f5f223))
* **mobile:** truthful Settings/Analytics copy and align backend config key ([b38bf17](https://github.com/EuroUnionConsult/PondiFarmApp/commit/b38bf17be860fb0a78100ab60ebf45d38491be1e))


### Documentation

* add EURODEV-74 phase-1 implementation plan ([503fa40](https://github.com/EuroUnionConsult/PondiFarmApp/commit/503fa4007a5c20e3b7739f5f12b39865831d07f9))
* add EURODEV-75 phase-2 mesh capture plan ([0e0ee6b](https://github.com/EuroUnionConsult/PondiFarmApp/commit/0e0ee6ba107826b7d96307fc6564f499c2f087d0))
* add EURODEV-76 phase-3 measurements plan ([d2e5706](https://github.com/EuroUnionConsult/PondiFarmApp/commit/d2e570623d558278851664576df97e2303893587))
* add EURODEV-77 phase-4 integration plan ([872365c](https://github.com/EuroUnionConsult/PondiFarmApp/commit/872365c6a809366d52130b424e2aa7a0c352a76b))
* add EURODEV-79 manual bounding box plan ([63ee269](https://github.com/EuroUnionConsult/PondiFarmApp/commit/63ee26946cf593bdf771830d5948f5bc9298dcbd))
* add EURODEV-80 mesh viewer + color plan ([6ee7650](https://github.com/EuroUnionConsult/PondiFarmApp/commit/6ee7650694a83fa7a02a5417099de48ea09faf75))
* add native LiDAR scanner design spec ([0df46ac](https://github.com/EuroUnionConsult/PondiFarmApp/commit/0df46ac64ad6798f41992b8332d1abae855144fc))


### Tests

* **mobile:** assert all 5 fields on degenerate input; log obj write failure ([d070ffb](https://github.com/EuroUnionConsult/PondiFarmApp/commit/d070ffbdc1db413412680cfdfb9635cc64c012cd))


### Build System

* **mobile:** add dev client and build-properties for native LiDAR module ([2cabad7](https://github.com/EuroUnionConsult/PondiFarmApp/commit/2cabad712356a8ee0415c11ae6dfa9264cad7755))


### Miscellaneous Chores

* **assets:** temporary app icon (cow + scan frame + field) ([54da719](https://github.com/EuroUnionConsult/PondiFarmApp/commit/54da7191041addc5d90a40c889ab3c89cff266c4))

## [0.3.0](https://github.com/EuroUnionConsult/PondiFarmApp/compare/v0.2.1...v0.3.0) (2026-06-01)


### Features

* **mobile:** migrate Analytics screen to iOS HIG ios tokens ([d87cd86](https://github.com/EuroUnionConsult/PondiFarmApp/commit/d87cd861013f1b4c5a49d9468b6c39c95c479956))
* **mobile:** migrate Herd screen to iOS HIG ios tokens ([3acfb30](https://github.com/EuroUnionConsult/PondiFarmApp/commit/3acfb302ff3d2d89d5abe8221a60615c81bfa8ef))
* **mobile:** migrate Result screen to iOS HIG ios tokens ([abb7ef8](https://github.com/EuroUnionConsult/PondiFarmApp/commit/abb7ef8797c4ead9860962b4f65a5c8ae268d8f0))
* **mobile:** migrate Result, Herd, Analytics and Scan to iOS HIG ios tokens ([#34](https://github.com/EuroUnionConsult/PondiFarmApp/issues/34)) ([d3830ca](https://github.com/EuroUnionConsult/PondiFarmApp/commit/d3830caab5ddbd5b41ee539f2396b00be516b0c8))
* **mobile:** migrate Scan screen to iOS HIG ios tokens ([fe98b99](https://github.com/EuroUnionConsult/PondiFarmApp/commit/fe98b996c40734c11c2295f66e8739155db10119))
* **mobile:** migrate Settings screen to iOS HIG ios tokens ([#25](https://github.com/EuroUnionConsult/PondiFarmApp/issues/25)) ([c7c8f05](https://github.com/EuroUnionConsult/PondiFarmApp/commit/c7c8f05149048d25bb2e5a7ec111595e463d1ed5))
* **mobile:** redesign Home with iOS HIG (Liquid Health direction) ([#22](https://github.com/EuroUnionConsult/PondiFarmApp/issues/22)) ([fe5e890](https://github.com/EuroUnionConsult/PondiFarmApp/commit/fe5e89016434acb9fba79be372d25daad3b46f29))


### Bug Fixes

* **mobile:** align package versions to Expo SDK 54 ([#23](https://github.com/EuroUnionConsult/PondiFarmApp/issues/23)) ([4aadd64](https://github.com/EuroUnionConsult/PondiFarmApp/commit/4aadd640e451a4e920023561fc797a241d60cdc2))

## [0.2.1](https://github.com/EuroUnionConsult/PondiFarmApp/compare/v0.2.0...v0.2.1) (2026-05-29)


### Bug Fixes

* **mobile:** remove unused width destructuring in AnalyticsScreen ([#21](https://github.com/EuroUnionConsult/PondiFarmApp/issues/21)) ([cb1c247](https://github.com/EuroUnionConsult/PondiFarmApp/commit/cb1c2478dcb2973f2578e7527d3d4379de9db2ff))


### Continuous Integration

* fix Jira sync workflow authentication ([151ad35](https://github.com/EuroUnionConsult/PondiFarmApp/commit/151ad3540c84f8a9036acf6a65efe23730730d9a))
* sync bot branches and release PRs to Jira ([4825f81](https://github.com/EuroUnionConsult/PondiFarmApp/commit/4825f81ef8caf3044487f36d20d1ff2ed6558dbe))
* sync bot branches and release PRs to Jira ([028540d](https://github.com/EuroUnionConsult/PondiFarmApp/commit/028540d9438878a2d3aec5c2f5a4d2ce3ea0b5c0))

## [0.2.0](https://github.com/EuroUnionConsult/PondiFarmApp/compare/v0.1.1...v0.2.0) (2026-05-29)


### Features

* **workflow:** add workflow_dispatch trigger to sync-bot-pr-to-jira for testing ([47f9f0a](https://github.com/EuroUnionConsult/PondiFarmApp/commit/47f9f0a8fdfbcf460d6b551ce8f7057cd22bd543))

## [0.1.1](https://github.com/EuroUnionConsult/PondiFarmApp/compare/v0.1.0...v0.1.1) (2026-05-29)


### Code Refactoring

* **backend:** apply ruff format to Phase 0 sources ([f510719](https://github.com/EuroUnionConsult/PondiFarmApp/commit/f510719916a1e5065f8ea1b10040af72ed1e1e57))


### Miscellaneous Chores

* **release:** remove release-as override after v0.1.0 ([b6a3f16](https://github.com/EuroUnionConsult/PondiFarmApp/commit/b6a3f164bdaa76036644c9ee6e52c42f7a9b7e4e))

## 0.1.0 (2026-05-29)


### Features

* **backend:** add Phase 0 FastAPI service ([8c83d99](https://github.com/EuroUnionConsult/PondiFarmApp/commit/8c83d990d8d3d19988e922beb88369c7fa7045f7))
* **mobile:** add Phase 0 Expo React Native application ([7856c8a](https://github.com/EuroUnionConsult/PondiFarmApp/commit/7856c8aedb0b19bbe84ae5931895f67c8d14a1a3))


### Continuous Integration

* add release automation, workflows, code owners and templates ([44d7e8f](https://github.com/EuroUnionConsult/PondiFarmApp/commit/44d7e8f792bc029034fe0f26ff3aabc5944ceea5))


### Miscellaneous Chores

* configure repository governance and tooling ([82f385b](https://github.com/EuroUnionConsult/PondiFarmApp/commit/82f385b36e1b89e58521cb3e21ccede8c267e293))
* **release:** pin first release at 0.1.0 ([f62c552](https://github.com/EuroUnionConsult/PondiFarmApp/commit/f62c552dcaa463ffb6f52fdadd873b8c780c6767))

## Changelog

All notable changes to **PondiFarmApp** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases are automated via [release-please](https://github.com/googleapis/release-please) from [Conventional Commits](https://www.conventionalcommits.org).

---

## Pre-history

Versioning for the public Euro Union Consult release restarts at `0.0.0`.

A predecessor private repository (`Tcordeir0/boviscan`, archived) carried versions up to `0.3.3` during the Phase 0 demo period (May 2026). Those entries are not reproduced here and are not part of the public history.

<!-- release-please will populate entries below this line -->
