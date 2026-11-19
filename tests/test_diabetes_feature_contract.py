import unittest

from backend.services.diabetes_feature_contract import (
    diabetes_extraction_json_schema,
    diabetes_extraction_prompt,
    parse_gemma_diabetes_extraction,
)
from backend.services.gemma_service import GemmaService


class DiabetesGemmaIntegrationContractTests(unittest.TestCase):
    def test_non_extracted_schema_forbids_a_numeric_value(self):
        schema = diabetes_extraction_json_schema()
        glucose_schema = schema["properties"]["features"]["properties"]["Glucose"]

        non_extracted = glucose_schema["oneOf"][1]

        self.assertEqual(non_extracted["properties"]["value"], {"type": "null"})

    def test_local_generation_default_allows_slow_cpu_inference(self):
        service = GemmaService(model_name="gemma3:4b")

        self.assertGreaterEqual(service.timeout_seconds, 180)

    def test_prompt_maps_gravida_to_pregnancy_count(self):
        prompt = diabetes_extraction_prompt()

        self.assertIn('"Gravida"', prompt)
        self.assertIn("Do not use parity", prompt)

    def test_blood_pressure_accepts_common_unit_spacing(self):
        names_and_values = {
            "Pregnancies": (2, "count"),
            "Glucose": (168, "mg/dL"),
            "BloodPressure": (90, "mm Hg"),
            "SkinThickness": (32, "mm"),
            "Insulin": (42.5, "μU/mL"),
            "BMI": (33.4, "kg/m2"),
            "Age": (45, "years"),
        }
        payload = {
            "features": {
                name: {
                    "value": value,
                    "unit": unit,
                    "source_text": f"{name}: {value}",
                    "page": 1,
                    "confidence": 0.9,
                    "status": "extracted",
                }
                for name, (value, unit) in names_and_values.items()
            }
        }

        parsed = parse_gemma_diabetes_extraction(payload)

        self.assertEqual(parsed["BloodPressure"].unit, "mmHg")
        self.assertEqual(parsed["Insulin"].unit, "uIU/mL")

    def test_blood_pressure_pair_is_normalized_to_diastolic(self):
        names_and_values = {
            "Pregnancies": (2, "count", "Gravida: 2"),
            "Glucose": (168, "mg/dL", "Glucose: 168 mg/dL"),
            "BloodPressure": (142, "mm Hg", "Blood Pressure: 142/90 mm Hg"),
            "SkinThickness": (32, "mm", "Skin Thickness: 32 mm"),
            "Insulin": (42.5, "μU/mL", "Insulin: 42.5 μU/mL"),
            "BMI": (33.4, "kg/m2", "BMI: 33.4 kg/m2"),
            "Age": (45, "years", "Age: 45 years"),
        }
        payload = {
            "features": {
                name: {
                    "value": value,
                    "unit": unit,
                    "source_text": source,
                    "page": 1,
                    "confidence": 0.9,
                    "status": "extracted",
                }
                for name, (value, unit, source) in names_and_values.items()
            }
        }

        parsed = parse_gemma_diabetes_extraction(payload)

        self.assertEqual(parsed["BloodPressure"].value, 90.0)


if __name__ == "__main__":
    unittest.main()
