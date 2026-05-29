# PondiFarm

> Livestock biometric analysis platform — non-invasive weight estimation and breed identification for cattle.

[![Status](https://img.shields.io/badge/status-Phase%200%20%E2%80%94%20validation-blue)]()
[![License](https://img.shields.io/badge/license-Proprietary%20EUC-red)](./LICENSE)
[![Made by](https://img.shields.io/badge/by-Euro%20Union%20Consult-005AA7)](https://eurounionconsult.com)

PondiFarm is a research and development project by **Euro Union Consult** (Portugal), targeting the European livestock industry with mobile-first biometric tools for cattle.

This repository hosts the **PondiFarmApp** monorepo: a React Native / Expo client paired with a FastAPI backend, together implementing the Phase 0 validation pipeline for body measurement and weight estimation from images and 3D scans.

---

## Monorepo layout

```
PondiFarmApp/
├── backend/        FastAPI + YOLOv8 + scikit-learn weight estimator
├── mobile/         Expo SDK 54 + React Native 0.81.5 (TypeScript)
├── .github/        CI workflows, release-please, code scanning, templates
└── …               Docs, LICENSE, governance files
```

- See [`backend/README.md`](./backend/README.md) to run the API locally.
- See [`mobile/README.md`](./mobile/README.md) to run the app locally.

## Project status

**Phase 0 — Validation** (in progress, May 2026).

The Phase 0 goal is to validate the end-to-end pipeline (image / 3D scan → detection → measurements → weight estimate) against ground-truth data from controlled field sessions with partner farms.

Field session #1 — Limousine herd, Beira Interior, Portugal — is scheduled for **2026-06-08** with Prof. Joaquim Carvalho (IPCB).

3D capture during Phase 0 uses **Polycam Pro** (iPhone Pro LiDAR) as an external tool — independent of this codebase. Empirical validation of the capture pipeline is documented in the project knowledge base.

## Predecessor

This project succeeds the private `Tcordeir0/boviscan` repository (Phase 0 demo, archived). Prior changelog entries from boviscan are not reproduced here — release tracking restarts at `0.0.0` for the public Euro Union Consult release.

## Contributing

Internal contributors only at this stage. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for commit conventions, branch strategy, and the pull request process.

External contribution requests are evaluated on a case-by-case basis — open a Discussion or contact the maintainers before submitting a pull request.

## Security

If you discover a security issue, please follow the responsible disclosure process described in [`SECURITY.md`](./SECURITY.md). Do **not** open a public issue for security reports.

## License

**Proprietary — © 2026 Euro Union Consult, Lda. All rights reserved.**

This source code is **source-available, not open-source**. It is published for transparency, peer review, and academic and regulatory inspection. **No reuse, redistribution, modification, or derivative work is permitted without prior written authorization from Euro Union Consult.**

See [`LICENSE`](./LICENSE) for the full proprietary terms.

---

Maintained by [Euro Union Consult, Lda.](https://eurounionconsult.com) — Porto, Portugal.
