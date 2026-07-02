// On-device weight model — embedded coefficients of the trained regressor.
//
// Model: Linear Regression (scikit-learn), trained offline on the public
// CowDatabase (Ruchay et al. — 102 Hereford cattle, morphometrics + scale weight).
// Performance on held-out test set: MAPE 3.96% · R² 0.93 · MAE 16.9 kg.
// Version: external-trained-v0.1.0.
//
// Why embedded: the model is a simple linear combination of the five 3D
// measurements the scanner already produces, so we ship the coefficients and run
// it fully on-device — no backend, works offline in the field. The backend
// pipeline (backend/ml) can retrain and produce updated coefficients; when it
// does, replace COEF/INTERCEPT below (see the retrain runbook in the vault).
//
// HONEST CAVEAT: trained on Hereford/Angus (not Limousine) and on manual
// measurements. This is a preliminary base model — it will be recalibrated with
// PondiFarm's own Limousine field ground-truth as more paired data is collected.

import type { Measurements } from './storage';

export const WEIGHT_MODEL_VERSION = 'external-trained-v0.1.0';

// Feature order MUST match training: [body_length, withers_height, thoracic_depth, rump_width, chest_girth] (cm)
const COEF = [0.46760772, 1.07406652, -0.02892046, 3.74264559, 4.16840859] as const;
const INTERCEPT = -670.7474458915931;
// Median of each feature in the training set — used as a fallback if a
// measurement is missing/invalid (mirrors the training imputer).
const MEDIAN = [149, 120, 62, 44, 181] as const;

/**
 * Estimated live weight (kg) from the five 3D morphometric measurements,
 * using the embedded trained linear model. Non-positive/NaN measurements fall
 * back to the training median for that feature.
 */
export function estimateWeightKg(m: Measurements): number {
  const feats = [
    m.body_length_cm,
    m.withers_height_cm,
    m.thoracic_depth_cm,
    m.rump_width_cm,
    m.chest_girth_cm,
  ];
  let w = INTERCEPT;
  for (let i = 0; i < COEF.length; i++) {
    const x = Number.isFinite(feats[i]) && feats[i] > 0 ? feats[i] : MEDIAN[i];
    w += COEF[i] * x;
  }
  return Math.max(0, w);
}
