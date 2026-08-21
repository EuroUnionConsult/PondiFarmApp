// On-device weight model — embedded coefficients of the trained regressor.
//
// Model: ordinary least squares over four morphometric measurements, fitted on
// the public CowDatabase (Ruchay et al. — 103 Hereford, tape morphometrics
// paired with scale weight). Version: external-trained-v0.2.0.
//
// Leave-one-out over the whole cohort: MAPE 4.62% · MAE 19.5 kg · r 0.932,
// against a null (cohort-mean) predictor at 13.84%. LOOCV is quoted rather than
// a single held-out split because at n=103 a split is itself a coin toss.
//
// WHY BODY LENGTH WAS DROPPED (v0.1.0 → v0.2.0)
// v0.1.0 used five features, oblique body length among them. Measured on the
// same cohort under the same protocol, that feature is not merely useless but
// harmful: on its own it scores 16.96% MAPE, worse than predicting the mean,
// and the training column carries an outlier of 452 cm against a median of 149.
// Removing it moves the model from 5.01% to 4.62% and lifts r from 0.897 to
// 0.932. The scanner still measures body length and the app still displays it;
// it simply no longer feeds the weight estimate.
//
// Why embedded: four coefficients and an intercept run fully on-device — no
// backend, works offline in the field. The backend pipeline (backend/ml) can
// retrain and produce updated coefficients; when it does, replace COEF and
// INTERCEPT below (see the retrain runbook in the vault).
//
// HONEST CAVEAT: the base model is trained on Hereford cattle and on manual
// tape measurements. The device computes geometrically analogous but not
// identical quantities, and that gap costs accuracy — measured on 102 public
// point clouds, the fully automatic chain scores 10.23% against 4.88% for the
// same model fed manual measurements. Breed calibrations below correct the base
// prediction for a specific breed AND category; they are measured, not assumed.

import type { AnimalCategory, Measurements } from './storage';

export type { AnimalCategory };

export const WEIGHT_MODEL_VERSION = 'external-trained-v0.2.0';

// Feature order MUST match training: [withers_height, thoracic_depth, rump_width, chest_girth] (cm).
// rump_width is the ilium width column of CowDatabase (training median 44 cm).
const COEF = [1.6451018341024197, 0.3620137862529025, 5.488782242499486, 3.7381253276099202] as const;
const INTERCEPT = -691.191945913401;
// Median of each feature in the training set — used as a fallback if a
// measurement is missing/invalid (mirrors the training imputer).
const MEDIAN = [120, 62, 44, 180] as const;

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
 * Limousine young bulls: the base model under-predicts by ~20%. That is not
 * model error — it is the breed. Limousine is the most heavily conformed beef
 * breed there is, and these were entire males on an intensive station diet,
 * whereas the base model learned from Hereford cows.
 *
 * Derivation: 15 bulls from the ACL (Associação Portuguesa de Criadores da Raça
 * Bovina Limousine) performance test, series 03/2022 — official station scale
 * weights and body measurements taken at exit of the test. Refitted for the
 * v0.2.0 base: a single multiplicative parameter takes MAPE from 20.20% to
 * 6.83% under leave-one-out.
 *
 * WHAT THIS FACTOR DOES AND DOES NOT DO. It corrects systematic bias. It does
 * not demonstrate that the model can tell one Limousine from another: on this
 * cohort the null (mean) predictor scores 7.10% against the corrected model's
 * 6.83%, a gain of 0.27 pp that is noise at n=15. The cohort's weight CV is
 * only 8.26% — too homogeneous for morphometry to explain anything. Never quote
 * the 6.83% as validation of the model on Limousine.
 *
 * WHY MULTIPLICATIVE AND NOT A PER-BREED INTERCEPT. Both were measured on this
 * cohort under leave-one-out: multiplicative 6.81%, additive 6.51%, affine
 * 6.70%. At n=15 those are indistinguishable, so the single-parameter form
 * stays — fewer degrees of freedom, less chance to memorise. Revisit when a
 * breed has enough animals AND enough weight spread to separate the two.
 */
const BREED_CALIBRATIONS: Readonly<Record<string, BreedCalibration>> = {
  'limousine|young_bull': {
    factor: 1.2608,
    measuredOn: 'entire males, 14-16 months, station performance test',
    mapePercent: 6.83,
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
