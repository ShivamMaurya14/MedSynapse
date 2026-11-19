"""Strict WDBC FNA feature contract for breast-cancer inference."""

from __future__ import annotations

import json
import math
import re
from dataclasses import asdict, dataclass
from typing import Any, Mapping


BASE_MEASUREMENTS = (
    "radius", "texture", "perimeter", "area", "smoothness", "compactness",
    "concavity", "concave_points", "symmetry", "fractal_dimension",
)
BREAST_FEATURE_ORDER = tuple(f"{name}_{metric}" for metric in ("mean", "se", "worst") for name in BASE_MEASUREMENTS)
EXTRACTION_STATUSES = frozenset({"extracted", "missing", "ambiguous", "unsupported_document"})


class BreastFeatureContractError(ValueError):
    """Gemma output cannot safely be used as breast-cancer model input."""


@dataclass(frozen=True)
class ExtractedFeature:
    value: float | None
    unit: str | None
    source_text: str | None
    page: int | None
    confidence: float | None
    status: str


def breast_extraction_prompt() -> str:
    names = ", ".join(BREAST_FEATURE_ORDER)
    return f"""Extract Wisconsin Diagnostic Breast Cancer (WDBC) FNA morphology values from this pathology report.

Return JSON only: {{"features": {{"feature_name": {{"value": number or null, "unit": string or null, "source_text": string or null, "page": integer or null, "confidence": number or null, "status": "extracted|missing|ambiguous|unsupported_document"}}}}}}.
Include every feature exactly once: {names}.
Extract only explicitly stated values. Never infer, estimate, convert, or use mammogram/image observations. An extracted value requires exact source_text, a one-based page, and confidence from 0 to 1. Mark unavailable values as missing."""


def breast_extraction_json_schema() -> dict[str, Any]:
    feature_schema = {
        "type": "object", "additionalProperties": False,
        "required": ["value", "unit", "source_text", "page", "confidence", "status"],
        "properties": {
            "value": {"type": ["number", "null"]}, "unit": {"type": ["string", "null"]},
            "source_text": {"type": ["string", "null"]}, "page": {"type": ["integer", "null"], "minimum": 1},
            "confidence": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
            "status": {"type": "string", "enum": list(EXTRACTION_STATUSES)},
        },
    }
    return {"type": "object", "additionalProperties": False, "required": ["features"], "properties": {
        "features": {"type": "object", "additionalProperties": False, "required": list(BREAST_FEATURE_ORDER),
                     "properties": {name: feature_schema for name in BREAST_FEATURE_ORDER}}
    }}


def extract_breast_features_from_text(ocr_text: str) -> dict[str, ExtractedFeature]:
    """Extract explicitly labelled WDBC values directly from OCR text.

    This handles conventional labels such as ``radius_mean: 14.2`` and
    ``Mean radius = 14.2``. It intentionally leaves unlabelled table cells as
    missing; their column alignment cannot be safely inferred from plain OCR.
    """
    missing = {
        name: ExtractedFeature(None, None, None, None, None, "missing")
        for name in BREAST_FEATURE_ORDER
    }
    if not ocr_text or not ocr_text.strip():
        return missing

    base_patterns = {
        "radius": r"radius", "texture": r"texture", "perimeter": r"perimeter",
        "area": r"area", "smoothness": r"smoothness", "compactness": r"compactness",
        "concavity": r"concavity", "concave_points": r"concave[ _-]*points?",
        "symmetry": r"symmetry", "fractal_dimension": r"fractal[ _-]*dimension",
    }
    metric_patterns = {
        "mean": r"mean|average|avg", "se": r"se|standard[ _-]*error|stderr",
        "worst": r"worst|largest|max(?:imum)?",
    }
    number = r"([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)"
    for line_number, line in enumerate(ocr_text.splitlines(), start=1):
        for metric, metric_pattern in metric_patterns.items():
            for base, base_pattern in base_patterns.items():
                name = f"{base}_{metric}"
                if missing[name].status == "extracted":
                    continue
                separator = r"(?:[ _-]+|\s*\(\s*)"
                suffix = r"\s*\)?\s*(?::|=|is)?\s*"
                patterns = (
                    rf"\b{base_pattern}{separator}(?:{metric_pattern}){suffix}{number}",
                    rf"\b(?:{metric_pattern}){separator}{base_pattern}{suffix}{number}",
                )
                match = next((re.search(pattern, line, flags=re.IGNORECASE) for pattern in patterns if re.search(pattern, line, flags=re.IGNORECASE)), None)
                if match is None:
                    continue
                try:
                    value = float(match.group(1))
                except (TypeError, ValueError):
                    continue
                if not math.isfinite(value):
                    continue
                missing[name] = ExtractedFeature(
                    value=value, unit=None, source_text=line.strip(), page=line_number,
                    confidence=1.0, status="extracted",
                )
    return missing


def parse_breast_extraction(payload: str | Mapping[str, Any]) -> dict[str, ExtractedFeature]:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise BreastFeatureContractError("Gemma response is not valid JSON") from exc
    raw = payload.get("features") if isinstance(payload, Mapping) else None
    if not isinstance(raw, Mapping) or set(raw) != set(BREAST_FEATURE_ORDER):
        raise BreastFeatureContractError("Gemma response must contain exactly the 30 WDBC feature objects")
    parsed = {}
    for name in BREAST_FEATURE_ORDER:
        item = raw[name]
        if not isinstance(item, Mapping) or item.get("status") not in EXTRACTION_STATUSES:
            raise BreastFeatureContractError(f"Invalid extraction object for {name}")
        value = item.get("value")
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value))):
            raise BreastFeatureContractError(f"{name}.value must be a finite number or null")
        confidence = item.get("confidence")
        if confidence is not None and (not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1):
            raise BreastFeatureContractError(f"{name}.confidence must be between 0 and 1")
        parsed[name] = ExtractedFeature(float(value) if value is not None else None, item.get("unit"), item.get("source_text"), item.get("page"), confidence, item["status"])
    return parsed


def missing_or_unverified(features: Mapping[str, ExtractedFeature]) -> list[str]:
    return [name for name in BREAST_FEATURE_ORDER if name not in features or features[name].status != "extracted" or features[name].value is None]


def build_model_features(features: Mapping[str, ExtractedFeature]) -> dict[str, float]:
    missing = missing_or_unverified(features)
    if missing:
        raise BreastFeatureContractError(f"Missing or unverified WDBC features: {', '.join(missing)}")
    return {name: float(features[name].value) for name in BREAST_FEATURE_ORDER}


def serialise_features(features: Mapping[str, ExtractedFeature]) -> dict[str, dict[str, Any]]:
    return {name: asdict(value) for name, value in features.items()}
