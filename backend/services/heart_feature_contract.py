"""Strict Gemma extraction contract for the 13-feature heart model."""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass
from typing import Any, Mapping

HEART_FEATURE_ORDER = (
    "Age", "Sex", "CP", "RestingBP", "Cholesterol", "FastingBloodSugar",
    "RestingECG", "MaxHeartRate", "ExerciseAngina", "STDepression", "Slope",
    "MajorVessels", "Thalassemia",
)

HEART_API_NAMES = {
    "Age": "age", "Sex": "sex", "CP": "cp", "RestingBP": "trestbps",
    "Cholesterol": "chol", "FastingBloodSugar": "fbs", "RestingECG": "restecg",
    "MaxHeartRate": "thalach", "ExerciseAngina": "exang", "STDepression": "oldpeak",
    "Slope": "slope", "MajorVessels": "ca", "Thalassemia": "thal",
}

HEART_UNITS = {
    "Age": "years", "Sex": "category", "CP": "category", "RestingBP": "mmHg",
    "Cholesterol": "mg/dL", "FastingBloodSugar": "category", "RestingECG": "category",
    "MaxHeartRate": "bpm", "ExerciseAngina": "category", "STDepression": "mm",
    "Slope": "category", "MajorVessels": "count", "Thalassemia": "category",
}

EXTRACTION_STATUSES = frozenset({"extracted", "missing", "ambiguous", "unsupported_document"})


class HeartFeatureContractError(ValueError):
    """Gemma output cannot safely be used as heart-model input."""


@dataclass(frozen=True)
class ExtractedFeature:
    value: float | None
    unit: str | None
    source_text: str | None
    page: int | None
    confidence: float | None
    status: str


def heart_extraction_prompt() -> str:
    names = ", ".join(HEART_FEATURE_ORDER)
    return f"""Extract coronary-heart-disease model inputs from this clinical report.

Return JSON only with one object for every feature: {names}.
Each object must contain value, unit, source_text, page, confidence, and status.
Allowed status values are extracted, missing, ambiguous, unsupported_document.
Extract only explicitly stated values. Never infer or use defaults. An extracted
value requires exact source_text, one-based page, and confidence from 0 to 1.
Use the standard UCI heart-disease meanings: CP=chest-pain category, FastingBloodSugar
is 0/1 for fasting glucose >120 mg/dL, RestingECG=0/1/2, ExerciseAngina=0/1,
Slope=0/1/2, MajorVessels=0-3, and Thalassemia uses the dataset category code."""


def heart_extraction_json_schema() -> dict[str, Any]:
    feature_schema = {
        "type": "object", "additionalProperties": False,
        "required": ["value", "unit", "source_text", "page", "confidence", "status"],
        "properties": {
            "value": {"type": ["number", "null"]},
            "unit": {"type": ["string", "null"]},
            "source_text": {"type": ["string", "null"]},
            "page": {"type": ["integer", "null"], "minimum": 1},
            "confidence": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
            "status": {"type": "string", "enum": list(EXTRACTION_STATUSES)},
        },
    }
    return {
        "type": "object", "additionalProperties": False, "required": ["features"],
        "properties": {
            "features": {
                "type": "object", "additionalProperties": False,
                "required": list(HEART_FEATURE_ORDER),
                "properties": {name: feature_schema for name in HEART_FEATURE_ORDER},
            }
        },
    }


def parse_heart_extraction(payload: str | Mapping[str, Any]) -> dict[str, ExtractedFeature]:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise HeartFeatureContractError("Gemma response is not valid JSON") from exc
    raw = payload.get("features") if isinstance(payload, Mapping) else None
    if not isinstance(raw, Mapping) or set(raw) != set(HEART_FEATURE_ORDER):
        raise HeartFeatureContractError("Gemma response must contain exactly the 13 heart feature objects")
    parsed: dict[str, ExtractedFeature] = {}
    for name in HEART_FEATURE_ORDER:
        item = raw[name]
        if not isinstance(item, Mapping) or item.get("status") not in EXTRACTION_STATUSES:
            raise HeartFeatureContractError(f"Invalid extraction object for {name}")
        value = item.get("value")
        confidence = item.get("confidence")
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value))):
            raise HeartFeatureContractError(f"{name}.value must be a finite number or null")
        if confidence is not None and (not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1):
            raise HeartFeatureContractError(f"{name}.confidence must be between 0 and 1")
        if item.get("status") == "extracted" and (value is None or not item.get("source_text") or item.get("page") is None or confidence is None):
            raise HeartFeatureContractError(f"{name} marked extracted requires value, source_text, page, and confidence")
        if item.get("status") != "extracted" and value is not None:
            raise HeartFeatureContractError(f"{name} has a value but status is not extracted")
        parsed[name] = ExtractedFeature(
            float(value) if value is not None else None,
            item.get("unit") or HEART_UNITS[name], item.get("source_text"), item.get("page"),
            float(confidence) if confidence is not None else None, item["status"],
        )
    return parsed


def missing_or_unverified(features: Mapping[str, ExtractedFeature]) -> list[str]:
    return [name for name in HEART_FEATURE_ORDER if name not in features or features[name].status != "extracted" or features[name].value is None]


def build_heart_model_features(features: Mapping[str, ExtractedFeature]) -> dict[str, float]:
    missing = missing_or_unverified(features)
    if missing:
        raise HeartFeatureContractError("Cannot run heart inference; clinician confirmation is required for: " + ", ".join(missing))
    return {HEART_API_NAMES[name]: float(features[name].value) for name in HEART_FEATURE_ORDER}


def serialise_features(features: Mapping[str, ExtractedFeature]) -> dict[str, dict[str, Any]]:
    return {name: asdict(value) for name, value in features.items()}
