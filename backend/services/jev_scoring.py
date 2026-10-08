"""Transparent rule-based disease suitability scoring (JEV concept).

This layer scores whether the extracted evidence is sufficient to route a case
to a disease model. It is not a diagnostic probability or model accuracy
estimate. Every score is derived from feature completeness and extraction
confidence so the missing evidence is visible to the reviewer.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping

from backend.services.breast_feature_contract import BREAST_FEATURE_ORDER

logger = logging.getLogger("medsynapse.jev")


TABULAR_PROFILES: dict[str, tuple[str, ...]] = {
    "diabetes": (
        "glucose", "blood_pressure", "bmi", "insulin", "age",
        "skin_thickness", "dpf", "pregnancies",
    ),
    "heart": (
        "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg",
        "thalach", "exang", "oldpeak", "slope", "ca", "thal",
    ),
}


def _evidence(features: Mapping[str, Any], name: str) -> tuple[bool, float]:
    item = features.get(name)
    if item is None:
        return False, 0.0
    if isinstance(item, Mapping):
        status = item.get("status", "extracted")
        value = item.get("value")
        confidence = item.get("confidence", 1.0)
        present = status in {"extracted", "derived", "approximated"} and value is not None
    else:
        present = item is not None
        confidence = 1.0
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except (TypeError, ValueError):
        confidence = 0.0
    return present, confidence if present else 0.0


def _score_profile(name: str, required: tuple[str, ...], features: Mapping[str, Any], *, source: str) -> dict[str, Any]:
    available = []
    missing = []
    confidences = []
    for feature in required:
        present, confidence = _evidence(features, feature)
        if present:
            available.append(feature)
            confidences.append(confidence)
        else:
            missing.append(feature)

    completeness = len(available) / len(required) if required else 0.0
    extraction_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    suitability = completeness * extraction_confidence
    if missing:
        logger.warning("JEV %s missing required evidence: %s", name, ", ".join(missing))
    else:
        logger.info("JEV %s ready for routing at %.1f%% evidence suitability", name, suitability * 100)
    return {
        "disease": name,
        "source": source,
        "suitability_score": round(suitability, 4),
        "suitability_percentage": round(suitability * 100, 1),
        "confidence_percentage": round(suitability * 100, 1),
        "status": "ready_for_routing" if not missing else "needs_more_evidence",
        "available_features": available,
        "missing_features": missing,
        "required_feature_count": len(required),
        "available_feature_count": len(available),
        "note": "Evidence suitability score; not diagnostic accuracy or clinical probability.",
    }


def score_disease_suitability(
    parameters: Mapping[str, Any] | None = None,
    *,
    disease_type: str = "all",
    breast_features: Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Return deterministic JEV suitability scores for extracted evidence."""
    parameters = parameters or {}
    selected = disease_type.lower()
    scores = []
    if selected in {"all", "diabetes"}:
        scores.append(_score_profile("Diabetes Mellitus", TABULAR_PROFILES["diabetes"], parameters, source="OCR parameters"))
    if selected in {"all", "heart"}:
        scores.append(_score_profile("Coronary Heart Disease", TABULAR_PROFILES["heart"], parameters, source="OCR parameters"))
    if selected == "breast":
        # Gemma's validated WDBC objects carry their own status/confidence.
        scores.append(_score_profile("Breast Cancer", BREAST_FEATURE_ORDER, breast_features or {}, source="Gemma WDBC feature contract"))

    # Image-only models cannot be routed from a lab-report feature set.
    if selected == "all":
        scores.extend([
            {
                "disease": "Pneumonia",
                "source": "Chest X-ray required",
                "suitability_score": 0.0,
                "suitability_percentage": 0.0,
                "confidence_percentage": 0.0,
                "status": "image_required",
                "available_features": [],
                "missing_features": ["chest X-ray image"],
                "required_feature_count": 1,
                "available_feature_count": 0,
                "note": "Upload an X-ray; report OCR features cannot route an image model.",
            },
            {
                "disease": "Eye Disease",
                "source": "Fundus/ocular image required",
                "suitability_score": 0.0,
                "suitability_percentage": 0.0,
                "confidence_percentage": 0.0,
                "status": "image_required",
                "available_features": [],
                "missing_features": ["fundus or ocular image"],
                "required_feature_count": 1,
                "available_feature_count": 0,
                "note": "Upload an ocular image; report OCR features cannot route an image model.",
            },
        ])
    return sorted(scores, key=lambda item: item["suitability_score"], reverse=True)
