# End-to-end validation — point cloud → measurements → weight

Source of the figures quoted in `mobile/src/lib/weightModel.ts` ("measured on
102 public point clouds, the fully automatic chain scores 10.23% against 4.88%
for the same model fed manual measurements"). Run on 2026-08-21.

## Data

- **CowDatabase** (Ruchay et al., *Computers and Electronics in Agriculture*
  179:105821, 2020): 103 Hereford animals, each with an aligned point cloud
  (`N_AutoAligned.ply`), tape morphometrics and scale weight.
- `cowdatabase1_hereford_103.csv` — the manual measurements and scale weight,
  one row per animal, in the original spreadsheet order.
- `caracteristicas.json` — the automatic features extracted from each point
  cloud by `correr.py` (output of the 2026-08-21 run, keyed by file index).
- The point clouds themselves are **not** in the repository (size). Download
  them from the CowDatabase source and place them in `nuvens/` to re-extract.

`caracteristicas.json` holds files 1–103. Because file N maps to row N+1 (see
Caveats), row 1 would need file 0, which is not in the set — hence 102 pairs.

## Files

| File | Role |
|---|---|
| `extrator.py` | Isolates the animal (fixed work box, floor by mode over the lowest quartile, largest connected blob in plan) and extracts 10 features. Mirrors `MeshCropper` + `MeshMeasurer` in the app. |
| `correr.py` | Runs `extrator.py` over every `nuvens/*_AutoAligned.ply` and writes `caracteristicas.json`. |
| `analise_e2e.py` | Pairs automatic features with manual measurements and weight, and scores each predictor by leave-one-out OLS. |

Comments are in Portuguese; the scripts are kept as they were run.

## Reproduce

```bash
cd backend/ml/validation/e2e_cowdatabase
python analise_e2e.py              # needs numpy; uses the committed JSON + CSV
python correr.py                   # optional: re-extract (needs numpy, scipy, nuvens/)
```

## Results (LOOCV, n = 102)

| Predictor | MAPE | MAE | r [95% CI] |
|---|---|---|---|
| Null (cohort mean) | 13.92% | 58.2 kg | — |
| Manual, 4 measurements | **4.88%** | 20.8 kg | 0.927 [0.894, 0.950] |
| Automatic, 4 analogues of the manual ones | 10.88% | 46.3 kg | 0.620 [0.484, 0.727] |
| Automatic, all 10 features | **10.23%** | 43.9 kg | 0.648 [0.519, 0.748] |

The script prints r = −1.000 for the null predictor; that is an artefact of
leave-one-out on a mean predictor, not a result.

## Caveats

- **Validates the measurement algorithm, not the iPhone sensor.** CowDatabase
  clouds come from three fixed depth cameras (512×424), not from iPhone LiDAR.
- **Index offset:** `N_AutoAligned.ply` corresponds to spreadsheet row N+1
  (files are zero-indexed). With the wrong mapping the result drops to r ≈ 0.29.
- Single breed (Hereford), single cohort. The gap from 4.88% to 10.23% is the
  cost of automatic measurement; it is not a field accuracy figure.
