"""Build auditable machine-readable screening reports and optional LLM narratives."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np

from backend.services.explainability_service import ExplainabilityService
from backend.services.breast_feature_contract import BREAST_FEATURE_ORDER
from backend.services.groq_report_service import GroqReportService


class ClinicalReportService:
    """Keeps deterministic model evidence separate from generative narrative text."""

    def __init__(self, model_service, project_root: str | Path):
        self.model_service = model_service
        self.project_root = Path(project_root)
        self.explanations_dir = self.project_root / "data" / "explanations"
        self.background_dir = self.project_root / "models" / "explainability"
        self.final_report_service = GroqReportService()

    def build_report(self, *, disease_key: str, prediction: dict[str, Any], inputs: dict[str, Any],
                     feature_source: str = "direct_submission", feature_extraction_id: str | None = None,
                     image_bytes: bytes | None = None) -> dict[str, Any]:
        report_id = str(uuid4())
        explanation = self._explain(disease_key, inputs, prediction, image_bytes, report_id)
        explanation["plain_language"] = {
            "generator": "deterministic_template_v1",
            "sentences": self._explanation_sentences(explanation),
        }
        return {
            "report_version": "1.0",
            "report_id": report_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "screening": {
                "disease": prediction.get("disease", disease_key),
                "model_name": self._model_name(disease_key),
                "prediction": prediction.get("prediction", prediction.get("diagnosis")),
                "probability": prediction.get("risk_probability"),
                "risk_tier": prediction.get("risk_tier"),
                "decision_threshold": 0.5,
                "input_source": feature_source,
                "feature_extraction_id": feature_extraction_id,
            },
            "decision_trace": {
                "input_validation": self._validation_status(inputs),
                "feature_source": feature_source,
                "routing": {
                    "method": "explicit disease-model endpoint",
                    "selected_model": self._model_name(disease_key),
                    "result": "routed",
                },
                "model_probability": prediction.get("risk_probability"),
                "decision_threshold": 0.5,
                "threshold_result": "positive" if prediction.get("risk_probability", 0) >= 0.5 else "negative",
                "model_decision": prediction.get("prediction", prediction.get("diagnosis")),
            },
            "clinical_inputs": self._safe_inputs(disease_key, inputs),
            "model_output": prediction,
            "explainability": explanation,
            "safety": {
                "screening_only": True,
                "requires_clinician_review": True,
                "disclaimer": "This is an AI screening result, not a diagnosis or treatment recommendation.",
            },
        }

    def _explain(self, disease_key, inputs, prediction, image_bytes, report_id):
        if disease_key == "diabetes":
            model, scaler = self.model_service.get_diabetes_model()
            def value(lower_name, stored_name, default=None):
                return inputs[lower_name] if lower_name in inputs else inputs.get(stored_name, default)
            bmi = float(value("bmi", "BMI", 25))
            bmi_cat = 0 if bmi < 18.5 else 1 if bmi < 25 else 2 if bmi < 30 else 3
            names = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI", "DiabetesPedigreeFunction", "Age", "BMI_Cat"]
            raw = {"Pregnancies": value("pregnancies", "Pregnancies"), "Glucose": value("glucose", "Glucose"), "BloodPressure": value("blood_pressure", "BloodPressure"), "SkinThickness": value("skin_thickness", "SkinThickness"), "Insulin": value("insulin", "Insulin"), "BMI": bmi, "DiabetesPedigreeFunction": value("dpf", "DiabetesPedigreeFunction"), "Age": value("age", "Age"), "BMI_Cat": value("bmi_cat", "BMI_Cat", bmi_cat)}
            if getattr(scaler, "n_features_in_", len(names)) == 8:
                names = [name for name in names if name != "DiabetesPedigreeFunction"]
            values = np.array([[float(raw[name]) for name in names]])
            return ExplainabilityService.permutation_shap(
                predict_proba=model.predict_proba, model_input=scaler.transform(values),
                background_path=self.background_dir / f"diabetes_background_scaled_{len(names)}.npy",
                feature_names=names, raw_values=raw, method_label="SHAP PermutationExplainer (full diabetes voting ensemble)",
            )
        if disease_key == "heart":
            model, scaler = self.model_service.get_heart_model()
            names = ["Age", "Sex", "ChestPainType", "RestingBloodPressure", "Cholesterol", "FastingBloodSugar", "RestingECG", "MaxHeartRate", "ExerciseAngina", "Oldpeak", "STSlope", "MajorVessels", "Thalassemia"]
            keys = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]
            raw = {name: inputs.get(key) for name, key in zip(names, keys)}
            values = np.array([[float(raw[name]) for name in names]])
            return ExplainabilityService.tree_shap(model=model, transformed_input=scaler.transform(values), feature_names=names, raw_values=raw)
        if disease_key == "breast":
            model, scaler, pca = self.model_service.get_breast_cancer_model()
            values = np.array([[float(inputs[name]) for name in BREAST_FEATURE_ORDER]])
            def predict_proba_raw(raw_features):
                return model.predict_proba(pca.transform(scaler.transform(raw_features)))
            return ExplainabilityService.permutation_shap(
                predict_proba=predict_proba_raw, model_input=values,
                background_path=self.background_dir / "breast_background_raw.npy",
                feature_names=list(BREAST_FEATURE_ORDER), raw_values=inputs,
                method_label="SHAP PermutationExplainer (raw WDBC features through scaler/PCA/classifier)",
            )
        if disease_key == "pneumonia" and image_bytes:
            model = self.model_service.get_xray_model()
            tensor, _ = self.model_service.transform_image(image_bytes, target_size=(224, 224))
            return ExplainabilityService.grad_cam(model=model, image_tensor=tensor, target_positive=bool(prediction.get("has_disease")), report_id=report_id, storage_dir=self.explanations_dir, positive_label="Pneumonia", negative_label="Normal / no pneumonia")
        if disease_key == "eye" and image_bytes:
            model = self.model_service.get_eye_model()
            tensor, _ = self.model_service.transform_image(image_bytes, target_size=(224, 224))
            return ExplainabilityService.grad_cam(model=model, image_tensor=tensor, target_positive=bool(prediction.get("is_positive")), report_id=report_id, storage_dir=self.explanations_dir, positive_label="Eye disease detected", negative_label="No eye disease detected")
        return {"status": "not_applicable", "method": None, "limitations": ["No explanation adapter is configured for this model."]}

    @staticmethod
    def _safe_inputs(disease_key: str, inputs: dict[str, Any]) -> list[dict[str, Any]]:
        """Attach only explicit, model-contract metadata to final-report inputs."""
        if disease_key != "diabetes":
            return [
                {"name": name, "value": value, "source": "validated model input"}
                for name, value in inputs.items()
            ]

        aliases = {
            "Pregnancies": ("pregnancies", "Pregnancies"),
            "Glucose": ("glucose", "Glucose"),
            "BloodPressure": ("blood_pressure", "BloodPressure"),
            "SkinThickness": ("skin_thickness", "SkinThickness"),
            "Insulin": ("insulin", "Insulin"),
            "BMI": ("bmi", "BMI"),
            "DiabetesPedigreeFunction": ("dpf", "DiabetesPedigreeFunction"),
            "Age": ("age", "Age"),
            "BMI_Cat": ("bmi_cat", "BMI_Cat"),
        }
        metadata = {
            "Pregnancies": ("Pregnancies", "count"),
            "Glucose": ("Fasting glucose", "mg/dL"),
            "BloodPressure": ("Diastolic blood pressure", "mm Hg"),
            "SkinThickness": ("Triceps skin thickness", "mm"),
            "Insulin": ("Serum insulin", "μU/mL"),
            "BMI": ("Body mass index", "kg/m²"),
            "DiabetesPedigreeFunction": ("Diabetes pedigree function", None),
            "Age": ("Age", "years"),
            "BMI_Cat": ("Derived BMI category", None),
        }

        def lookup(names):
            return next((inputs[name] for name in names if name in inputs), None)

        values = {canonical: lookup(names) for canonical, names in aliases.items()}
        if values["BMI_Cat"] is None and values["BMI"] is not None:
            bmi = float(values["BMI"])
            values["BMI_Cat"] = 0 if bmi < 18.5 else 1 if bmi < 25 else 2 if bmi < 30 else 3

        return [
            {
                "name": canonical,
                "display_name": metadata[canonical][0],
                "value": values[canonical],
                "unit": metadata[canonical][1],
                "source": "derived model input" if canonical == "BMI_Cat" else "validated model input",
            }
            for canonical in aliases
            if values[canonical] is not None
        ]

    @staticmethod
    def _validation_status(inputs: dict[str, Any]) -> str:
        return "passed" if all(value is not None for value in inputs.values()) else "incomplete"

    @staticmethod
    def _model_name(disease_key: str) -> str:
        return {"diabetes": "diabetes_model.pkl", "heart": "heart_model.pkl", "pneumonia": "xrays_pneumonia.keras", "breast": "breast_cancer_model.pkl", "eye": "eye_disease.keras"}.get(disease_key, disease_key)

    @staticmethod
    def _explanation_sentences(explanation: dict[str, Any]) -> list[str]:
        """Translate explanation evidence without an LLM or clinical inference."""
        if explanation.get("status") != "available":
            reason = explanation.get("reason", "No explanation adapter produced evidence.")
            return [f"Model explanation is unavailable: {reason}"]

        method = explanation.get("method") or "Model explanation"
        if "SHAP" in method:
            sentences = []
            for item in explanation.get("all_contributions", [])[:5]:
                shap_value = float(item.get("shap_value", 0.0))
                direction = "increased" if shap_value >= 0 else "reduced"
                sentences.append(
                    f"{item.get('feature')} at {item.get('patient_value')} {direction} "
                    f"the model's positive-class score (SHAP {shap_value:+.6f})."
                )
            sentences.append(
                "SHAP describes this model's behavior for the submitted input and does not establish medical causality."
            )
            return sentences

        if method == "Grad-CAM":
            return [
                f"Grad-CAM highlighted image regions that influenced the model output for "
                f"{explanation.get('target_class', 'the selected class')}.",
                "The highlighted regions are model-attention evidence, not confirmed anatomical findings.",
            ]
        return [
            f"{method} evidence is available for clinician review.",
            "This explanation describes model behavior and does not establish medical causality.",
        ]

    def generate_final_report(self, approved_package: dict[str, Any]) -> dict[str, Any]:
        """Call Groq once after an explicit clinician approval."""
        return self.final_report_service.generate_final_report(approved_package)

    def generate_narrative(self, report: dict[str, Any]) -> dict[str, Any]:
        """Backward-compatible wrapper around the approved-package final report call."""
        return self.generate_final_report(report)
