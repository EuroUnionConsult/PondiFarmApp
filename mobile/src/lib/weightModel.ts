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
// HONEST CAVEAT: the base model is trained on Hereford cattle and on manual
// measurements. Breed calibration factors (below) correct the base prediction
// for a specific breed AND animal category; they are measured, not assumed.

import type { AnimalCategory, Measurements } from './storage';

export type { AnimalCategory };

export const WEIGHT_MODEL_VERSION = 'external-trained-v0.1.0';

// Feature order MUST match training: [body_length, withers_height, thoracic_depth, rump_width, chest_girth] (cm)
const COEF = [0.46760772, 1.07406652, -0.02892046, 3.74264559, 4.16840859] as const;
const INTERCEPT = -670.7474458915931;
// Median of each feature in the training set — used as a fallback if a
// measurement is missing/invalid (mirrors the training imputer).
const MEDIAN = [149, 120, 62, 44, 181] as const;

interface BreedCalibration {
  /** Multiply the base (Hereford-trained) prediction by this. */
  factor: number;
  /** Animals the factor was measured on — never extrapolate silently beyond it. */
  measuredOn: string;
  /** Honest error of the calibrated model on that cohort (leave-one-out). */
  mapePercent: number;
  sampleSize: number;
  source: string;
}

/**
 * Measured breed×category calibrations, keyed `breed|category` (lowercase breed).
 *
 * Limousine young bulls: base model under-predicts by ~27%. That is not model
 * error — it is the breed. Limousine is the most heavily conformed beef breed
 * there is, and these were entire males on an intensive station diet, whereas
 * the base model learned from Hereford cows.
 *
 * Derivation: 15 bulls from the ACL (Associação Portuguesa de Criadores da Raça
 * Bovina Limousine) performance test, series 03/2022 — official station scale
 * weights and body measurements taken at exit of the test. A single
 * multiplicative parameter takes MAPE from 21.01% to 6.93% under leave-one-out
 * validation. An affine fit (two parameters) scored 6.78% — not worth the
 * second parameter at n=15, where every extra degree of freedom is a chance to
 * memorise rather than learn.
 */
const BREED_CALIBRATIONS: Readonly<Record<string, BreedCalibration>> = {
  'limousine|young_bull': {
    factor: 1.2705,
    measuredOn: 'entire males, 14-16 months, station performance test',
    mapePercent: 6.93,
    sampleSize: 15,
    source: 'ACL performance test 03/2022',
  },
};

function calibrationKey(breed?: string, category: AnimalCategory = 'unknown'): string {
  return `${(breed ?? '').trim().toLowerCase()}|${category}`;
}

/**
 * The calibration that would be applied, or null when none was ever measured
 * for this breed/category pair. Use it to show the user what the estimate rests
 * on — a calibrated number and an uncalibrated one deserve different wording.
 */
export function getBreedCalibration(
  breed?: string,
  category: AnimalCategory = 'unknown',
): BreedCalibration | null {
  return BREED_CALIBRATIONS[calibrationKey(breed, category)] ?? null;
}

/**
 * Estimated live weight (kg) from the five 3D morphometric measurements.
 *
 * When a measured calibration exists for `breed` + `category`, it is applied.
 * Otherwise the base prediction is returned unchanged — deliberately. Applying
 * the young-bull factor to an adult cow would inflate her by 27%, and we have
 * no data saying that transfers. Absent evidence, the base model is the honest
 * answer, not a guess dressed up as a correction.
 *
 * Non-positive/NaN measurements fall back to the training median for that feature.
 */
export function estimateWeightKg(
  m: Measurements,
  breed?: string,
  category: AnimalCategory = 'unknown',
): number {
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
  const calibration = getBreedCalibration(breed, category);
  if (calibration) w *= calibration.factor;
  return Math.max(0, w);
}
