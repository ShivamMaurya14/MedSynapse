#!/usr/bin/env python3
"""Create a local SQLite database containing synthetic diabetes features.

This deliberately bypasses OCR and Gemma. It starts from the DPF-free
eight-feature mapping and adds a clearly labelled synthetic DPF placeholder so
the currently installed legacy nine-feature artifact can exercise the pipeline.

Run:
    venv/bin/python scripts/seed_diabetes_sample_db.py
"""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE = ROOT / "data" / "diabetes_sample.db"
PRODUCTION_DATABASE = ROOT / "data" / "medsynapse.db"
DEFAULT_FEATURES = ROOT / "data" / "diabetes_sample_features.json"
FEATURE_ORDER = (
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "Age",
    "BMI_Cat",
)
LEGACY_MODEL_FEATURE_ORDER = (
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
        description="Seed a separate SQLite database with synthetic diabetes features."
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=DEFAULT_DATABASE,
        help=f"Output database path (default: {DEFAULT_DATABASE})",
    )
    parser.add_argument(
        "--features",
        type=Path,
        default=DEFAULT_FEATURES,
        help=f"Input fixture JSON (default: {DEFAULT_FEATURES})",
    )
    return parser.parse_args()


def bmi_category(bmi: float) -> int:
    if bmi < 18.5:
        return 0
    if bmi < 25.0:
        return 1
    if bmi < 30.0:
        return 2
    return 3


def approximate_dpf(features: dict) -> float:
    """Return a deterministic pipeline-test placeholder, not a clinical value.

    DPF represents family-history information and cannot be recovered from
    metabolic measurements. This bounded score only lets synthetic records
    satisfy the legacy artifact's input shape during software testing.
    """
    score = (
        0.15
        + 0.004 * max(float(features["Age"]) - 20.0, 0.0)
        + 0.003 * max(float(features["Glucose"]) - 70.0, 0.0)
        + 0.01 * max(float(features["BMI"]) - 18.5, 0.0)
        + 0.03 * max(float(features["Pregnancies"]), 0.0)
    )
    return round(min(max(score, 0.1), 1.5), 3)


def legacy_model_features(features: dict) -> dict:
    values = dict(features)
    values["DiabetesPedigreeFunction"] = approximate_dpf(features)
    return {name: values[name] for name in LEGACY_MODEL_FEATURE_ORDER}


def load_and_validate_samples(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("feature_contract") != list(FEATURE_ORDER):
        raise ValueError("Fixture feature_contract does not match the database contract.")

    samples = payload.get("samples")
    if not isinstance(samples, list) or not samples:
        raise ValueError("Fixture file must contain at least one sample.")

    seen_ids: set[str] = set()
    for sample in samples:
        sample_id = sample.get("id")
        if not isinstance(sample_id, str) or not sample_id.startswith("sample-diabetes-"):
            raise ValueError("Every sample needs an id beginning with 'sample-diabetes-'.")
        if sample_id in seen_ids:
            raise ValueError(f"Duplicate sample id: {sample_id}")
        seen_ids.add(sample_id)

        features = sample.get("features")
        if not isinstance(features, dict) or tuple(features) != FEATURE_ORDER:
            raise ValueError(f"{sample_id} does not use the exact ordered feature contract.")
        if any(
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
            for value in features.values()
        ):
            raise ValueError(f"{sample_id} contains a non-finite or non-numeric value.")
        expected_category = bmi_category(float(features["BMI"]))
        if int(features["BMI_Cat"]) != expected_category:
            raise ValueError(
                f"{sample_id} has BMI_Cat={features['BMI_Cat']}; expected {expected_category}."
            )
    return samples


def main() -> int:
    args = parse_args()
    database_path = args.database.expanduser().resolve()
    features_path = args.features.expanduser().resolve()
    if database_path == PRODUCTION_DATABASE.resolve():
        raise ValueError(
            "Refusing to seed data/medsynapse.db. Use the separate sample database."
        )
    if not features_path.is_file():
        raise FileNotFoundError(f"Feature fixture file not found: {features_path}")

    samples = load_and_validate_samples(features_path)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    os.environ["MEDSYNAPSE_DATABASE_PATH"] = str(database_path)
    sys.path.insert(0, str(ROOT))

    from backend.database import (  # pylint: disable=import-outside-toplevel
        get_connection,
        initialize_database,
        load_feature_extraction_for_review,
        report_sha256,
    )

    initialize_database()
    with get_connection() as connection:
        for sample in samples:
            features = sample["features"]
            stored_model_features = legacy_model_features(features)
            evidence = {
                "source": "manual_synthetic_fixture",
                "gemma_skipped": True,
                "profile": sample["profile"],
                "description": sample["description"],
                "features": features,
                "test_only_approximation": {
                    "feature": "DiabetesPedigreeFunction",
                    "value": stored_model_features["DiabetesPedigreeFunction"],
                    "clinically_valid": False,
                    "purpose": "legacy nine-feature pipeline shape test only",
                },
            }
            connection.execute(
                """
                INSERT INTO feature_extractions (
                    id, disease_type, source_filename, report_sha256,
                    features_json, model_features_json, extraction_status,
                    clinician_approval_status
                ) VALUES (?, 'diabetes', ?, ?, ?, ?, 'ready_for_inference', 'pending')
                ON CONFLICT(id) DO UPDATE SET
                    disease_type = excluded.disease_type,
                    source_filename = excluded.source_filename,
                    report_sha256 = excluded.report_sha256,
                    features_json = excluded.features_json,
                    model_features_json = excluded.model_features_json,
                    extraction_status = excluded.extraction_status,
                    clinician_approval_status = excluded.clinician_approval_status,
                    clinician_reviewed_by = NULL,
                    clinician_review_note = NULL,
                    clinician_reviewed_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    sample["id"],
                    f"{sample['profile']}.manual.json",
                    report_sha256(json.dumps(features, sort_keys=True)),
                    json.dumps(evidence, separators=(",", ":"), ensure_ascii=False),
                    json.dumps(stored_model_features, separators=(",", ":"), ensure_ascii=False),
                ),
            )

    verified = []
    for sample in samples:
        review_record = load_feature_extraction_for_review(sample["id"])
        stored = review_record["model_features"]
        expected = legacy_model_features(sample["features"])
        if stored != expected:
            raise RuntimeError(f"Database round-trip mismatch for {sample['id']}")
        if review_record["clinician_approval_status"] != "pending":
            raise RuntimeError(f"Expected pending review status for {sample['id']}")
        verified.append(
            {
                "id": sample["id"],
                "profile": sample["profile"],
                "features": stored,
            }
        )

    print(json.dumps({
        "database": str(database_path),
        "gemma_used": False,
        "synthetic_dpf_used": True,
        "records_verified": len(verified),
        "samples": verified,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
