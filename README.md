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
├── backend/        FastAPI + scikit-learn weight prediction (Random Forest)
├── mobile/         Expo SDK 54 + React Native 0.81.5 (TypeScript)
├── .github/        CI workflows, release-please, code scanning, templates
└── …               Docs, LICENSE, governance files
```

- See [`backend/README.md`](./backend/README.md) to run the API locally.
- See [`mobile/README.md`](./mobile/README.md) to run the app locally.

## Project status

**Sprint 1 — native LiDAR scanner + weight pipeline** (v0.5.0, June 2026).

The goal is an end-to-end pipeline (LiDAR 3D scan → measurements → weight estimate) validated against ground-truth scale weights from field sessions with partner farms.

Field session #1 — Limousine herd, Beira Interior, Portugal — was conducted on **2026-06-08** with Prof. Joaquim Carvalho (IPCB).

3D capture now uses a **proprietary on-device LiDAR scanner** (Apple ARKit scene reconstruction) built into the app, replacing the Polycam Pro external tool used during early prototyping. This gives full control over acquisition, mesh quality, and metadata.

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
