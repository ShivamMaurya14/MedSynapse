#!/usr/bin/env python3
"""Create the tracked WDBC reference cohort used for breast SHAP evidence.

The breast artifacts consume the conventional WDBC order: mean, standard
error, then worst for radius through fractal_dimension.  scikit-learn packages
the same public WDBC feature matrix in that exact order.  This script exports
only measurements (no diagnosis labels) and records its provenance so the
explanation layer never substitutes the current patient's values as a
reference background.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.datasets import load_breast_cancer


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.services.breast_feature_contract import BREAST_FEATURE_ORDER  # noqa: E402


def main() -> None:
    dataset = load_breast_cancer()
    values = np.asarray(dataset.data, dtype=np.float64)
    # scikit-learn expresses WDBC names as ``mean radius`` / ``radius error``
    # while the API contract uses ``radius_mean`` / ``radius_se``.  Both
    # enumerate the same three contiguous ten-feature blocks.
    expected_names = tuple(
        (f"mean {name}" if metric == "mean" else
         f"{name} error" if metric == "se" else
         f"worst {name}").replace("_", " ")
        for metric in ("mean", "se", "worst")
        for name in (
            "radius", "texture", "perimeter", "area", "smoothness",
            "compactness", "concavity", "concave_points", "symmetry",
            "fractal_dimension",
        )
    )
    if tuple(dataset.feature_names) != expected_names:
        raise RuntimeError("The packaged WDBC feature order does not match BREAST_FEATURE_ORDER.")
    if values.shape != (569, len(BREAST_FEATURE_ORDER)) or not np.isfinite(values).all():
        raise RuntimeError("The packaged WDBC reference matrix is incomplete or non-finite.")

    output_dir = ROOT / "models" / "explainability"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "breast_background_raw.npy"
    metadata_path = output_dir / "breast_background_raw.json"
    np.save(output_path, values, allow_pickle=False)
    digest = hashlib.sha256(output_path.read_bytes()).hexdigest()
    metadata = {
        "dataset": "Wisconsin Diagnostic Breast Cancer (WDBC)",
        "source": "scikit-learn bundled load_breast_cancer dataset",
        "purpose": "de-identified reference cohort for interventional breast-model Shapley explanations",
        "feature_order": list(BREAST_FEATURE_ORDER),
        "shape": list(values.shape),
        "dtype": str(values.dtype),
        "sha256": digest,
        "contains_labels": False,
        "generated_by": "scripts/generate_breast_shap_background.py",
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"background={output_path}")
    print(f"metadata={metadata_path}")
    print(f"shape={values.shape}")
    print(f"sha256={digest}")


if __name__ == "__main__":
    main()
