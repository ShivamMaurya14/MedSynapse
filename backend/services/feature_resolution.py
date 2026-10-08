"""Resolve only defensible derived features before JEV scoring.

This module never fabricates a clinical value. Derived and approximated values
retain provenance and receive a confidence cap so they cannot look like direct
measurements in the routing score.
"""

from __future__ import annotations

import copy
import logging
from typing import Any, Mapping

logger = logging.getLogger("medsynapse.feature_resolution")

CONFIDENCE_CAPS = {
    "extracted": 1.0,
    "derived": 0.90,
    "approximated": 0.60,
}


def _value(features: Mapping[str, Any], name: str) -> float | None:
    item = features.get(name)
    if not isinstance(item, Mapping):
        return None
    try:
        return float(item.get("value")) if item.get("value") is not None else None
    except (TypeError, ValueError):
        return None


def _set_derived(resolved: dict[str, dict[str, Any]], name: str, value: float,
                 *, rule_id: str, source_features: list[str], confidence: float) -> None:
    resolved[name] = {
        "value": value,
        "confidence": confidence,
        "status": "derived",
        "rule_id": rule_id,
        "source_features": source_features,
        "matched_text": f"Derived by {rule_id}",
    }


def resolve_features(parameters: Mapping[str, Any] | None) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Normalize evidence, apply safe derivations, and return an audit log."""
    resolved: dict[str, dict[str, Any]] = {}
    audit: list[dict[str, Any]] = []
    for name, raw in (parameters or {}).items():
        if isinstance(raw, Mapping):
            item = copy.deepcopy(dict(raw))
        else:
            item = {"value": raw}
        status = item.get("status", "extracted")
        if status not in CONFIDENCE_CAPS:
            if status:
                item["clinical_status"] = status
            rule_id = str(item.get("rule_id", ""))
            status = "approximated" if "ESTIMATE" in rule_id else ("derived" if rule_id else "extracted")
        item["status"] = status
        if item.get("confidence") is None:
            item["confidence"] = CONFIDENCE_CAPS[status]
        else:
            item["confidence"] = min(float(item["confidence"]), CONFIDENCE_CAPS[status])
        resolved[name] = item

    # BMI is a valid deterministic derivation when both measurements exist.
    if _value(resolved, "bmi") is None:
        weight = _value(resolved, "weight")
        height_cm = _value(resolved, "height")
        if weight is not None and height_cm and height_cm > 0:
            bmi = round(weight / ((height_cm / 100.0) ** 2), 1)
            _set_derived(resolved, "bmi", bmi, rule_id="BMI_FROM_WEIGHT_HEIGHT",
                         source_features=["weight", "height"], confidence=0.90)

    # Existing parser values are explicitly labelled when they are derived.
    for name, item in resolved.items():
        if item.get("status") in {"derived", "approximated"}:
            audit.append({
                "feature": name,
                "status": item["status"],
                "rule_id": item.get("rule_id"),
                "source_features": item.get("source_features", []),
                "value": item.get("value"),
                "confidence": item.get("confidence", 0.0),
            })

    if audit:
        logger.info("Feature resolution applied: %s", audit)
    return resolved, audit
