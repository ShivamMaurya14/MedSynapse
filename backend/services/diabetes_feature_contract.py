"""Gemma extraction contract for the DPF-free diabetes model.

Gemma extracts seven report-backed values.  This module validates that JSON,
normalizes its units, and derives ``BMI_Cat`` as the eighth model feature.
It deliberately does not impute values: missing or ambiguous evidence must be
reviewed by a clinician before an inference request is assembled.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from typing import Any, Mapping


# Exact order required by the DPF-free diabetes scaler/model artifacts.
RAW_FEATURE_ORDER = (
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "Age",
)
MODEL_FEATURE_ORDER = RAW_FEATURE_ORDER + ("BMI_Cat",)

EXTRACTION_STATUSES = frozenset(
    {"extracted", "missing", "ambiguous", "unsupported_document"}
)

CANONICAL_UNITS = {
    "Pregnancies": "count",
    "Glucose": "mg/dL",
    "BloodPressure": "mmHg",
    "SkinThickness": "mm",
    "Insulin": "uIU/mL",
    "BMI": "kg/m2",
    "Age": "years",
}


class DiabetesFeatureContractError(ValueError):
    """Gemma output cannot safely be used as diabetes-model input."""


@dataclass(frozen=True)
class ExtractedFeature:
    value: float | None
    unit: str | None
    source_text: str | None
    page: int | None
    confidence: float | None
    status: str


def diabetes_extraction_prompt() -> str:
    """Prompt fragment for the existing Gemma implementation.

    The caller supplies report text or OCR output.  Gemma must return JSON
    only, matching the schema below.
    """

    return """Extract DPF-free diabetes-model inputs from this clinical report.

Return JSON only. The top-level object must contain a "features" object with
exactly these seven keys: Pregnancies, Glucose, BloodPressure, SkinThickness,
Insulin, BMI, and Age. You MUST include every key.

For each feature:
- When an explicit value is present, return its numeric value, canonical unit,
  exact source text, one-based page, confidence, and status "extracted".
- Only when no explicit value is present, return null for value, source_text,
  page, and confidence, and use status "missing".
- Never return a numeric value together with status "missing".
- Scan the entire report before marking any feature missing.

Rules:
- Extract only values explicitly present in the report. Never infer a value.
- For Pregnancies, clinical labels such as "Gravida", "gravidity", or
  "number of pregnancies" are explicit evidence for the total pregnancy
  count. Do not use parity or number of live births as a substitute.
- BloodPressure is the diastolic pressure used by the diabetes training
  dataset. For a systolic/diastolic reading such as 142/90, extract 90.
- Allowed status values: extracted, missing, ambiguous, unsupported_document.
- Never omit a feature object. When evidence is absent, use value: null and
  status: "missing" for that feature.
- An extracted value requires exact source_text, one-based page, and confidence from 0 to 1.
- Do not return DiabetesPedigreeFunction or DPF. This model is DPF-free.
- Do not return BMI_Cat. The application derives it from BMI.
- Zero is valid only for Pregnancies. For Glucose, BloodPressure,
  SkinThickness, Insulin, and BMI, zero means missing/invalid evidence.
"""


def diabetes_extraction_json_schema() -> dict[str, Any]:
    """The strict structured-output schema sent to the local Gemma runtime."""

    nullable_string = {"type": ["string", "null"]}
    nullable_page = {"type": ["integer", "null"], "minimum": 1}
    feature_schema = {
        "oneOf": [
            {
                "type": "object",
                "additionalProperties": False,
                "required": ["value", "unit", "source_text", "page", "confidence", "status"],
                "properties": {
                    "value": {"type": "number"},
                    "unit": {"type": "string", "minLength": 1},
                    "source_text": {"type": "string", "minLength": 1},
                    "page": {"type": "integer", "minimum": 1},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "status": {"const": "extracted"},
                },
            },
            {
                "type": "object",
                "additionalProperties": False,
                "required": ["value", "unit", "source_text", "page", "confidence", "status"],
                "properties": {
                    # A non-extracted feature cannot safely carry a model
                    # value.  The old nullable-number schema allowed Gemma to
                    # emit value=168 with status="missing", which passed
                    # Ollama's schema but was correctly rejected below.
                    "value": {"type": "null"},
                    "unit": nullable_string,
                    "source_text": nullable_string,
                    "page": nullable_page,
                    "confidence": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
                    "status": {
                        "type": "string",
                        "enum": ["missing", "ambiguous", "unsupported_document"],
                    },
                },
            },
        ]
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["features"],
        "properties": {
            "features": {
                "type": "object",
                "additionalProperties": False,
                "required": list(RAW_FEATURE_ORDER),
                "properties": {name: feature_schema for name in RAW_FEATURE_ORDER},
            }
        },
    }


def parse_gemma_diabetes_extraction(
    payload: str | Mapping[str, Any],
) -> dict[str, ExtractedFeature]:
    """Parse Gemma JSON and reject unknown, incomplete, or unsafe fields."""

    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise DiabetesFeatureContractError("Gemma response is not valid JSON") from exc

    if not isinstance(payload, Mapping):
        raise DiabetesFeatureContractError("Gemma response must be a JSON object")

    raw_features = payload.get("features")
    if not isinstance(raw_features, Mapping):
        raise DiabetesFeatureContractError("Gemma response must contain a 'features' object")

    unexpected = set(raw_features) - set(RAW_FEATURE_ORDER)
    if unexpected:
        raise DiabetesFeatureContractError(
            f"Unexpected diabetes feature(s): {', '.join(sorted(unexpected))}"
        )

    features: dict[str, ExtractedFeature] = {}
    for name in RAW_FEATURE_ORDER:
        item = raw_features.get(name)
        if not isinstance(item, Mapping):
            raise DiabetesFeatureContractError(f"Missing feature object for {name}")
        features[name] = _parse_feature(name, item)
    return features


def missing_or_unverified_features(
    features: Mapping[str, ExtractedFeature],
) -> list[str]:
    """Fields the doctor must complete or confirm before model inference."""

    return [
        name
        for name in RAW_FEATURE_ORDER
        if name not in features
        or features[name].status != "extracted"
        or features[name].value is None
    ]


def build_diabetes_model_features(
    features: Mapping[str, ExtractedFeature],
) -> dict[str, float]:
    """Build the ordered DPF-free feature mapping for scaler.transform()."""

    unavailable = missing_or_unverified_features(features)
    if unavailable:
        raise DiabetesFeatureContractError(
            "Cannot run diabetes inference; clinician confirmation is required for: "
            + ", ".join(unavailable)
        )

    output = {name: float(features[name].value) for name in RAW_FEATURE_ORDER}
    output["BMI_Cat"] = float(bmi_category(output["BMI"]))
    return output


def bmi_category(bmi: float) -> int:
    """Training-time BMI categories: underweight, normal, overweight, obese."""

    if bmi < 18.5:
        return 0
    if bmi < 25.0:
        return 1
    if bmi < 30.0:
        return 2
    return 3


def _parse_feature(name: str, item: Mapping[str, Any]) -> ExtractedFeature:
    status = item.get("status")
    if status not in EXTRACTION_STATUSES:
        allowed = ", ".join(sorted(EXTRACTION_STATUSES))
        raise DiabetesFeatureContractError(f"{name}.status must be one of: {allowed}")

    value = _number_or_none(name, item.get("value"))
    confidence = _number_or_none(name, item.get("confidence"))
    if confidence is not None and not 0.0 <= confidence <= 1.0:
        raise DiabetesFeatureContractError(f"{name}.confidence must be between 0 and 1")

    page = item.get("page")
    if page is not None and (not isinstance(page, int) or isinstance(page, bool) or page < 1):
        raise DiabetesFeatureContractError(f"{name}.page must be a positive integer or null")

    source_text = item.get("source_text")
    if source_text is not None and not isinstance(source_text, str):
        raise DiabetesFeatureContractError(f"{name}.source_text must be a string or null")

    unit = item.get("unit")
    if unit is not None and not isinstance(unit, str):
        raise DiabetesFeatureContractError(f"{name}.unit must be a string or null")

    if status == "extracted":
        if value is None or not source_text or page is None or confidence is None:
            raise DiabetesFeatureContractError(
                f"{name} marked extracted requires value, source_text, page, and confidence"
            )
        value, unit = _normalise_value_and_unit(name, value, unit)
        if name == "BloodPressure":
            value = _normalise_diastolic_pressure(value, source_text)
        _validate_value(name, value)
    elif value is not None:
        raise DiabetesFeatureContractError(
            f"{name} has a value but status is {status!r}; remove the value or use 'extracted'"
        )

    return ExtractedFeature(value, unit, source_text, page, confidence, status)


def _normalise_diastolic_pressure(value: float, source_text: str) -> float:
    """Use the diastolic component required by the Pima diabetes contract."""

    pair = re.search(r"\b([0-9]{2,3})\s*/\s*([0-9]{2,3})\b", source_text)
    if pair is None:
        return value

    systolic = float(pair.group(1))
    diastolic = float(pair.group(2))
    if value not in {systolic, diastolic}:
        raise DiabetesFeatureContractError(
            "BloodPressure value does not match the explicit systolic/diastolic source text"
        )
    return diastolic


def _number_or_none(name: str, value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise DiabetesFeatureContractError(f"{name} must be numeric, not boolean")
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise DiabetesFeatureContractError(f"{name} must be numeric or null") from exc
    if not math.isfinite(numeric):
        raise DiabetesFeatureContractError(f"{name} must be finite")
    return numeric


def _normalise_value_and_unit(name: str, value: float, unit: str | None) -> tuple[float, str]:
    cleaned = (unit or CANONICAL_UNITS[name]).replace("μ", "u").replace("µ", "u").strip()
    normalized = cleaned.lower().replace("²", "2")
    # Clinical reports commonly vary harmless unit typography (for example,
    # "mm Hg" versus "mmHg"). Compare a compact form while always returning
    # the canonical training-contract unit.
    compact = normalized.replace(" ", "")

    if name == "Glucose" and compact == "mmol/l":
        return value * 18.0182, "mg/dL"
    if name == "Insulin" and compact in {"uiu/ml", "uu/ml", "miu/l"}:
        return value, "uIU/mL"
    if name == "BMI" and compact in {"kg/m2", "kg/m^2"}:
        return value, "kg/m2"
    if compact == CANONICAL_UNITS[name].lower().replace(" ", ""):
        return value, CANONICAL_UNITS[name]

    raise DiabetesFeatureContractError(
        f"Unsupported unit for {name}: {unit!r}; expected {CANONICAL_UNITS[name]!r}"
    )


def _validate_value(name: str, value: float) -> None:
    # Data-quality limits, not clinical decision thresholds.
    ranges = {
        "Pregnancies": (0, 30),
        "Glucose": (0, 600),
        "BloodPressure": (0, 300),
        "SkinThickness": (0, 100),
        "Insulin": (0, 1500),
        "BMI": (0, 100),
        "Age": (1, 120),
    }
    minimum, maximum = ranges[name]
    if not minimum <= value <= maximum:
        raise DiabetesFeatureContractError(
            f"{name} value {value} is outside [{minimum}, {maximum}]"
        )

    if name in {"Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"} and value == 0:
        raise DiabetesFeatureContractError(
            f"{name}=0 is missing/invalid for this training pipeline; mark it missing"
        )
