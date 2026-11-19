"""Groq-only client for the clinician-approved final screening report."""

from __future__ import annotations

import json
import os
import re
import socket
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()


GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"

DIAGNOSTIC_OVERCLAIM_PATTERNS = (
    re.compile(r"\bclassified the patient as having\b", re.IGNORECASE),
    re.compile(r"\b(?:patient|individual) (?:has|suffers from|is diagnosed with|was diagnosed with)\b", re.IGNORECASE),
    re.compile(r"\b(?:diagnosis|diagnosed) (?:of|with)\b", re.IGNORECASE),
    re.compile(r"\bconfirm(?:s|ed)? (?:the )?(?:presence of|diagnosis)\b", re.IGNORECASE),
    re.compile(r"\bdefinitive diagnosis\b", re.IGNORECASE),
)

CLINICAL_UNIT_PATTERN = re.compile(
    r"(?<!\w)(?:mg/dL|kg/m²|kg/m2|μU/mL|uU/mL|mmHg|mm Hg|bpm|years?|mm)(?!\w)",
    re.IGNORECASE,
)

FINAL_REPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "screening_summary": {"type": "string"},
        "model_findings": {"type": "string"},
        "explainability_summary": {"type": "string"},
        "clinician_review": {"type": "string"},
        "recommendations": {"type": "array", "items": {"type": "string"}},
        "limitations": {"type": "array", "items": {"type": "string"}},
        "disclaimer": {"type": "string"},
        "physician_perspective_analysis": {"type": "string"},
    },
    "required": [
        "title",
        "screening_summary",
        "model_findings",
        "explainability_summary",
        "clinician_review",
        "recommendations",
        "limitations",
        "disclaimer",
        "physician_perspective_analysis",
    ],
    "additionalProperties": False,
}


class GroqReportServiceError(RuntimeError):
    """Raised when Groq configuration, transport, or output validation fails."""


class GroqReportService:
    """Generate one schema-constrained report from an approved model-run package."""

    def __init__(
        self,
        *,
        api_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self.api_url = (
            api_url or os.getenv("LLM_API_URL") or GROQ_CHAT_COMPLETIONS_URL
        ).strip()
        self.api_key = (
            api_key or os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY") or ""
        ).strip()
        self.model = (
            model or os.getenv("LLM_MODEL") or DEFAULT_GROQ_MODEL
        ).strip()
        configured_timeout = timeout_seconds or os.getenv("LLM_TIMEOUT_SECONDS") or 30
        try:
            self.timeout_seconds = float(configured_timeout)
        except (TypeError, ValueError) as exc:
            raise GroqReportServiceError("LLM_TIMEOUT_SECONDS must be numeric.") from exc
        if not 1 <= self.timeout_seconds <= 120:
            raise GroqReportServiceError("LLM_TIMEOUT_SECONDS must be between 1 and 120.")
        self._validate_groq_url()

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.model)

    def public_configuration(self) -> dict[str, Any]:
        """Return non-secret provider status for health and diagnostics."""
        return {
            "provider": "groq",
            "configured": self.configured,
            "api_url": self.api_url,
            "model": self.model,
            "timeout_seconds": self.timeout_seconds,
        }

    def generate_final_report(self, approved_package: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise GroqReportServiceError(
                "Groq is not configured. Set LLM_API_KEY to your Groq API key."
            )
        if not isinstance(approved_package, dict):
            raise GroqReportServiceError("The approved report package must be a JSON object.")
        clinician_decision = approved_package.get("clinician_decision") or {}
        if clinician_decision.get("decision") != "approved":
            raise GroqReportServiceError(
                "Groq final-report generation requires an approved clinician decision."
            )

        # Resolve doctor identity dynamically from previous ML report, decision, or tweaks
        tweaked = approved_package.get("tweaked_decisions") or {}
        doctor_info = tweaked.get("doctorInfo") or approved_package.get("doctor_info") or {}
        doctor_name = (
            doctor_info.get("name")
            or clinician_decision.get("reviewed_by")
            or approved_package.get("clinician_verification", {}).get("verified_by")
            or approved_package.get("clinical_report", {}).get("clinician_review", {}).get("reviewed_by")
            or approved_package.get("prediction", {}).get("reviewed_by")
            or ""
        ).strip()
        if doctor_name in ("MedSynapse Clinical Protocol", "Reviewing Clinician", "Attending Physician"):
            alt_name = (approved_package.get("clinical_report", {}).get("clinician_review", {}).get("reviewed_by") or "").strip()
            if alt_name and alt_name not in ("MedSynapse Clinical Protocol", "Reviewing Clinician", "Attending Physician"):
                doctor_name = alt_name
            else:
                doctor_name = ""

        doctor_title = (
            doctor_info.get("title")
            or clinician_decision.get("title")
            or approved_package.get("clinical_report", {}).get("clinician_review", {}).get("title")
            or "Attending Physician"
        ).strip()

        if doctor_name:
            doctor_context = (
                f"\nATTENDING PHYSICIAN ON RECORD: {doctor_name} ({doctor_title}).\n"
                f"DOCTOR ATTRIBUTION MANDATE: Consistently and accurately reference '{doctor_name}' ({doctor_title}) "
                "as the attending clinician in 'clinician_review', 'screening_summary', and 'physician_perspective_analysis'. "
                "Do NOT invent, replace, or hallucinate any other physician names.\n"
            )
        else:
            doctor_context = (
                f"\nATTENDING PHYSICIAN ON RECORD: Attending Physician ({doctor_title}).\n"
                "DOCTOR ATTRIBUTION MANDATE: Reference the clinician professionally as 'the attending physician' or 'attending clinician'. "
                "Do NOT invent or hallucinate fictional personal doctor names.\n"
            )

        tweaked_part = ""
        tweaked = approved_package.get("tweaked_decisions") or {}
        if tweaked.get("hasTweaks"):
            tweaked_part = (
                f"\nATTENDING PHYSICIAN MANUAL DECISION OVERRIDES & RECORDED RATIONALES:\n"
                f"{json.dumps(tweaked, ensure_ascii=False)}\n"
                "CRITICAL INSTRUCTION: Analyze the entire case strictly from the attending physician's clinical point of view. "
                "In 'physician_perspective_analysis', formulate an in-depth clinical analysis articulating why the attending physician "
                "adjusted or confirmed the diagnostic assessment, explaining the pathophysiological reasoning, biomarker risk profiles, "
                "and therapeutic priorities from the doctor's perspective. Also explicitly integrate the doctor's point of view and "
                "overrides into 'screening_summary' and 'clinician_review'.\n"
            )
        else:
            tweaked_part = (
                "\nIn 'physician_perspective_analysis', evaluate the clinical screening package strictly from the attending physician's point of view: "
                "review the model findings, assess biometric concordance, and articulate clinical surveillance priorities from the clinician's perspective.\n"
            )

        edited_part = ""
        edited = approved_package.get("edited_sections") or {}
        if edited:
            edited_part = (
                f"\nCLINICIAN INDEPENDENT SECTION EDITS & REASONS:\n"
                f"{json.dumps(edited, ensure_ascii=False)}\n"
                "Incorporate the edited sections and explicitly reflect the physician's reasons in the report.\n"
            )

        chat_part = ""
        chat_history = approved_package.get("chat_history") or []
        if chat_history:
            recent_chats = [
                m for m in chat_history 
                if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content")
            ]
            if recent_chats:
                chat_part = (
                    f"\nRECENT CLINICAL COPILOT DIALOGUE & RECOMMENDATIONS:\n"
                    f"{json.dumps(recent_chats[-8:], ensure_ascii=False)}\n"
                    "Incorporate the clinical consensus, follow-up timelines, management plans, "
                    "and physician perspective discussed in this dialogue directly into the report.\n"
                )

        def _strip_binary_data(obj: Any) -> Any:
            if isinstance(obj, dict):
                return {
                    k: _strip_binary_data(v)
                    for k, v in obj.items()
                    if not (isinstance(v, str) and (v.startswith("data:image/") or len(v) > 2000))
                }
            if isinstance(obj, list):
                return [_strip_binary_data(item) for item in obj]
            return obj

        sanitized_package = _strip_binary_data(approved_package)

        section_reasoning = (
            "\nCLINICAL REASONING MANDATE FOR EACH SECTION:\n"
            "Use your advanced medical reasoning to formulate each section with high clinical rigor:\n"
            "1. 'screening_summary': Clinically synthesize the patient presentation, multivariable risk profile, and acute vs. preventative clinical priorities.\n"
            "2. 'model_findings': Rigorously explain the statistical and biometrical significance of the model output, decision threshold cutoff, and predictive probability.\n"
            "3. 'explainability_summary': Medically explain the pathophysiological mechanisms of the verified SHAP biomarker drivers or Grad-CAM anatomical lesion hotspots in clear clinical terms.\n"
            "4. 'clinician_review': Synthesize the clinician's review, evaluating concordance between algorithmic predictions, patient biometrics, and clinical practice standards.\n"
            "5. 'physician_perspective_analysis': Provide a comprehensive, in-depth evaluation strictly from the attending physician's clinical point of view, detailing diagnostic rationale, differential considerations, and management imperatives.\n"
            "6. 'recommendations': Formulate concrete, guideline-grounded therapeutic, lifestyle, and secondary diagnostic monitoring schedules with specific timeframes.\n"
        )

        instructions = (
            "Write a comprehensive, professional, clinician-reviewed medical screening report using the approved JSON package below. "
            "Formulate detailed clinical paragraphs rather than brief single-line fragments. "
            "Highlight the clinician's review verification and explicitly describe the physician-verified "
            "SHAP biomarker feature drivers or Grad-CAM saliency evidence from the explainability section. "
            + doctor_context
            + section_reasoning
            + tweaked_part
            + edited_part
            + chat_part +
            "In 'recommendations', provide specific, individualized, actionable clinical management steps with surveillance timing. "
            "Do not change or invent model inputs, probability, prediction, SHAP values, Grad-CAM evidence, "
            "units, or clinician decision. Use a measurement unit only when that exact unit appears in the "
            "corresponding clinical_inputs item; omit the unit when it is null. Never say the patient has, "
            "is diagnosed with, or was classified as having a disease. Describe the result only as an AI "
            "screening model output or predicted risk. The disclaimer must explicitly state that this is not "
            "a diagnosis. The explainability summary must explicitly state that SHAP or Grad-CAM describes "
            "model behavior and does not establish medical causality. Return only the JSON object required "
            "by the supplied response schema.\n\nAPPROVED PACKAGE:\n"
            + json.dumps(sanitized_package, ensure_ascii=False, separators=(",", ":"))
        )
        request_body = {
            "model": self.model,
            "temperature": 0.1,
            "max_completion_tokens": 2048,
            "messages": [{"role": "user", "content": instructions}],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "clinician_reviewed_screening_report",
                    "strict": True,
                    "schema": FINAL_REPORT_SCHEMA,
                },
            },
        }
        request = urllib.request.Request(
            self.api_url,
            data=json.dumps(request_body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": "MedSynapse",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            message = self._groq_http_error_message(exc)
            raise GroqReportServiceError(
                f"Groq API request failed with HTTP {exc.code}: {message}"
            ) from exc
        except (urllib.error.URLError, socket.timeout, TimeoutError) as exc:
            raise GroqReportServiceError(f"Groq API request failed: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise GroqReportServiceError("Groq returned a non-JSON API response.") from exc

        try:
            content = payload["choices"][0]["message"]["content"]
            if not isinstance(content, str):
                raise TypeError("message content is not text")
            generated = json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise GroqReportServiceError(
                "Groq returned an invalid chat-completion payload."
            ) from exc
        self._validate_generated_report(generated, approved_package)

        usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
        return {
            "model_run_id": approved_package.get("model_run_id"),
            "provider": "groq",
            "provider_model": payload.get("model") or self.model,
            "provider_request_id": payload.get("id"),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "usage": {
                key: usage[key]
                for key in ("prompt_tokens", "completion_tokens", "total_tokens")
                if key in usage
            },
            "report": generated,
        }

    def _validate_groq_url(self) -> None:
        parsed = urlparse(self.api_url)
        if (
            parsed.scheme != "https"
            or parsed.hostname != "api.groq.com"
            or parsed.path.rstrip("/") != "/openai/v1/chat/completions"
        ):
            raise GroqReportServiceError(
                "LLM_API_URL must be Groq's HTTPS chat-completions endpoint: "
                f"{GROQ_CHAT_COMPLETIONS_URL}"
            )

    @staticmethod
    def _groq_http_error_message(exc: urllib.error.HTTPError) -> str:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
            message = payload.get("error", {}).get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()[:500]
        except (AttributeError, UnicodeDecodeError, json.JSONDecodeError):
            pass
        return "Groq rejected the request."

    @staticmethod
    def _validate_generated_report(
        generated: Any, approved_package: dict[str, Any]
    ) -> None:
        required = set(FINAL_REPORT_SCHEMA["required"])
        if not isinstance(generated, dict) or set(generated) != required:
            raise GroqReportServiceError(
                "Groq final report did not match the required JSON structure."
            )
        list_fields = {"recommendations", "limitations"}
        if not all(
            isinstance(generated[name], str) for name in required - list_fields
        ):
            raise GroqReportServiceError("Groq final report contains invalid text sections.")
        for name in list_fields:
            if not isinstance(generated[name], list) or not all(
                isinstance(item, str) for item in generated[name]
            ):
                raise GroqReportServiceError(
                    f"Groq final report field {name} must be an array of strings."
                )

        all_text = " ".join(
            value if isinstance(value, str) else " ".join(value)
            for value in generated.values()
        )
        has_tweaks = bool(
            (approved_package.get("tweaked_decisions") or {}).get("hasTweaks")
            or approved_package.get("edited_sections")
        )
        if not has_tweaks:
            for pattern in DIAGNOSTIC_OVERCLAIM_PATTERNS:
                if pattern.search(all_text):
                    raise GroqReportServiceError(
                        "Groq final report used prohibited diagnostic or overclaiming language."
                    )

        disclaimer = generated["disclaimer"].lower()
        has_negative_diagnosis_statement = bool(
            re.search(
                r"(?:\bnot\b|\bcannot\b|\bno\b|\bdoes not\b|\bdo not\b).{0,80}\bdiagnos|"
                r"\bdiagnos.{0,80}(?:\bnot\b|\bcannot\b|\bno\b|\bdoes not\b|\bdo not\b)",
                disclaimer,
            )
        )
        if not has_negative_diagnosis_statement:
            raise GroqReportServiceError(
                "Groq final report disclaimer must explicitly state that the screening output is not diagnostic."
            )
        explainability_summary = generated["explainability_summary"].lower()
        has_negative_causality_statement = bool(
            re.search(
                r"(?:\bnot\b|\bcannot\b|\bno\b).{0,80}\bcaus|"
                r"\bcaus.{0,80}(?:\bnot\b|\bcannot\b|\bno\b)",
                explainability_summary,
            )
        )
        if not has_negative_causality_statement:
            raise GroqReportServiceError(
                "Groq explainability summary must explicitly state that the evidence is not causal."
            )

        allowed_units = {
            str(item["unit"]).lower()
            for item in approved_package.get("clinical_inputs", [])
            if isinstance(item, dict) and item.get("unit")
        }
        if "years" in allowed_units or "year" in allowed_units:
            allowed_units.update({"years", "year"})
        if "mm hg" in allowed_units or "mmhg" in allowed_units:
            allowed_units.update({"mm hg", "mmhg"})
        if "kg/m²" in allowed_units or "kg/m2" in allowed_units:
            allowed_units.update({"kg/m²", "kg/m2"})
        used_units = {match.group(0).lower() for match in CLINICAL_UNIT_PATTERN.finditer(all_text)}
        unsupported_units = sorted(used_units - allowed_units)
        if unsupported_units:
            raise GroqReportServiceError(
                "Groq final report introduced measurement units absent from the approved inputs: "
                + ", ".join(unsupported_units)
            )
