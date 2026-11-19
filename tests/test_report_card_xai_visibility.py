"""Test that Explainable AI (SHAP and Grad-CAM) is generated and visible in report cards for all 9 diseases."""

import io
import unittest
from pathlib import Path
from PIL import Image

from backend.services.model_service import ModelService
from backend.services.clinical_report_service import ClinicalReportService


def create_test_image(color=(128, 128, 128), size=(299, 299)) -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestReportCardXAIVisibility(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.project_root = Path(".")
        cls.model_service = ModelService()
        cls.report_service = ClinicalReportService(cls.model_service, cls.project_root)
        cls.test_jpeg = create_test_image(size=(300, 300))

    def test_all_9_diseases_report_xai(self):
        """Verify that all 9 diseases have functional XAI evidence in their clinical report and direct LLM synthesis."""
        
        disease_cases = [
            # Tabular Diseases (M1, M2, M5, M6)
            ("diabetes", "tabular", {
                "pregnancies": 2, "glucose": 145, "blood_pressure": 82,
                "skin_thickness": 28, "insulin": 120, "bmi": 32.5, "dpf": 0.65, "age": 42
            }),
            ("heart", "tabular", {
                "age": 58, "sex": 1, "cp": 2, "trestbps": 140, "chol": 260,
                "fbs": 0, "restecg": 1, "thalach": 135, "exang": 1,
                "oldpeak": 2.2, "slope": 1, "ca": 1, "thal": 2
            }),
            ("breast", "tabular", {
                "radius_mean": 17.99, "texture_mean": 10.38, "perimeter_mean": 122.8, "area_mean": 1001.0,
                "smoothness_mean": 0.1184, "compactness_mean": 0.2776, "concavity_mean": 0.3001, "concave_points_mean": 0.1471,
                "symmetry_mean": 0.2419, "fractal_dimension_mean": 0.07871, "radius_se": 1.095, "texture_se": 0.9053,
                "perimeter_se": 8.589, "area_se": 153.4, "smoothness_se": 0.006399, "compactness_se": 0.04904,
                "concavity_se": 0.05373, "concave_points_se": 0.01587, "symmetry_se": 0.03003, "fractal_dimension_se": 0.006193,
                "radius_worst": 25.38, "texture_worst": 17.33, "perimeter_worst": 184.6, "area_worst": 2019.0,
                "smoothness_worst": 0.1622, "compactness_worst": 0.6656, "concavity_worst": 0.7119, "concave_points_worst": 0.2654,
                "symmetry_worst": 0.4601, "fractal_dimension_worst": 0.1189
            }),
            ("liver", "tabular", {
                "age": 54, "gender": 1, "total_bilirubin": 2.1, "direct_bilirubin": 1.1,
                "alkaline_phosphotase": 285, "alamine_aminotransferase": 45,
                "aspartate_aminotransferase": 68, "total_protiens": 6.2, "albumin": 2.9
            }),
            # Vision Diseases (M3, M4, M7, M8, M9)
            ("pneumonia", "vision", {}),
            ("brain_tumor", "vision", {}),
            ("kidney_stone", "vision", {}),
            ("skin_cancer", "vision", {}),
            ("eye", "vision", {}),
        ]

        for d_key, modality, inputs in disease_cases:
            with self.subTest(disease=d_key, modality=modality):
                # 1. Run prediction
                if d_key == "diabetes":
                    pred = self.model_service.predict_diabetes(inputs)
                elif d_key == "heart":
                    pred = self.model_service.predict_heart(inputs)
                elif d_key == "breast":
                    pred = self.model_service.predict_breast_cancer(inputs)
                elif d_key == "liver":
                    pred = self.model_service.predict_liver(inputs)
                elif d_key == "pneumonia":
                    pred = self.model_service.predict_xray(self.test_jpeg)
                elif d_key == "brain_tumor":
                    pred = self.model_service.predict_brain_tumor(self.test_jpeg)
                elif d_key == "kidney_stone":
                    pred = self.model_service.predict_kidney_stone(self.test_jpeg)
                elif d_key == "skin_cancer":
                    pred = self.model_service.predict_skin_cancer(self.test_jpeg)
                elif d_key == "eye":
                    pred = self.model_service.predict_eye(self.test_jpeg)

                # 2. Build report with XAI
                rep = self.report_service.build_report(
                    disease_key=d_key,
                    prediction=pred,
                    inputs=inputs,
                    image_bytes=self.test_jpeg if modality == "vision" else None,
                )
                exp = rep["explainability"]
                self.assertEqual(exp["status"], "available", f"Explainability unavailable for {d_key}: {exp.get('reason')}")

                if modality == "tabular":
                    self.assertIn("SHAP", exp["method"])
                    self.assertTrue(len(exp.get("all_contributions", [])) > 0 or len(exp.get("top_positive_contributors", [])) > 0)
                    self.assertIn("plain_language", exp)
                    self.assertTrue(len(exp["plain_language"]["sentences"]) > 0)
                else:
                    self.assertIn("Grad-CAM", exp["method"])
                    self.assertTrue(exp["overlay_data_url"].startswith("data:image/png;base64,"))
                    self.assertTrue(exp["heatmap_data_url"].startswith("data:image/png;base64,"))
                    self.assertIsNotNone(exp.get("target_class"))
                    self.assertIn("plain_language", exp)

                # 3. Direct synthesis for LLM Report View
                synthesis = self.report_service.synthesize_report_direct(
                    disease_key=d_key,
                    prediction=pred,
                    inputs=inputs,
                    clinical_report=rep,
                )
                self.assertIn("explainability_summary", synthesis)
                exp_sum = synthesis["explainability_summary"]
                self.assertTrue(len(exp_sum) > 20, f"Empty explainability summary for {d_key}")
                if modality == "tabular":
                    self.assertTrue("SHAP" in exp_sum or "biomarker" in exp_sum.lower())
                else:
                    self.assertTrue("Grad-CAM" in exp_sum or "saliency" in exp_sum.lower())

                print(f"Verified {d_key.upper()} ({modality}): Report Card XAI & Synthesis OK")


if __name__ == "__main__":
    unittest.main()
