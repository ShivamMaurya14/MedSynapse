import json
import unittest
from unittest.mock import patch

from backend.services.groq_report_service import (
    GroqReportService,
    GroqReportServiceError,
)
from backend.services.clinical_report_service import ClinicalReportService


FINAL_REPORT = {
    "title": "Diabetes Screening Report",
    "screening_summary": "Screening summary.",
    "model_findings": "Model findings.",
    "explainability_summary": "SHAP describes model behavior and does not establish medical causality.",
    "clinician_review": "Approved by Dr Test.",
    "recommendations": ["Review clinically."],
    "limitations": ["Screening only."],
    "disclaimer": "Not a diagnosis.",
}

APPROVED_PACKAGE = {
    "model_run_id": "run-1",
    "prediction": {"risk_probability": 0.72},
    "explainability": {"status": "available", "method": "SHAP"},
    "clinical_inputs": [
        {"name": "Glucose", "value": 168, "unit": "mg/dL"},
        {"name": "BMI", "value": 33.4, "unit": "kg/m²"},
    ],
    "clinician_decision": {"decision": "approved", "reviewed_by": "Dr Test"},
}


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps({
            "id": "groq-test-request",
            "model": "openai/gpt-oss-20b",
            "choices": [{"message": {"content": json.dumps(FINAL_REPORT)}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
        }).encode("utf-8")


class GroqReportServiceTests(unittest.TestCase):
    def test_diabetes_inputs_include_units_and_derived_ninth_feature(self):
        inputs = ClinicalReportService._safe_inputs("diabetes", {
            "pregnancies": 2,
            "glucose": 168,
            "blood_pressure": 90,
            "skin_thickness": 28,
            "insulin": 42.5,
            "bmi": 33.4,
            "dpf": 0.65,
            "age": 42,
        })
        by_name = {item["name"]: item for item in inputs}
        self.assertEqual(len(inputs), 9)
        self.assertEqual(by_name["Glucose"]["unit"], "mg/dL")
        self.assertEqual(by_name["BloodPressure"]["unit"], "mm Hg")
        self.assertEqual(by_name["BMI"]["unit"], "kg/m²")
        self.assertEqual(by_name["BMI_Cat"]["value"], 3)
        self.assertEqual(by_name["BMI_Cat"]["source"], "derived model input")

    def test_generates_schema_constrained_report(self):
        client = GroqReportService(api_key="test-key")
        captured = {}

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["body"] = json.loads(request.data)
            captured["authorization"] = request.get_header("Authorization")
            captured["timeout"] = timeout
            return FakeResponse()

        with patch(
            "backend.services.groq_report_service.urllib.request.urlopen",
            fake_urlopen,
        ):
            result = client.generate_final_report(APPROVED_PACKAGE)

        self.assertEqual(
            captured["url"], "https://api.groq.com/openai/v1/chat/completions"
        )
        self.assertEqual(captured["authorization"], "Bearer test-key")
        self.assertEqual(captured["body"]["response_format"]["type"], "json_schema")
        self.assertTrue(
            captured["body"]["response_format"]["json_schema"]["strict"]
        )
        self.assertEqual(result["provider"], "groq")
        self.assertEqual(result["report"], FINAL_REPORT)

    def test_rejected_decision_never_calls_groq(self):
        client = GroqReportService(api_key="test-key")
        rejected = {"clinician_decision": {"decision": "rejected"}}
        with patch(
            "backend.services.groq_report_service.urllib.request.urlopen"
        ) as urlopen:
            with self.assertRaisesRegex(
                GroqReportServiceError, "approved clinician decision"
            ):
                client.generate_final_report(rejected)
        urlopen.assert_not_called()

    def test_rejects_non_groq_endpoint(self):
        with self.assertRaisesRegex(GroqReportServiceError, "Groq's HTTPS"):
            GroqReportService(
                api_url="https://example.com/v1/chat/completions",
                api_key="test-key",
            )

    def test_rejects_diagnostic_overclaim(self):
        unsafe = dict(FINAL_REPORT)
        unsafe["model_findings"] = "The model classified the patient as having Diabetes Mellitus."
        with self.assertRaisesRegex(GroqReportServiceError, "overclaiming language"):
            GroqReportService._validate_generated_report(unsafe, APPROVED_PACKAGE)

    def test_rejects_unit_not_present_in_approved_inputs(self):
        unsafe = dict(FINAL_REPORT)
        unsafe["screening_summary"] = "The measured value was 90 mm Hg."
        with self.assertRaisesRegex(GroqReportServiceError, "units absent"):
            GroqReportService._validate_generated_report(unsafe, APPROVED_PACKAGE)

    def test_accepts_equivalent_negative_causality_wording(self):
        safe = dict(FINAL_REPORT)
        safe["explainability_summary"] = (
            "SHAP feature contributions should not be interpreted as proof of causation."
        )
        GroqReportService._validate_generated_report(safe, APPROVED_PACKAGE)

    def test_accepts_equivalent_non_diagnostic_disclaimer(self):
        safe = dict(FINAL_REPORT)
        safe["disclaimer"] = (
            "This screening output does not constitute a clinical diagnosis."
        )
        GroqReportService._validate_generated_report(safe, APPROVED_PACKAGE)


if __name__ == "__main__":
    unittest.main()
