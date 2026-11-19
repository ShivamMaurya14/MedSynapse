#!/usr/bin/env python3
"""Store one synthetic, contract-valid WDBC feature record for pipeline testing.

Run from the project root:
    venv/bin/python scripts/seed_breast_cancer_test_db.py

The record is deliberately labelled synthetic and is suitable only for testing
the feature-store and inference plumbing. It is not patient data and its
values must not be interpreted as a diagnosis or a model-performance claim.
"""

from __future__ import annotations

import sys
from dataclasses import asdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import (  # noqa: E402
    get_database_path,
    initialize_database,
    load_model_features,
    save_feature_extraction,
)
from backend.services.breast_feature_contract import (  # noqa: E402
    BREAST_FEATURE_ORDER,
    ExtractedFeature,
    build_model_features,
    missing_or_unverified,
    serialise_features,
)


# A public-style WDBC-shaped synthetic fixture in the exact mean, SE, worst
# feature order required by BREAST_FEATURE_ORDER. It deliberately has no label.
TEST_VALUES = (
    14.20, 20.10, 92.50, 620.0, 0.0950, 0.1200, 0.0800, 0.0450, 0.1800, 0.0620,
    0.710, 1.005, 4.625, 31.00, 0.00475, 0.00600, 0.00400, 0.00225, 0.00900, 0.00310,
    17.04, 24.12, 111.0, 744.0, 0.1140, 0.1440, 0.0960, 0.0540, 0.2160, 0.0744,
)


def main() -> None:
    if len(TEST_VALUES) != len(BREAST_FEATURE_ORDER):
        raise RuntimeError("The synthetic fixture must contain exactly 30 WDBC values.")

    source_lines = [
        "SYNTHETIC BREAST-CANCER PIPELINE TEST FIXTURE",
        "No patient data. No diagnosis label. Created solely for local feature-store testing.",
    ]
    extracted = {}
    for name, value in zip(BREAST_FEATURE_ORDER, TEST_VALUES):
        line = f"{name}: {value}"
        source_lines.append(line)
        extracted[name] = ExtractedFeature(
            value=float(value),
            unit=None,
            source_text=line,
            page=1,
            confidence=1.0,
            status="extracted",
        )

    missing = missing_or_unverified(extracted)
    if missing:
        raise RuntimeError(f"Synthetic fixture failed the WDBC contract: {missing}")
    model_features = build_model_features(extracted)
    if tuple(model_features) != BREAST_FEATURE_ORDER:
        raise RuntimeError("Model feature ordering differs from the required WDBC contract.")

    initialize_database()
    extraction_id = save_feature_extraction(
        disease_type="breast",
        source_filename="synthetic_wdbc_30_feature_pipeline_fixture.txt",
        report_text="\n".join(source_lines),
        features=serialise_features(extracted),
        model_features=model_features,
        extraction_status="ready_for_inference",
    )
    stored = load_model_features(extraction_id, "breast")
    if stored != model_features:
        raise RuntimeError("SQLite round trip changed the breast model features.")

    print(f"database={get_database_path()}")
    print(f"feature_extraction_id={extraction_id}")
    print(f"feature_count={len(stored)}")
    print("status=ready_for_inference")
    print("clinician_approval_status=pending")


if __name__ == "__main__":
    main()
