#!/usr/bin/env python3
"""
End-to-End Master Diagnostic & XAI Verification Suite for MedSynapse.
Verifies all 9 Clinical Diagnostic Modules for:
1. ML / DL Inference Accuracy
2. Explainable AI (SHAP for Tabular, Grad-CAM with Overlays for Vision)
3. Deterministic Decision Tracing and Safety Safeguards
"""

import os
import sys
import io
import unittest
from pathlib import Path
import numpy as np
from PIL import Image

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from backend.services.model_service import ModelService
from backend.services.clinical_report_service import ClinicalReportService
from backend.services.breast_feature_contract import BREAST_FEATURE_ORDER
from sklearn.datasets import load_breast_cancer


class TestAllDiseasesXAI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ms = ModelService.get_instance()
        cls.crs = ClinicalReportService(cls.ms, str(BASE_DIR))

    # =========================================================================
    # PHASE 1: TABULAR SHAP MODULES (M1, M2, M5, M6)
    # =========================================================================

    def test_01_diabetes_shap_complete(self):
        """M1: Type-2 Diabetes Mellitus Soft-Voting Ensemble Permutation SHAP"""
        inp = {
            "pregnancies": 3,
            "glucose": 165,
            "blood_pressure": 88,
            "skin_thickness": 32,
            "insulin": 180,
            "bmi": 34.2,
            "dpf": 0.85,
            "age": 48,
        }
        res = self.ms.predict_diabetes(inp)
        self.assertIn("risk_probability", res)
        self.assertTrue(res["risk_probability"] > 0.5)

        rep = self.crs.build_report(disease_key="diabetes", prediction=res, inputs=inp)
        exp = rep["explainability"]

        self.assertEqual(exp["status"], "available")
        self.assertIn("SHAP", exp["method"])
        self.assertEqual(len(exp["all_contributions"]), 9)
        self.assertTrue(len(exp["top_positive_contributors"]) > 0)
        self.assertTrue(any(c["feature"] == "Glucose" for c in exp["top_positive_contributors"]))
        self.assertIsNotNone(rep["decision_trace"]["net_shap_displacement"])
        print("\n✅ M1 Diabetes Mellitus SHAP Verified (Glucose top driver: +{})".format(
            [c["shap_value"] for c in exp["top_positive_contributors"] if c["feature"] == "Glucose"][0]
        ))

    def test_02_heart_disease_shap_complete(self):
        """M2: Coronary Heart Disease Random Forest TreeSHAP"""
        inp = {
            "age": 58,
            "sex": 1,
            "cp": 0,
            "trestbps": 148,
            "chol": 265,
            "fbs": 1,
            "restecg": 1,
            "thalach": 128,
            "exang": 1,
            "oldpeak": 2.4,
            "slope": 1,
            "ca": 2,
            "thal": 3,
        }
        res = self.ms.predict_heart(inp)
        self.assertIn("risk_probability", res)
        self.assertTrue(res["risk_probability"] > 0.5)

        rep = self.crs.build_report(disease_key="heart", prediction=res, inputs=inp)
        exp = rep["explainability"]

        self.assertEqual(exp["status"], "available")
        self.assertIn("TreeExplainer", exp["method"])
        self.assertEqual(len(exp["all_contributions"]), 13)
        self.assertIsNotNone(rep["decision_trace"]["net_shap_displacement"])
        print("✅ M2 Coronary Heart Disease TreeSHAP Verified (13 attributions computed)")

    def test_03_breast_cancer_shap_complete(self):
        """M5: Breast Cancer Malignancy PCA + Logistic Regression Permutation SHAP"""
        data = load_breast_cancer()
        mal_idx = list(data.target).index(0)  # Malignant sample
        feat = {name: float(val) for name, val in zip(BREAST_FEATURE_ORDER, data.data[mal_idx])}

        res = self.ms.predict_breast_cancer(feat)
        self.assertEqual(res["diagnosis"], "Malignant")
        self.assertTrue(res["risk_probability"] >= 0.5)

        rep = self.crs.build_report(disease_key="breast", prediction=res, inputs=feat)
        exp = rep["explainability"]

        self.assertEqual(exp["status"], "available")
        self.assertIn("SHAP", exp["method"])
        self.assertEqual(len(exp["all_contributions"]), 30)
        self.assertTrue(len(exp["top_positive_contributors"]) > 0)
        print("✅ M5 Breast Cancer Malignancy 30-Feature SHAP Verified (Top driver: {})".format(
            exp["top_positive_contributors"][0]["feature"]
        ))

    def test_04_liver_disease_shap_complete(self):
        """M6: Hepatic Liver Disease Random Forest TreeSHAP"""
        inp = {
            "age": 52,
            "gender": "Male",
            "total_bilirubin": 4.2,
            "direct_bilirubin": 2.1,
            "alkaline_phosphotase": 480,
            "alamine_aminotransferase": 95,
            "aspartate_aminotransferase": 110,
            "total_protiens": 5.8,
            "albumin": 2.4,
            "albumin_and_globulin_ratio": 0.7,
        }
        res = self.ms.predict_liver(inp)
        self.assertTrue(res["has_disease"])

        rep = self.crs.build_report(disease_key="liver", prediction=res, inputs=inp)
        exp = rep["explainability"]

        self.assertEqual(exp["status"], "available")
        self.assertIn("TreeExplainer", exp["method"])
        self.assertEqual(len(exp["all_contributions"]), 10)
        self.assertTrue(any(c["feature"] == "Direct_Bilirubin" for c in exp["top_positive_contributors"]))
        print("✅ M6 Hepatic Liver Disease TreeSHAP Verified (Direct Bilirubin top driver)")

    # =========================================================================
    # PHASE 2: VISION GRAD-CAM MODULES (M3, M4, M7, M8, M9)
    # =========================================================================

    def test_05_pneumonia_xray_gradcam(self):
        """M3: Pediatric Pneumonia Chest X-Ray Grad-CAM Saliency Overlay"""
        xray_path = BASE_DIR / "datasets" / "sample_reports" / "05_sample_chest_xray.png"
        image_bytes = xray_path.read_bytes()

        res = self.ms.predict_xray(image_bytes)
        self.assertIn("risk_probability", res)

        rep = self.crs.build_report(disease_key="pneumonia", prediction=res, inputs={}, image_bytes=image_bytes)
        exp = rep["explainability"]

        self.assertEqual(exp["status"], "available")
        self.assertEqual(exp["method"], "Grad-CAM")
        self.assertIsNotNone(exp.get("heatmap_path"))
        self.assertTrue(exp["overlay_data_url"].startswith("data:image/png;base64,"))
        self.assertTrue(exp["heatmap_data_url"].startswith("data:image/png;base64,"))
        self.assertEqual(exp["heatmap_shape"], [7, 7])
        print("✅ M3 Pediatric Pneumonia Grad-CAM Verified (7x7 receptive field overlay generated)")

    def test_06_brain_tumor_mri_gradcam(self):
        """M4: Cranial Brain Tumor Xception Transfer CNN Grad-CAM"""
        mri_path = BASE_DIR / "datasets" / "sample_reports" / "06_sample_brain_mri.png"
        image_bytes = mri_path.read_bytes()

        res = self.ms.predict_brain_tumor(image_bytes)
        self.assertIn("class_probabilities", res)

        rep = self.crs.build_report(disease_key="brain_tumor", prediction=res, inputs={}, image_bytes=image_bytes)
        exp = rep["explainability"]

        self.assertEqual(exp["status"], "available")
        self.assertEqual(exp["method"], "Grad-CAM")
        self.assertIsNotNone(exp.get("target_class"))
        self.assertTrue(exp["overlay_data_url"].startswith("data:image/png;base64,"))
        self.assertTrue(exp["heatmap_data_url"].startswith("data:image/png;base64,"))
        self.assertEqual(exp["heatmap_shape"], [10, 10])
        print(f"✅ M4 Cranial Brain Tumor Grad-CAM Verified (Target: {exp['target_class']}, 10x10 CAM overlay)")

    def test_07_kidney_stone_ct_gradcam(self):
        """M7: Kidney CT Pathology EfficientNet Grad-CAM"""
        ct_path = BASE_DIR / "frontend" / "public" / "test_samples" / "kidney_stone.jpg"
        image_bytes = ct_path.read_bytes()

        res = self.ms.predict_kidney_stone(image_bytes)
        self.assertIn("class_probabilities", res)

        rep = self.crs.build_report(disease_key="kidney_stone", prediction=res, inputs={}, image_bytes=image_bytes)
        exp = rep["explainability"]

        self.assertEqual(exp["status"], "available")
        self.assertEqual(exp["method"], "Grad-CAM")
        self.assertEqual(exp["target_class"], "Stone")
        self.assertTrue(exp["overlay_data_url"].startswith("data:image/png;base64,"))
        self.assertTrue(exp["heatmap_data_url"].startswith("data:image/png;base64,"))
        self.assertEqual(exp["heatmap_shape"], [5, 5])
        print("✅ M7 Kidney Pathology CT Grad-CAM Verified (Target: Stone, 5x5 top_conv overlay)")

    def test_08_skin_cancer_dermoscopy_gradcam(self):
        """M8: Cutaneous Skin Cancer HAM10000 7-Class CNN Grad-CAM"""
        skin_path = BASE_DIR / "frontend" / "public" / "test_samples" / "skin_melanoma.jpg"
        image_bytes = skin_path.read_bytes()

        res = self.ms.predict_skin_cancer(image_bytes)
        self.assertIn("class_probabilities", res)

        rep = self.crs.build_report(disease_key="skin_cancer", prediction=res, inputs={}, image_bytes=image_bytes)
        exp = rep["explainability"]

        self.assertEqual(exp["status"], "available")
        self.assertEqual(exp["method"], "Grad-CAM")
        self.assertEqual(exp["target_class"], "Melanoma (Malignant)")
        self.assertTrue(exp["overlay_data_url"].startswith("data:image/png;base64,"))
        self.assertTrue(exp["heatmap_data_url"].startswith("data:image/png;base64,"))
        self.assertEqual(exp["heatmap_shape"], [4, 4])
        print("✅ M8 Cutaneous Skin Cancer Grad-CAM Verified (Target: Melanoma, conv2d_7 overlay)")

    def test_09_eye_disease_fundus_gradcam(self):
        """M9: Retinal Eye Disease PyTorch ResNet-18 Grad-CAM"""
        fundus_path = BASE_DIR / "datasets" / "sample_reports" / "11_eye_fundus_retinopathy_referral.png"
        image_bytes = fundus_path.read_bytes()

        res = self.ms.predict_eye(image_bytes)
        self.assertIn("class_probabilities", res)

        rep = self.crs.build_report(disease_key="eye", prediction=res, inputs={}, image_bytes=image_bytes)
        exp = rep["explainability"]

        self.assertEqual(exp["status"], "available")
        self.assertIn("PyTorch", exp["method"])
        self.assertIsNotNone(exp.get("target_class"))
        self.assertTrue(exp["overlay_data_url"].startswith("data:image/png;base64,"))
        self.assertTrue(exp["heatmap_data_url"].startswith("data:image/png;base64,"))
        self.assertEqual(exp["heatmap_shape"], [7, 7])
        print(f"✅ M9 Retinal Eye Disease PyTorch Grad-CAM Verified (Target: {exp['target_class']}, ResNet layer4 overlay)")


if __name__ == "__main__":
    unittest.main()
