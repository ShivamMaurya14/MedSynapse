#!/usr/bin/env python3
"""Generate a synthetic SHAP background for diabetes pipeline testing only.

This is not a substitute for a representative background sampled from the
original training cohort. Replace the generated array and remove its test-only
marker when the original dataset becomes available.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import pickle
import sys

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE = ROOT / "data" / "diabetes_sample.db"
DEFAULT_OUTPUT = ROOT / "models" / "explainability" / "diabetes_background_scaled_9.npy"
SAMPLE_IDS = (
    "sample-diabetes-low-risk",
    "sample-diabetes-borderline",
    "sample-diabetes-high-risk",
)
FEATURE_ORDER = (
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
    "BMI_Cat",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a test-only nine-feature diabetes SHAP background."
    )
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    database_path = args.database.expanduser().resolve()
    output_path = args.output.expanduser().resolve()
    if not database_path.is_file():
        raise FileNotFoundError(
            f"Sample database not found: {database_path}. Run the diabetes seeder first."
        )

    os.environ["MEDSYNAPSE_DATABASE_PATH"] = str(database_path)
    sys.path.insert(0, str(ROOT))
    from backend.database import load_model_features  # pylint: disable=import-outside-toplevel

    rows = []
    for sample_id in SAMPLE_IDS:
        features = load_model_features(sample_id, "diabetes")
        missing = [name for name in FEATURE_ORDER if name not in features]
        if missing:
            raise ValueError(f"{sample_id} is missing: {', '.join(missing)}")
        rows.append([float(features[name]) for name in FEATURE_ORDER])

    scaler_path = ROOT / "models" / "diabetes_scaler.pkl"
    with scaler_path.open("rb") as handle:
        scaler = pickle.load(handle)
    if getattr(scaler, "n_features_in_", None) != len(FEATURE_ORDER):
        raise ValueError("The installed diabetes scaler is not a nine-feature scaler.")
    scaler_names = tuple(getattr(scaler, "feature_names_in_", ()))
    if scaler_names and scaler_names != FEATURE_ORDER:
        raise ValueError("The installed diabetes scaler feature order does not match the test contract.")

    raw_background = np.asarray(rows, dtype=np.float64)
    scaled_background = scaler.transform(raw_background)
    if scaled_background.shape != (len(SAMPLE_IDS), len(FEATURE_ORDER)):
        raise RuntimeError(f"Unexpected scaled background shape: {scaled_background.shape}")
    if not np.isfinite(scaled_background).all():
        raise RuntimeError("Scaled SHAP background contains non-finite values.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    np.save(output_path, scaled_background, allow_pickle=False)
    marker_path = output_path.with_suffix(".test-only.json")
    marker = {
        "test_only": True,
        "clinically_valid": False,
        "source_database": str(database_path),
        "sample_ids": list(SAMPLE_IDS),
        "feature_order": list(FEATURE_ORDER),
        "array_shape": list(scaled_background.shape),
        "warning": "Synthetic reference cohort for software pipeline testing only. Replace with 50-100 representative training rows.",
    }
    marker_path.write_text(json.dumps(marker, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "background": str(output_path),
        "marker": str(marker_path),
        "shape": list(scaled_background.shape),
        "test_only": True,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
