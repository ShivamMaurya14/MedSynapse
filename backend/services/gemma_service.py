"""Local Gemma adapter for post-OCR diabetes feature extraction.

The adapter uses Ollama's local ``/api/generate`` contract.  It keeps Gemma
behind one small boundary: another local Gemma runtime only needs to provide
the same JSON response, or this file can be adapted without changing OCR/API
routes or the diabetes feature contract.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from backend.services.diabetes_feature_contract import (
    DiabetesFeatureContractError,
    build_diabetes_model_features,
    diabetes_extraction_prompt,
    diabetes_extraction_json_schema,
    missing_or_unverified_features,
    parse_gemma_diabetes_extraction,
)
from backend.services.breast_feature_contract import (
    BreastFeatureContractError,
    breast_extraction_json_schema,
    breast_extraction_prompt,
    build_model_features as build_breast_model_features,
    extract_breast_features_from_text,
    missing_or_unverified as missing_breast_features,
    parse_breast_extraction,
    serialise_features as serialise_breast_features,
)
from backend.services.heart_feature_contract import (
    HeartFeatureContractError,
    build_heart_model_features,
    heart_extraction_json_schema,
    heart_extraction_prompt,
    missing_or_unverified as missing_heart_features,
    parse_heart_extraction,
    serialise_features as serialise_heart_features,
)


class GemmaServiceError(RuntimeError):
    """A local Gemma request failed or did not honour the extraction contract."""


class GemmaService:
    """Call a local Gemma model after OCR has produced report text."""

    def __init__(
        self,
        base_url: str | None = None,
        model_name: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self.base_url = (base_url or os.getenv("GEMMA_BASE_URL", "http://127.0.0.1:11434")).rstrip("/")
        self.model_name = model_name or os.getenv("GEMMA_MODEL", "")
        # Structured extraction with a local 4B model can take longer than a
        # normal HTTP request, especially on a CPU-only machine or after the
        # model has been unloaded.  The previous 45-second default aborted a
        # valid generation before Ollama could finish.
        self.timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else float(os.getenv("GEMMA_TIMEOUT_SECONDS", "180"))
        )

    @property
    def configured(self) -> bool:
        return bool(self.model_name)

    def extract_diabetes_features(self, ocr_text: str) -> dict[str, Any]:
        """Return validated diabetes evidence from existing OCR text.

        This does not run a prediction.  A response with missing fields is
        valid extraction output, but it is explicitly marked as not ready for
        inference so the doctor can complete the review.
        """

        if not self.configured:
            return {
                "status": "not_configured",
                "message": "Set GEMMA_MODEL to enable local Gemma extraction.",
                "features": {},
                "missing_or_unverified": [],
                "model_features": None,
            }

        if not ocr_text or not ocr_text.strip():
            raise GemmaServiceError("Cannot send empty OCR text to Gemma")

        response_payload = self._generate_json(ocr_text)
        try:
            features = parse_gemma_diabetes_extraction(response_payload)
        except DiabetesFeatureContractError as exc:
            raise GemmaServiceError(f"Gemma returned an invalid diabetes extraction: {exc}") from exc

        missing = missing_or_unverified_features(features)
        return {
            "status": "needs_review" if missing else "ready_for_inference",
            "message": (
                "Doctor review is required for missing or ambiguous fields."
                if missing
                else "All required diabetes features were extracted; doctor approval is still required."
            ),
            "features": {name: asdict(feature) for name, feature in features.items()},
            "missing_or_unverified": missing,
            "model_features": None if missing else build_diabetes_model_features(features),
        }

    def extract_breast_cancer_features(self, ocr_text: str) -> dict[str, Any]:
        """Extract WDBC values from a pathology report, never an image.

        Explicit OCR labels are used first. Gemma is only used to resolve
        values that the deterministic extractor cannot safely read.
        """
        if not ocr_text or not ocr_text.strip():
            raise GemmaServiceError("Cannot send empty OCR text to Gemma")
        features = extract_breast_features_from_text(ocr_text)
        missing = missing_breast_features(features)
        if not missing:
            return {
                "status": "ready_for_inference",
                "message": "All 30 WDBC FNA features were extracted from explicit OCR labels; doctor approval is still required.",
                "features": serialise_breast_features(features),
                "missing_or_unverified": [],
                "model_features": build_breast_model_features(features),
            }
        if not self.configured:
            return {
                "status": "needs_review",
                "message": "Some WDBC values were not explicitly labelled in OCR text. Set GEMMA_MODEL to attempt structured extraction, or complete them manually.",
                "features": serialise_breast_features(features),
                "missing_or_unverified": missing,
                "model_features": None,
            }
        response_payload = self._generate_json(ocr_text, breast_extraction_prompt(), breast_extraction_json_schema())
        try:
            gemma_features = parse_breast_extraction(response_payload)
        except BreastFeatureContractError as exc:
            raise GemmaServiceError(f"Gemma returned an invalid breast-cancer extraction: {exc}") from exc
        # Deterministic OCR matches have exact evidence and therefore take
        # precedence over LLM extraction for the same feature.
        features = {
            name: features[name] if features[name].status == "extracted" else gemma_features[name]
            for name in features
        }
        missing = missing_breast_features(features)
        return {
            "status": "needs_review" if missing else "ready_for_inference",
            "message": "Doctor review is required for missing or ambiguous fields." if missing else "All 30 WDBC FNA features were extracted; doctor approval is still required.",
            "features": serialise_breast_features(features),
            "missing_or_unverified": missing,
            "model_features": None if missing else build_breast_model_features(features),
        }

    def extract_heart_features(self, ocr_text: str) -> dict[str, Any]:
        """Extract and validate all 13 features required by the heart model."""
        if not self.configured:
            return {
                "status": "not_configured",
                "message": "Set GEMMA_MODEL to enable local Gemma extraction.",
                "features": {}, "missing_or_unverified": [], "model_features": None,
            }
        if not ocr_text or not ocr_text.strip():
            raise GemmaServiceError("Cannot send empty OCR text to Gemma")
        payload = self._generate_json(ocr_text, heart_extraction_prompt(), heart_extraction_json_schema())
        try:
            features = parse_heart_extraction(payload)
        except HeartFeatureContractError as exc:
            raise GemmaServiceError(f"Gemma returned an invalid heart extraction: {exc}") from exc
        missing = missing_heart_features(features)
        return {
            "status": "needs_review" if missing else "ready_for_inference",
            "message": "Doctor review is required for missing or ambiguous fields." if missing else "All 13 heart features were extracted; doctor approval is still required.",
            "features": serialise_heart_features(features),
            "missing_or_unverified": missing,
            "model_features": None if missing else build_heart_model_features(features),
        }

    def _generate_json(self, ocr_text: str, extraction_prompt: str | None = None,
                       json_schema: dict[str, Any] | None = None) -> dict[str, Any]:
        prompt = f"{extraction_prompt or diabetes_extraction_prompt()}\n\nOCR REPORT TEXT:\n{ocr_text}"
        request_payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            # Ollama accepts a JSON Schema here.  Generic JSON mode permits
            # the model to drop keys; this schema requires all seven fields.
            "format": json_schema or diabetes_extraction_json_schema(),
            "options": {"temperature": 0},
        }
        request = Request(
            f"{self.base_url}/api/generate",
            data=json.dumps(request_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raise GemmaServiceError(f"Gemma service returned HTTP {exc.code}") from exc
        except URLError as exc:
            raise GemmaServiceError(
                f"Cannot reach local Gemma at {self.base_url}: {exc.reason}"
            ) from exc
        except TimeoutError as exc:
            raise GemmaServiceError(
                f"Gemma generation exceeded the {self.timeout_seconds:g}-second timeout"
            ) from exc
        except json.JSONDecodeError as exc:
            raise GemmaServiceError("Gemma service returned invalid response JSON") from exc

        generated_json = body.get("response") if isinstance(body, dict) else None
        if not isinstance(generated_json, str):
            raise GemmaServiceError("Gemma response did not contain a JSON string in 'response'")

        # Ollama's structured-output format forces clean JSON, but strip markdown
        # code fences defensively in case the schema is bypassed (e.g. after a
        # model update) so a fenced response doesn't turn into a cryptic error.
        stripped = generated_json.strip()
        if stripped.startswith("```"):
            # Remove opening fence (```json or ```) and closing fence (```)
            stripped = stripped.split("\n", 1)[-1]
            if stripped.endswith("```"):
                stripped = stripped[: stripped.rfind("```")]
            stripped = stripped.strip()
        else:
            stripped = generated_json

        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError as exc:
            snippet = stripped[:120].replace("\n", "\\n")
            raise GemmaServiceError(
                f"Gemma returned non-JSON text (first 120 chars): {snippet!r}"
            ) from exc
        if not isinstance(parsed, dict):
            raise GemmaServiceError("Gemma JSON must be an object")
        return parsed
