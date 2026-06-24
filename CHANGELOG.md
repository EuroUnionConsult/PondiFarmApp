# Changelog

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
