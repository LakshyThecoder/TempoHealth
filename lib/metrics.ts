/** Keys used for rolling baselines + anomaly detection (nullable columns skipped per row). */
export const ANOMALY_METRICS = [
  'hr',
  'hrv_ms',
  'spo2',
  'steps',
  'sleep_duration_min',
  'sleep_deep_min',
  'rr',
  'skin_temp_delta',
  'sedentary_min',
  'very_active_min',
  'calories',
] as const

export type AnomalyMetric = (typeof ANOMALY_METRICS)[number]

/** Cold-start population norms when insufficient history */
export const POPULATION_NORMS: Record<AnomalyMetric, { mean: number; std: number }> = {
  hr: { mean: 68, std: 10 },
  hrv_ms: { mean: 42, std: 15 },
  spo2: { mean: 97.5, std: 1.0 },
  steps: { mean: 7200, std: 2000 },
  sleep_duration_min: { mean: 420, std: 60 },
  sleep_deep_min: { mean: 80, std: 25 },
  rr: { mean: 15, std: 2 },
  skin_temp_delta: { mean: 0, std: 0.3 },
  sedentary_min: { mean: 650, std: 140 },
  very_active_min: { mean: 42, std: 35 },
  calories: { mean: 2250, std: 450 },
}

export const DATASET_PROVENANCE = {
  name: 'FitBit Fitness Tracker Data (Fitabase export)',
  kaggleUrl: 'https://www.kaggle.com/datasets/arashnic/fitbit',
  license: 'CC0: Public Domain',
  periodLabel: 'March–May 2016 (Amazon Mechanical Turk cohort)',
  citation:
    'Furberg R, Brinton J, Keating M, Ortiz A. Fitbit motion data (Fitabase). Zenodo. doi associated with Kaggle dataset listing.',
  limitations: [
    '2016 Fitbit export does not include clinical SpO₂ or gold-standard HRV',
    'HRV-like values in TempoHealth may be derived from HR dispersion (labeled in metrics_meta)',
  ],
} as const
