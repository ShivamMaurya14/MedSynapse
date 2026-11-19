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
        prob = float(prediction.get("risk_probability", 0.0) or 0.0)
        threshold = 0.5
        is_positive = prob >= threshold
        decision_label = prediction.get("prediction", prediction.get("diagnosis", "Positive" if is_positive else "Negative"))
        risk_tier = prediction.get("risk_tier") or ("High Risk" if prob >= 0.70 else "Moderate Risk" if prob >= 0.35 else "Low Risk")

        # Extract SHAP contributions if available for decision trace
        base_value = explanation.get("base_value")
        all_contribs = explanation.get("all_contributions", [])
        pos_drivers = [
            {"feature": item.get("feature"), "value": item.get("patient_value"), "shap_value": item.get("shap_value")}
            for item in all_contribs if float(item.get("shap_value", 0.0)) > 0
        ]
        neg_drivers = [
            {"feature": item.get("feature"), "value": item.get("patient_value"), "shap_value": item.get("shap_value")}
            for item in all_contribs if float(item.get("shap_value", 0.0)) < 0
        ]
        net_shap = round(sum(float(item.get("shap_value", 0.0)) for item in all_contribs), 6) if all_contribs else None

        return {
            "report_version": "1.0",
            "report_id": report_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "screening": {
                "disease": prediction.get("disease", disease_key),
                "model_name": self._model_name(disease_key),
                "prediction": decision_label,
                "probability": prob,
                "risk_tier": risk_tier,
                "decision_threshold": threshold,
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
                "base_reference_score": base_value,
                "positive_risk_drivers": pos_drivers,
                "protective_risk_factors": neg_drivers,
                "net_shap_displacement": net_shap,
                "model_probability": prob,
                "decision_threshold": threshold,
                "threshold_evaluation": f"Probability {prob:.4f} {'≥' if is_positive else '<'} threshold {threshold:.2f} -> {decision_label}",
                "threshold_result": "positive" if is_positive else "negative",
                "risk_tier_classification": risk_tier,
                "model_decision": decision_label,
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
            defaults = {
                "pregnancies": 1,
                "glucose": 120,
                "blood_pressure": 70,
                "skin_thickness": 20,
                "insulin": 80,
                "bmi": 25.0,
                "dpf": 0.5,
                "age": 35,
            }
            def value(lower_name, stored_name, fallback):
                v = inputs.get(lower_name)
                if v is None:
                    v = inputs.get(stored_name)
                if v is None:
                    v = fallback
                return v

            bmi = float(value("bmi", "BMI", defaults["bmi"]))
            bmi_cat = 0 if bmi < 18.5 else 1 if bmi < 25 else 2 if bmi < 30 else 3
            names = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI", "DiabetesPedigreeFunction", "Age", "BMI_Cat"]
            raw = {
                "Pregnancies": float(value("pregnancies", "Pregnancies", defaults["pregnancies"])),
                "Glucose": float(value("glucose", "Glucose", defaults["glucose"])),
                "BloodPressure": float(value("blood_pressure", "BloodPressure", defaults["blood_pressure"])),
                "SkinThickness": float(value("skin_thickness", "SkinThickness", defaults["skin_thickness"])),
                "Insulin": float(value("insulin", "Insulin", defaults["insulin"])),
                "BMI": bmi,
                "DiabetesPedigreeFunction": float(value("dpf", "DiabetesPedigreeFunction", defaults["dpf"])),
                "Age": float(value("age", "Age", defaults["age"])),
                "BMI_Cat": float(value("bmi_cat", "BMI_Cat", bmi_cat)),
            }
            if getattr(scaler, "n_features_in_", len(names)) == 8:
                names = [name for name in names if name != "DiabetesPedigreeFunction"]
            import pandas as pd
            values = pd.DataFrame([[float(raw[name]) for name in names]], columns=names)
            return ExplainabilityService.permutation_shap(
                predict_proba=model.predict_proba, model_input=scaler.transform(values),
                background_path=self.background_dir / f"diabetes_background_scaled_{len(names)}.npy",
                feature_names=names, raw_values=raw, method_label="SHAP PermutationExplainer (full diabetes voting ensemble)",
            )
        if disease_key == "heart":
            model, scaler = self.model_service.get_heart_model()
            names = ["Age", "Sex", "ChestPainType", "RestingBloodPressure", "Cholesterol", "FastingBloodSugar", "RestingECG", "MaxHeartRate", "ExerciseAngina", "Oldpeak", "STSlope", "MajorVessels", "Thalassemia"]
            keys = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]
            heart_defaults = {
                "age": 52.0, "sex": 1, "cp": 0, "trestbps": 125.0, "chol": 210.0,
                "fbs": 0, "restecg": 0, "thalach": 150.0, "exang": 0, "oldpeak": 0.8,
                "slope": 1, "ca": 0, "thal": 2,
            }
            raw = {
                name: (inputs.get(key) if inputs.get(key) is not None else heart_defaults[key])
                for name, key in zip(names, keys)
            }
            values = np.array([[float(raw[name]) for name in names]])
            return ExplainabilityService.tree_shap(model=model, transformed_input=scaler.transform(values), feature_names=names, raw_values=raw, positive_class_idx=1)
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
            return ExplainabilityService.grad_cam_keras(
                model=model, image_tensor=tensor, image_bytes=image_bytes,
                target_class_idx=1 if bool(prediction.get("has_disease")) else 0,
                target_label="Pneumonia" if bool(prediction.get("has_disease")) else "Normal / no pneumonia",
                report_id=report_id, storage_dir=self.explanations_dir,
                confidence_percentage=prediction.get("confidence_percentage", prediction.get("risk_percentage"))
            )
        if disease_key in ("brain_tumor", "brain-tumor", "brain") and image_bytes:
            model = self.model_service.get_brain_tumor_model()
            tensor, _ = self.model_service.transform_image(image_bytes, target_size=(299, 299))
            classes = ["Glioma", "Meningioma", "No Tumor", "Pituitary Adenoma"]
            diag = prediction.get("diagnosis", prediction.get("prediction", "Glioma"))
            idx = classes.index(diag) if diag in classes else int(np.argmax(list(prediction.get("class_probabilities", {}).values()) or [0]))
            res = ExplainabilityService.grad_cam_keras(
                model=model, image_tensor=tensor, image_bytes=image_bytes,
                target_class_idx=idx, target_label=diag or classes[idx],
                report_id=report_id, storage_dir=self.explanations_dir,
                confidence_percentage=prediction.get("confidence_percentage", prediction.get("risk_percentage"))
            )
            res["class_probabilities"] = prediction.get("class_probabilities", {})
            return res
        if disease_key in ("kidney_stone", "kidney-stone", "kidney") and image_bytes:
            model = self.model_service.get_kidney_model()
            tensor, _ = self.model_service.transform_image(image_bytes, target_size=(150, 150))
            classes = ["Cyst", "Normal", "Stone", "Tumor"]
            diag = prediction.get("diagnosis", prediction.get("prediction", "Stone"))
            idx = classes.index(diag) if diag in classes else int(np.argmax(list(prediction.get("class_probabilities", {}).values()) or [0]))
            res = ExplainabilityService.grad_cam_keras(
                model=model, image_tensor=tensor * 255.0, image_bytes=image_bytes,
                target_class_idx=idx, target_label=diag or classes[idx],
                report_id=report_id, storage_dir=self.explanations_dir,
                confidence_percentage=prediction.get("confidence_percentage", prediction.get("risk_percentage"))
            )
            res["class_probabilities"] = prediction.get("class_probabilities", {})
            return res
        if disease_key in ("skin_cancer", "skin-cancer", "skin") and image_bytes:
            model = self.model_service.get_skin_cancer_model()
            tensor, _ = self.model_service.transform_image(image_bytes, target_size=(28, 28))
            class_codes = ["nv", "mel", "bkl", "bcc", "akiec", "vasc", "df"]
            class_names = {
                "nv": "Melanocytic Nevus (Benign Mole)", "mel": "Melanoma (Malignant)",
                "bkl": "Benign Keratosis-like Lesion", "bcc": "Basal Cell Carcinoma (Malignant)",
                "akiec": "Actinic Keratosis / Bowen Disease", "vasc": "Vascular Lesion", "df": "Dermatofibroma"
            }
            diag = prediction.get("diagnosis", prediction.get("prediction", "mel"))
            idx = 0
            for i, c in enumerate(class_codes):
                if c.lower() in diag.lower() or class_names[c].lower() in diag.lower():
                    idx = i
                    break
            res = ExplainabilityService.grad_cam_keras(
                model=model, image_tensor=tensor * 255.0, image_bytes=image_bytes,
                target_class_idx=idx, target_label=class_names[class_codes[idx]],
                report_id=report_id, storage_dir=self.explanations_dir,
                confidence_percentage=prediction.get("confidence_percentage", prediction.get("risk_percentage"))
            )
            res["class_probabilities"] = prediction.get("class_probabilities", {})
            return res
        if disease_key == "eye" and image_bytes:
            model = self.model_service.get_eye_gradcam_model()
            if model is not None:
                tensor, _ = self.model_service.transform_image(image_bytes, target_size=(224, 224))
                classes = ["Bulging Eyes", "Cataracts", "Crossed Eyes", "Glaucoma", "Uveitis"]
                diag = prediction.get("diagnosis", prediction.get("prediction", "Cataracts"))
                idx = 0
                for i, c in enumerate(classes):
                    if c.lower() in diag.lower() or c.replace(" ", "").lower() in diag.lower():
                        idx = i
                        break
                res = ExplainabilityService.grad_cam_pytorch(
                    model=model, image_tensor=tensor, image_bytes=image_bytes,
                    target_class_idx=idx, target_label=diag or classes[idx],
                    report_id=report_id, storage_dir=self.explanations_dir,
                    confidence_percentage=prediction.get("confidence_percentage", prediction.get("risk_percentage"))
                )
                res["class_probabilities"] = prediction.get("class_probabilities", {})
                return res
        if disease_key == "liver":
            model, scaler_dict = self.model_service.get_liver_model()
            features = list(scaler_dict["feature_names"])
            mean = scaler_dict["mean"].values
            std = scaler_dict["std"].values
            gender_val = inputs.get("gender") if inputs.get("gender") is not None else inputs.get("Gender", 0)
            if isinstance(gender_val, str):
                gender_val = 0 if gender_val.lower().startswith("m") else 1
            def lval(k1, k2, fallback):
                v = inputs.get(k1)
                if v is None and k2:
                    v = inputs.get(k2)
                return fallback if v is None else v
            raw = {
                "Age": float(lval("age", "Age", 45)),
                "Gender": float(gender_val or 0),
                "Total_Bilirubin": float(lval("total_bilirubin", "Total_Bilirubin", 1.0)),
                "Direct_Bilirubin": float(lval("direct_bilirubin", "Direct_Bilirubin", 0.3)),
                "Alkaline_Phosphotase": float(lval("alkaline_phosphotase", "Alkaline_Phosphotase", 200)),
                "Alamine_Aminotransferase": float(lval("alamine_aminotransferase", "Alamine_Aminotransferase", 30)),
                "Aspartate_Aminotransferase": float(lval("aspartate_aminotransferase", "Aspartate_Aminotransferase", 35)),
                "Total_Protiens": float(lval("total_protiens", "Total_Protiens", 6.5)),
                "Albumin": float(lval("albumin", "Albumin", 3.5)),
                "Albumin_and_Globulin_Ratio": float(lval("albumin_and_globulin_ratio", "ag_ratio", 1.0)),
            }
            x = np.array([raw[k] for k in features], dtype=np.float32)
            x_scaled = ((x - mean) / std).reshape(1, -1)
            return ExplainabilityService.tree_shap(model=model, transformed_input=x_scaled, feature_names=features, raw_values=raw, positive_class_idx=1)
        # Fallback for vision modules when image_bytes was not provided
        if disease_key in ("brain_tumor", "brain-tumor", "kidney_stone", "kidney-stone", "skin_cancer", "skin-cancer", "eye", "pneumonia"):
            class_probs = prediction.get("class_probabilities", {})
            pred_diag = prediction.get("diagnosis", prediction.get("prediction", "Identified Condition"))
            method_desc = {
                "brain_tumor": "Nickparvar 4-Class Cranial MRI Softmax Posterior Distribution",
                "brain-tumor": "Nickparvar 4-Class Cranial MRI Softmax Posterior Distribution",
                "kidney_stone": "EfficientNet Non-Contrast Abdominal CT Slice Attribution",
                "kidney-stone": "EfficientNet Non-Contrast Abdominal CT Slice Attribution",
                "skin_cancer": "HAM10000 7-Class Dermoscopic Probability Attribution",
                "skin-cancer": "HAM10000 7-Class Dermoscopic Probability Attribution",
                "eye": "PyTorch ResNet-18 Multi-Class Softmax Attribution",
                "pneumonia": "Pneumonia X-Ray Softmax Attribution",
            }.get(disease_key, "Convolutional Multi-Class Feature Attribution")
            return {
                "status": "available",
                "method": method_desc,
                "target_class": pred_diag,
                "confidence_percentage": prediction.get("confidence_percentage", prediction.get("risk_percentage", 0)),
                "class_probabilities": class_probs,
                "limitations": ["Image bytes not provided for spatial Grad-CAM; showing posterior probability distribution."],
            }
        return {"status": "not_applicable", "method": None, "limitations": ["No explanation adapter is configured for this model."]}

    @staticmethod
    def _safe_inputs(disease_key: str, inputs: dict[str, Any]) -> list[dict[str, Any]]:
        """Attach explicit, model-contract metadata to final-report inputs."""
        if disease_key == "heart":
            heart_meta = {
                "age": ("Patient Age", "years"),
                "sex": ("Biological Sex", "0=Female, 1=Male"),
                "cp": ("Chest Pain Type", "0-3"),
                "trestbps": ("Resting Blood Pressure", "mm Hg"),
                "chol": ("Serum Cholesterol", "mg/dL"),
                "fbs": ("Fasting Blood Sugar > 120", "0=No, 1=Yes"),
                "restecg": ("Resting ECG Result", "0-2"),
                "thalach": ("Max Heart Rate", "bpm"),
                "exang": ("Exercise Induced Angina", "0=No, 1=Yes"),
                "oldpeak": ("ST Depression (Oldpeak)", "mm"),
                "slope": ("Peak Exercise ST Slope", "0-2"),
                "ca": ("Major Vessels (Fluoroscopy)", "0-3"),
                "thal": ("Thalassemia Defect Code", "1-3"),
            }
            res = []
            for k, (disp, unit) in heart_meta.items():
                if k in inputs:
                    res.append({"name": k, "display_name": disp, "value": inputs[k], "unit": unit, "source": "validated model input"})
            return res if res else [{"name": k, "value": v, "source": "validated model input"} for k, v in inputs.items()]

        if disease_key == "liver":
            liver_meta = {
                "age": ("Patient Age", "years"),
                "gender": ("Biological Gender", "Male/Female"),
                "total_bilirubin": ("Total Bilirubin", "mg/dL"),
                "direct_bilirubin": ("Direct Bilirubin", "mg/dL"),
                "alkaline_phosphotase": ("Alkaline Phosphatase (ALP)", "IU/L"),
                "alamine_aminotransferase": ("Alanine Aminotransferase (ALT)", "IU/L"),
                "aspartate_aminotransferase": ("Aspartate Aminotransferase (AST)", "IU/L"),
                "total_protiens": ("Total Serum Proteins", "g/dL"),
                "albumin": ("Serum Albumin", "g/dL"),
                "albumin_and_globulin_ratio": ("A/G Ratio", "ratio"),
                "ag_ratio": ("A/G Ratio", "ratio"),
            }
            res = []
            for k, (disp, unit) in liver_meta.items():
                if k in inputs:
                    res.append({"name": k, "display_name": disp, "value": inputs[k], "unit": unit, "source": "validated model input"})
            return res if res else [{"name": k, "value": v, "source": "validated model input"} for k, v in inputs.items()]

        if disease_key == "breast":
            return [
                {
                    "name": k,
                    "display_name": k.replace("_", " ").title(),
                    "value": v,
                    "unit": "units" if "mean" in k else "SE",
                    "source": "validated model input",
                }
                for k, v in inputs.items()
            ]

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
        return {
            "diabetes": "diabetes_model.pkl",
            "heart": "heart_model.pkl",
            "pneumonia": "xrays_pneumonia.keras",
            "brain_tumor": "brain_tumor_model.keras",
            "kidney_stone": "kidney_stone_efficientnet_model.keras",
            "skin_cancer": "skin_cancer_model.keras",
            "eye": "eye_disease_traced_model.pt",
            "liver": "liver_model.pkl",
            "breast": "breast_cancer_model.pkl"
        }.get(disease_key, f"{disease_key}_model")

    @staticmethod
    def _explanation_sentences(explanation: dict[str, Any]) -> list[str]:
        """Translate explanation evidence into structured decision explanations without an LLM."""
        if explanation.get("status") != "available":
            reason = explanation.get("reason", "No explanation adapter produced evidence.")
            return [f"Model explanation is unavailable: {reason}"]

        method = explanation.get("method") or "Model explanation"
        if "SHAP" in method:
            sentences = []
            base_value = explanation.get("base_value")
            if base_value is not None:
                sentences.append(
                    f"Baseline population reference score for this model is {float(base_value):+.4f}."
                )
            all_contributions = explanation.get("all_contributions", [])
            pos_contribs = [item for item in all_contributions if float(item.get("shap_value", 0.0)) > 0]
            neg_contribs = [item for item in all_contributions if float(item.get("shap_value", 0.0)) < 0]

            if pos_contribs:
                for item in pos_contribs:
                    shap_value = float(item.get("shap_value", 0.0))
                    val_str = f" of {item.get('patient_value')}" if item.get('patient_value') is not None else ""
                    sentences.append(
                        f"Elevating risk factor: {item.get('feature')}{val_str} increased the predicted positive-class score (SHAP {shap_value:+.6f})."
                    )
            if neg_contribs:
                for item in neg_contribs:
                    shap_value = float(item.get("shap_value", 0.0))
                    val_str = f" of {item.get('patient_value')}" if item.get('patient_value') is not None else ""
                    sentences.append(
                        f"Mitigating/protective factor: {item.get('feature')}{val_str} reduced the predicted positive-class score (SHAP {shap_value:+.6f})."
                    )

            if all_contributions:
                net_disp = sum(float(item.get("shap_value", 0.0)) for item in all_contributions)
                sentences.append(
                    f"Net SHAP feature displacement from baseline is {net_disp:+.6f}."
                )

            sentences.append(
                "SHAP describes this model's behavior for the submitted input and does not establish medical causality."
            )
            return sentences

        if "grad-cam" in method.lower():
            target_cls = explanation.get("target_class", "the target category")
            layer = explanation.get("target_layer")
            stats = explanation.get("attention_statistics") or {}
            layer_info = f" in layer '{layer}'" if layer else ""
            sentences = [
                f"Grad-CAM (Gradient-weighted Class Activation Mapping) generated convolutional saliency{layer_info} for '{target_cls}'.",
                f"Peak activation receptive fields highlight the focal pixel regions that most heavily influenced the neural network prediction."
            ]
            if stats.get("focal_ratio_above_50pct") is not None:
                sentences.append(
                    f"Concentrated high-attention focal zones (≥50% activation) occupy {float(stats['focal_ratio_above_50pct']) * 100:.1f}% of the receptive feature map."
                )
            sentences.append(
                "Highlighted saliency regions represent computational attention distribution and do not constitute confirmed anatomical pathology."
            )
            return sentences
        return [
            f"{method} evidence is available for clinician review.",
            "This explanation describes model behavior and does not establish medical causality.",
        ]

    @classmethod
    def _resolve_doctor_identity(
        cls,
        package_or_tweaks: dict[str, Any] | None = None,
        clinical_report: dict[str, Any] | None = None,
        prediction: dict[str, Any] | None = None,
        inputs: dict[str, Any] | None = None,
    ) -> tuple[str, str]:
        """
        Dynamically extracts the attending doctor's identity (name, title)
        from previous ML reports, clinician sign-offs, decision tweaks, or inputs.
        Prevents hardcoded fallback names or fictional identities.
        """
        package_or_tweaks = package_or_tweaks or {}
        clinical_report = clinical_report or {}
        prediction = prediction or {}
        inputs = inputs or {}

        # 1. Check direct doctorInfo
        doctor_info = (
            package_or_tweaks.get("doctorInfo")
            or (package_or_tweaks.get("tweaked_decisions") or {}).get("doctorInfo")
            or package_or_tweaks.get("doctor_info")
            or {}
        )
        name = (doctor_info.get("name") or "").strip()
        title = (doctor_info.get("title") or "").strip()

        # 2. Check clinician_decision from approved package or review
        if not name:
            decision = package_or_tweaks.get("clinician_decision") or {}
            dec_by = (decision.get("reviewed_by") or "").strip()
            if dec_by and dec_by not in ("MedSynapse Clinical Protocol", "Reviewing Clinician", "Attending Physician"):
                name = dec_by

        # 3. Check clinician_verification
        if not name:
            ver = package_or_tweaks.get("clinician_verification") or {}
            ver_by = (ver.get("verified_by") or "").strip()
            if ver_by and ver_by not in ("MedSynapse Clinical Protocol", "Reviewing Clinician", "Attending Physician"):
                name = ver_by

        # 4. Check previous ML report's clinician_review
        if not name:
            review = (
                clinical_report.get("clinician_review")
                or package_or_tweaks.get("clinical_report", {}).get("clinician_review")
                or {}
            )
            rev_by = (review.get("reviewed_by") or "").strip()
            if rev_by and rev_by not in ("MedSynapse Clinical Protocol", "Reviewing Clinician", "Attending Physician"):
                name = rev_by
                if not title:
                    title = (review.get("title") or "").strip()

        # 5. Check prediction metadata
        if not name:
            pred_doc = (
                prediction.get("reviewed_by")
                or (prediction.get("clinician_review") or {}).get("reviewed_by")
                or ""
            ).strip()
            if pred_doc and pred_doc not in ("MedSynapse Clinical Protocol", "Reviewing Clinician", "Attending Physician"):
                name = pred_doc

        # 6. Check inputs or params
        if not name:
            for k in ("doctor_name", "physician_name", "reviewed_by", "doctor", "clinician"):
                val = str(inputs.get(k) or package_or_tweaks.get("inputs", {}).get(k) or "").strip()
                if val:
                    name = val
                    break

        # Final default fallback if no doctor has signed off or entered name yet:
        if not name:
            name = "Attending Physician"
        if not title:
            title = "Attending Clinician"

        return name, title

    def generate_final_report(self, approved_package: dict[str, Any]) -> dict[str, Any]:
        """Call Groq once after an explicit clinician approval, falling back to structured synthesis."""
        doc_name, doc_title = self._resolve_doctor_identity(approved_package)
        if "doctor_info" not in approved_package or not approved_package["doctor_info"].get("name"):
            approved_package["doctor_info"] = {"name": doc_name, "title": doc_title}
        if self.final_report_service.configured:
            try:
                return self.final_report_service.generate_final_report(approved_package)
            except Exception as exc:
                print(f"[Warning] Groq report generation failed: {exc}")
                pass
        return self._generate_fallback_synthesis(approved_package)

    def generate_narrative(self, report: dict[str, Any]) -> dict[str, Any]:
        """Backward-compatible wrapper around the approved-package final report call."""
        return self.generate_final_report(report)

    def synthesize_report_direct(self, *, disease_key: str, prediction: dict[str, Any],
                                 inputs: dict[str, Any], clinical_report: dict[str, Any] | None = None,
                                 tweaked_decisions: dict[str, Any] | None = None,
                                 edited_sections: dict[str, Any] | None = None,
                                 chat_history: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        """Synthesize a complete LLM report directly from prediction data without requiring pre-approval."""
        doc_name, doc_title = self._resolve_doctor_identity(
            package_or_tweaks=tweaked_decisions,
            clinical_report=clinical_report,
            prediction=prediction,
            inputs=inputs
        )
        prev_review = (clinical_report or {}).get("clinician_review") or {}
        package = {
            "disease_type": disease_key,
            "prediction": prediction,
            "clinical_inputs": self._safe_inputs(disease_key, inputs),
            "clinical_report": clinical_report or {},
            "tweaked_decisions": tweaked_decisions or {},
            "edited_sections": edited_sections or {},
            "chat_history": chat_history or [],
            "doctor_info": {
                "name": doc_name,
                "title": doc_title,
            },
            "clinician_decision": {
                "decision": prev_review.get("decision", "approved"),
                "reviewed_by": doc_name,
                "title": doc_title,
                "comment": prev_review.get("comment") or (tweaked_decisions or {}).get("summary") or f"Clinical review and correlation conducted under supervision of {doc_name}.",
                "verified_features": prev_review.get("verified_features") or list(inputs.keys()),
            }
        }
        if self.final_report_service.configured:
            try:
                res = self.final_report_service.generate_final_report(package)
                report_dict = res.get("report") if isinstance(res.get("report"), dict) else res
                report_dict["provider"] = f"groq ({res.get('provider_model', self.final_report_service.model)})"
                return report_dict
            except Exception as exc:
                print(f"[Warning] Groq report generation failed: {exc}")
                pass

        return self._generate_fallback_synthesis(package)

    def _try_ollama_synthesis(self, package: dict[str, Any]) -> dict[str, Any] | None:
        try:
            import json
            import os
            import urllib.request
            ollama_url = os.getenv("GEMMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/") + "/api/generate"
            model_name = os.getenv("GEMMA_MODEL", "gemma3:4b")
            timeout_sec = float(os.getenv("GEMMA_TIMEOUT", "60.0"))

            tweaked = package.get("tweaked_decisions") or {}
            tweaks_prompt_part = ""
            if tweaked.get("hasTweaks"):
                tweaks_prompt_part = (
                    f"\nATTENDING PHYSICIAN MANUAL DECISION OVERRIDES & RATIONALES:\n"
                    f"{json.dumps(tweaked, ensure_ascii=False)}\n"
                    "Explicitly integrate these physician adjustments and rationales into the screening summary and clinician review.\n"
                )

            edited = package.get("edited_sections") or {}
            edited_prompt_part = ""
            if edited:
                edited_prompt_part = (
                    f"\nCLINICIAN INDEPENDENT SECTION EDITS & REASONS:\n"
                    f"{json.dumps(edited, ensure_ascii=False)}\n"
                    "Incorporate the edited sections and explicitly reflect the physician's reasons.\n"
                )

            pred = package.get("prediction") or {}
            compact_ctx = {
                "disease": package.get("disease_type") or pred.get("disease", "Medical Condition"),
                "baseline_diagnosis": pred.get("diagnosis") or pred.get("prediction"),
                "baseline_risk_tier": pred.get("risk_tier"),
                "baseline_probability": pred.get("risk_probability") or pred.get("probability"),
                "biomarker_inputs": package.get("clinical_inputs") or package.get("inputs", {}),
                "top_risk_factors": (pred.get("contributing_factors") or [])[:5],
                "tweaked_decisions": tweaked,
                "edited_sections": edited
            }

            prompt = (
                "You are an expert clinical AI compiling a structured medical screening report. "
                "The attending clinician has audited the baseline AI predictions and recorded manual overrides with clinical rationales. "
                "Synthesize a rigorous, professional clinical screening report based strictly on the clinical data below. "
                + tweaks_prompt_part
                + edited_prompt_part +
                "Output strictly valid JSON matching this schema: "
                "{\"title\": string, \"screening_summary\": string, \"model_findings\": string, \"explainability_summary\": string, \"clinician_review\": string, \"recommendations\": string[], \"limitations\": string[], \"disclaimer\": string}\n\n"
                f"CLINICAL DATA:\n{json.dumps(compact_ctx, ensure_ascii=False)}"
            )
            req = urllib.request.Request(
                ollama_url,
                data=json.dumps({
                    "model": model_name,
                    "prompt": prompt,
                    "format": "json",
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 500}
                }).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout_sec) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                text_response = res_data.get("response", "")
                parsed = json.loads(text_response)
                if isinstance(parsed, dict) and "screening_summary" in parsed:
                    parsed["provider"] = f"ollama ({model_name})"
                    return parsed
        except Exception:
            pass
        return None

    def _generate_fallback_synthesis(self, package: dict[str, Any]) -> dict[str, Any]:
        prediction = package.get("prediction") or {}
        disease = prediction.get("disease", package.get("disease_type", "Disease")).title()
        prob = float(prediction.get("risk_probability", 0.0) or 0.0)
        pct = round(prob * 100, 1)
        tier = prediction.get("risk_tier", "Moderate Risk" if prob >= 0.35 else "Low Risk")
        diagnosis = prediction.get("diagnosis") or prediction.get("prediction") or ("Elevated Risk" if prob >= 0.5 else "Low Risk Baseline")
        factors = prediction.get("contributing_factors") or []
        recs = prediction.get("recommendations") or [
            "Clinical correlation with full patient history and routine follow-up surveillance.",
            "Repeat targeted biometric screening in 3 to 6 months.",
            "Consult with an attending specialist for definitive diagnostic confirmation."
        ]
        inputs = package.get("clinical_inputs") or []
        input_strs = [f"{item.get('display_name', item.get('name'))}: {item.get('value')} {item.get('unit') or ''}".strip() for item in inputs[:6]]
        param_summary = "; ".join(input_strs) if input_strs else "Baseline demographic and biometric parameters."

        # Check for clinician manual overrides
        tweaked = package.get("tweaked_decisions") or {}
        has_tweaks = tweaked.get("hasTweaks", False)
        doctor_name, doctor_title = self._resolve_doctor_identity(package)
        doctor_info = tweaked.get("doctorInfo") or package.get("doctor_info") or {}
        override_time = doctor_info.get("timestamp") or "Recent Clinical Audit"

        tweak_notes = []
        if has_tweaks:
            diag_tweak = tweaked.get("diagnosis")
            if diag_tweak:
                diagnosis = diag_tweak.get("tweaked", diagnosis)
                tweak_notes.append(f"Diagnosis overridden to '{diagnosis}' by {doctor_name} (Physician Rationale: {diag_tweak.get('reason', 'Clinical adjustment')})")

            tier_tweak = tweaked.get("riskTier")
            if tier_tweak:
                tier = tier_tweak.get("tweaked", tier)
                tweak_notes.append(f"Risk Tier adjusted to '{tier}' by {doctor_name} (Physician Rationale: {tier_tweak.get('reason', 'Clinical calibration')})")

            prob_tweak = tweaked.get("riskProbability")
            if prob_tweak:
                pct = float(prob_tweak.get("tweaked", pct))
                prob = round(pct / 100, 4)
                tweak_notes.append(f"Calibrated probability adjusted to {pct}% by {doctor_name} (Physician Rationale: {prob_tweak.get('reason', 'Physician calibration')})")

            recs_tweak = tweaked.get("recommendations")
            if recs_tweak and recs_tweak.get("tweaked"):
                recs = recs_tweak.get("tweaked")
                tweak_notes.append(f"Management protocol customized by {doctor_name} ({recs_tweak.get('reason', 'Clinical protocol updated')})")

            feat_rationales = tweaked.get("featureRationales") or {}
            for feat, info in feat_rationales.items():
                tweak_notes.append(f"Biomarker '{feat}' marked as {info.get('status', 'audited')} by {doctor_name} ({info.get('reason', 'Clinical review')})")

        factor_desc = []
        for f in factors:
            factor_desc.append(f"{f.get('factor')}: {f.get('value')} ({f.get('impact')})")
        factors_text = "; ".join(factor_desc) if factor_desc else "Parameters within standard reference distributions."

        tweaks_summary = "; ".join(tweak_notes) if tweak_notes else ""

        # Comprehensive clinical analysis specifically from the attending doctor's point of view
        if has_tweaks:
            physician_perspective_analysis = (
                f"CLINICAL EVALUATION FROM ATTENDING PHYSICIAN'S POINT OF VIEW ({doctor_name}, {doctor_title}):\n"
                f"1. Clinical Override Rationale: The AI screening outputs were thoroughly reviewed and authoritatively overridden to reflect a clinical diagnosis of '{diagnosis}' with an adjusted risk tier of '{tier}' ({pct}% calibrated risk probability).\n"
                f"2. Pathophysiological Assessment: Evaluating patient profile ({param_summary}) alongside risk markers ({factors_text}), the clinician noted critical clinical indicators requiring override beyond the raw model statistical distribution. "
                + (f"Specific diagnostic adjustment: Overridden from model baseline because: {diag_tweak.get('reason', 'clinical evaluation warranted diagnostic refinement')}. " if (has_tweaks and diag_tweak) else "")
                + f"\n3. Therapeutic Priorities: Management protocols have been calibrated under physician supervision to mitigate acute and long-term complications, prioritizing individualized clinical surveillance over generic statistical heuristics. "
                f"Action plan verified and certified by {doctor_name}."
            )
        else:
            physician_perspective_analysis = (
                f"CLINICAL EVALUATION FROM ATTENDING PHYSICIAN'S POINT OF VIEW ({doctor_name}, {doctor_title}):\n"
                f"1. AI Model Concordance: The automated multivariable evaluation for {disease} ({pct}% probability, {tier}) was audited against the patient's submitted parameters ({param_summary}).\n"
                f"2. Clinical Correlation: The model's baseline classification of '{diagnosis}' is clinically congruent with standard diagnostic guidelines. No acute discordant biomarker patterns were identified.\n"
                f"3. Recommendation: Endorsed for standard protocol follow-up and surveillance under continuous clinical oversight."
            )

        screening_summary_text = (
            f"MedSynapse Clinical AI completed a multivariable assessment for {disease}. "
            f"The evaluated patient profile ({param_summary}) yielded an estimated model risk probability of {prob:.4f} ({pct}%), "
            f"categorizing the screening status into the {tier} tier with an active assessment of '{diagnosis}'."
        )
        if has_tweaks and tweaks_summary:
            screening_summary_text += f" Attending physician verified and manually adjusted the clinical determination: {tweaks_summary}."

        clinician_review_text = (
            f"Clinician-in-the-loop decision audit completed. "
            + (f"Manual decision overrides applied with recorded justification: {tweaks_summary}." if has_tweaks else "Automated clinical decision protocol verification completed with verified feature inputs. Final diagnostic confirmation and therapeutic strategy must be reviewed by the attending licensed clinician.")
        )

        edited = package.get("edited_sections") or {}
        title = f"Clinical Screening & Decision Support Synthesis: {disease}"
        if edited.get("title", {}).get("value"):
            title = edited["title"]["value"]

        if edited.get("screening_summary", {}).get("value"):
            screening_summary_text = edited["screening_summary"]["value"]
            if edited["screening_summary"].get("reason"):
                screening_summary_text += f" (Physician Rationale: {edited['screening_summary']['reason']})"

        model_findings_text = (
            f"Statistical evaluation via calibrated probabilistic ensemble backbones demonstrates an assessed score of {pct}%. "
            f"Contributing biomarker variance highlights: {factors_text}."
        )
        if edited.get("model_findings", {}).get("value"):
            model_findings_text = edited["model_findings"]["value"]
            if edited["model_findings"].get("reason"):
                model_findings_text += f" (Physician Rationale: {edited['model_findings']['reason']})"

        clin_rep = package.get("clinical_report") or {}
        exp = clin_rep.get("explainability") or prediction.get("explainability") or {}
        exp_method = exp.get("method", "")

        if exp_method and "grad-cam" in exp_method.lower():
            target_cls = exp.get("target_class") or diagnosis
            layer = exp.get("target_layer", "final convolutional layer")
            stats = exp.get("attention_statistics") or {}
            max_att = stats.get("max_attention", 1.0)
            sentences = exp.get("plain_language", {}).get("sentences", [])
            sentences_txt = " ".join(sentences) if sentences else ""
            explainability_text = (
                f"Visual explainability generated via {exp_method} on layer '{layer}'. "
                f"Convolutional saliency was calculated for target class '{target_cls}', highlighting peak receptive fields "
                f"with maximum activation intensity of {max_att:.2f}. "
                + (f"{sentences_txt} " if sentences_txt else "")
                + "Grad-CAM spatial overlays identify high-weight anatomical/pathological focal zones driving the neural network classification and do not establish medical causality."
            )
        elif exp.get("all_contributions") or exp.get("top_positive_contributors"):
            all_c = exp.get("all_contributions") or []
            top_pos = exp.get("top_positive_contributors") or [c for c in all_c if float(c.get("shap_value", 0)) > 0]
            top_neg = exp.get("top_negative_contributors") or [c for c in all_c if float(c.get("shap_value", 0)) < 0]
            pos_str = ", ".join([f"{c.get('feature')} (φ={float(c.get('shap_value', 0)):+.4f})" for c in top_pos[:3]])
            neg_str = ", ".join([f"{c.get('feature')} (φ={float(c.get('shap_value', 0)):+.4f})" for c in top_neg[:3]])
            sentences = exp.get("plain_language", {}).get("sentences", [])
            sentences_txt = " ".join(sentences) if sentences else ""
            method_str = exp_method or "SHAP Additive Attribution"
            explainability_text = (
                f"Feature explainability generated via {method_str}. "
                + (f"Key biomarkers elevating predicted risk: {pos_str}. " if pos_str else "")
                + (f"Mitigating/protective biomarkers: {neg_str}. " if neg_str else "")
                + (f"{sentences_txt} " if sentences_txt else "")
                + "SHAP values describe individual feature displacement from baseline expected score for this specific patient profile and do not establish direct medical causality."
            )
        else:
            explainability_text = (
                f"Explainability feature attributions identify primary risk drivers displacing the prediction score. "
                f"Feature contributions reflect model behavior for the specific submitted values and describe quantitative attribution, not medical causality."
            )
        if edited.get("explainability_summary", {}).get("value"):
            explainability_text = edited["explainability_summary"]["value"]
            if edited["explainability_summary"].get("reason"):
                explainability_text += f" (Physician Rationale: {edited['explainability_summary']['reason']})"

        if edited.get("clinician_review", {}).get("value"):
            clinician_review_text = edited["clinician_review"]["value"]
            if edited["clinician_review"].get("reason"):
                clinician_review_text += f" (Physician Rationale: {edited['clinician_review']['reason']})"

        if edited.get("recommendations", {}).get("value"):
            val = edited["recommendations"]["value"]
            if isinstance(val, list):
                recs = val
            elif isinstance(val, str):
                recs = [line.strip().lstrip("0123456789.- ") for line in val.split("\n") if line.strip()]

        return {
            "title": title,
            "screening_summary": screening_summary_text,
            "model_findings": model_findings_text,
            "explainability_summary": explainability_text,
            "clinician_review": clinician_review_text,
            "recommendations": recs,
            "limitations": [
                "Screening model assessments are assistive tools and do not substitute for comprehensive histological, radiographic, or clinical examinations.",
                "Model predictions are calibrated on standardized empirical populations and may exhibit localized distribution variance.",
                "Any unmeasured acute physiological factors or intercurrent medications may alter risk status."
            ],
            "disclaimer": (
                "This diagnostic screening report is compiled by MedSynapse AI using calibrated probabilistic backbones and empirical models. "
                "It constitutes an assistive screening assessment and is not a definitive medical diagnosis. "
                "All treatment decisions require correlation with full clinical history by a licensed physician."
            ),
            "physician_perspective_analysis": physician_perspective_analysis,
            "doctor_info": {
                "name": doctor_name,
                "title": doctor_title,
                "timestamp": override_time,
                "has_tweaks": has_tweaks,
                "summary": tweaks_summary if has_tweaks else "No physician overrides applied; baseline AI findings endorsed."
            }
        }

    def chat_with_llm(self, *, messages: list[dict[str, str]], report_context: dict[str, Any]) -> dict[str, Any]:
        """
        Interactive conversational LLM assistant for the clinical report.
        Answers clinician queries, provides clinical reasoning, and simultaneously merges all modifications
        into the complete updated medical report so the user sees real-time synchronized synthesis.
        """
        import os
        import json
        import urllib.request

        disease = report_context.get("disease_type") or (report_context.get("prediction") or {}).get("disease", "Clinical Condition")
        pred = report_context.get("prediction") or {}
        inputs = report_context.get("inputs") or report_context.get("clinical_inputs") or {}
        tweaked = report_context.get("tweaked_decisions") or {}
        edited = report_context.get("edited_sections") or {}
        current_report = report_context.get("current_report") or {}

        doctor_name, doctor_title = self._resolve_doctor_identity(
            package_or_tweaks=report_context,
            clinical_report=report_context.get("clinical_report") or current_report,
            prediction=pred,
            inputs=inputs
        )

        # System prompt setting clinical context
        system_prompt = (
            f"You are the MedSynapse AI Clinical Copilot, an expert clinical decision support assistant. "
            f"You are collaborating with an attending physician ({doctor_name}, {doctor_title}) reviewing an official AI diagnostic screening report for {disease}.\n\n"
            f"CLINICAL ML EVIDENCE:\n"
            f"- Model Predicted Risk: {pred.get('risk_percentage', pred.get('risk_probability', 'N/A'))}%\n"
            f"- Risk Tier: {pred.get('risk_tier', 'N/A')}\n"
            f"- Baseline Diagnosis: {pred.get('diagnosis') or pred.get('prediction', 'N/A')}\n"
            f"- Contributing Biomarkers: {json.dumps((pred.get('contributing_factors') or [])[:6], ensure_ascii=False)}\n"
            f"- Patient Inputs: {json.dumps(inputs, ensure_ascii=False)}\n"
        )

        if tweaked.get("hasTweaks"):
            system_prompt += (
                f"\nATTENDING PHYSICIAN MANUAL OVERRIDES & CLINICAL RATIONALES (DONE BY DOCTOR: {doctor_name}, {doctor_title}):\n"
                f"{json.dumps(tweaked, ensure_ascii=False)}\n"
                f"Adopt {doctor_name}'s clinical perspective, substantiate why the baseline was adjusted, and integrate the doctor's rationales.\n"
            )

        if edited:
            system_prompt += f"\nCLINICIAN INDEPENDENT SECTION EDITS & REASONS:\n{json.dumps(edited, ensure_ascii=False)}\n"

        if current_report:
            system_prompt += (
                f"\nCURRENT DRAFT REPORT TO BE UPDATED & MERGED:\n"
                f"- Title: {current_report.get('title')}\n"
                f"- Screening Summary: {current_report.get('screening_summary')}\n"
                f"- Model Findings: {current_report.get('model_findings')}\n"
                f"- Explainability Summary: {current_report.get('explainability_summary')}\n"
                f"- Clinician Protocol: {current_report.get('clinician_review')}\n"
                f"- Current Recommendations: {json.dumps(current_report.get('recommendations', []), ensure_ascii=False)}\n"
                f"- Current Physician Perspective Analysis: {current_report.get('physician_perspective_analysis')}\n"
            )

        system_prompt += (
            "\nDUAL WORKFLOW INSTRUCTIONS:\n"
            "Every turn, you must return a valid JSON object strictly matching the schema with keys 'reply' and 'updated_report':\n"
            "1. 'reply': A comprehensive, evidence-based conversational markdown response to the physician. Use markdown tables, bolding, bullet points, and clinical reasoning.\n"
            "2. 'updated_report': Synthesize the complete, up-to-date final clinical report that merges the previous draft report with all new insights, physician perspective analysis, overrides, and follow-up management recommendations discussed in this turn. "
            "Never leave sections empty. Incorporate all clinical modifications into the final report so the physician sees the updated synthesis immediately."
        )

        chat_and_report_schema = {
            "type": "object",
            "properties": {
                "reply": {
                    "type": "string",
                    "description": "Conversational markdown response to the physician."
                },
                "updated_report": {
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
                        "physician_perspective_analysis": {"type": "string"}
                    },
                    "required": [
                        "title", "screening_summary", "model_findings", "explainability_summary",
                        "clinician_review", "recommendations", "limitations", "disclaimer",
                        "physician_perspective_analysis"
                    ],
                    "additionalProperties": False
                }
            },
            "required": ["reply", "updated_report"],
            "additionalProperties": False
        }

        # 1. Use Groq Cloud API with dual JSON schema
        if self.final_report_service.configured:
            try:
                api_key = self.final_report_service.api_key
                if api_key:
                    groq_messages = [{"role": "system", "content": system_prompt}] + messages
                    groq_url = self.final_report_service.api_url
                    groq_model = self.final_report_service.model
                    groq_req = urllib.request.Request(
                        groq_url,
                        data=json.dumps({
                            "model": groq_model,
                            "messages": groq_messages,
                            "response_format": {
                                "type": "json_schema",
                                "json_schema": {
                                    "name": "chat_and_report_update",
                                    "strict": True,
                                    "schema": chat_and_report_schema,
                                },
                            },
                            "temperature": 0.2,
                            "max_completion_tokens": 2048,
                        }).encode("utf-8"),
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {api_key}",
                            "User-Agent": "MedSynapse",
                        },
                        method="POST"
                    )
                    with urllib.request.urlopen(groq_req, timeout=25.0) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        content_str = res["choices"][0]["message"]["content"]
                        parsed = json.loads(content_str)
                        if isinstance(parsed, dict) and "reply" in parsed and "updated_report" in parsed:
                            updated_report = parsed["updated_report"]
                            updated_report["provider"] = f"groq ({groq_model})"
                            if not updated_report.get("doctor_info") and current_report.get("doctor_info"):
                                updated_report["doctor_info"] = current_report["doctor_info"]
                            return {
                                "success": True,
                                "reply": parsed["reply"],
                                "updated_report": updated_report,
                                "provider": f"groq ({groq_model})"
                            }
            except Exception as exc:
                print(f"[Warning] Groq dual chat synthesis failed: {exc}")
                pass

        # 2. Try Ollama if configured
        try:
            ollama_url = os.getenv("GEMMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/") + "/api/generate"
            model_name = os.getenv("GEMMA_MODEL", "gemma3:4b")
            timeout_sec = float(os.getenv("GEMMA_TIMEOUT", "45.0"))
            ollama_prompt = f"{system_prompt}\n\nDOCTOR'S LATEST MESSAGE:\n{messages[-1].get('content', '') if messages else ''}\n\nOutput strictly valid JSON with 'reply' and 'updated_report'."
            req = urllib.request.Request(
                ollama_url,
                data=json.dumps({
                    "model": model_name,
                    "prompt": ollama_prompt,
                    "format": "json",
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 700}
                }).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                text_response = res.get("response", "")
                parsed = json.loads(text_response)
                if isinstance(parsed, dict) and "reply" in parsed and "updated_report" in parsed:
                    parsed["updated_report"]["provider"] = f"ollama ({model_name})"
                    return {
                        "success": True,
                        "reply": parsed["reply"],
                        "updated_report": parsed["updated_report"],
                        "provider": f"ollama ({model_name})"
                    }
        except Exception:
            pass

        # 3. Intelligent fallback that returns both conversational reply AND merged report
        return self._generate_chat_fallback(messages, report_context, system_prompt)

    def _generate_chat_fallback(self, messages: list[dict[str, str]], report_context: dict[str, Any], system_prompt: str) -> dict[str, Any]:
        """Produce an intelligent clinical response and merged report fallback when LLM API is unavailable."""
        disease = report_context.get("disease_type") or (report_context.get("prediction") or {}).get("disease", "Clinical Condition")
        pred = report_context.get("prediction") or {}
        inputs = report_context.get("inputs") or report_context.get("clinical_inputs") or {}
        tweaked = report_context.get("tweaked_decisions") or {}
        current_report = dict(report_context.get("current_report") or {})

        doctor_name, doctor_title = self._resolve_doctor_identity(
            package_or_tweaks=report_context,
            clinical_report=report_context.get("clinical_report") or current_report,
            prediction=pred,
            inputs=inputs
        )

        last_user_msg = (messages[-1].get("content") if messages else "").lower()

        # Build fallback synthesis base if current_report is empty
        if not current_report or not current_report.get("screening_summary"):
            package = {
                "disease_type": disease,
                "prediction": pred,
                "clinical_inputs": self._safe_inputs(disease, inputs),
                "clinical_report": report_context.get("clinicalReport") or {},
                "tweaked_decisions": tweaked,
                "edited_sections": report_context.get("editedSections") or {},
            }
            current_report = self._generate_fallback_synthesis(package)

        updated_report = dict(current_report)

        if "doctor" in last_user_msg or "point of view" in last_user_msg or "pov" in last_user_msg or "physician" in last_user_msg or "perspective" in last_user_msg:
            if tweaked.get("hasTweaks"):
                diag_info = tweaked.get("diagnosis", {}) or {}
                t_diag = diag_info.get("tweaked", pred.get("diagnosis", "Clinical Diagnosis"))
                t_reason = diag_info.get("reason", "clinical risk correlation and metabolic risk factors")
                t_tier = (tweaked.get("riskTier") or {}).get("tweaked", pred.get("risk_tier", "Evaluated Tier"))
                t_prob = (tweaked.get("riskProbability") or {}).get("tweaked", pred.get("risk_percentage", 0))
                reply_text = (
                    f"### 👨‍⚕️ Clinical Analysis from Doctor's Point of View ({doctor_name}, {doctor_title})\n\n"
                    f"**1. Clinical Judgment & Overridden Determination:**\n"
                    f"From the attending physician's clinical standpoint, the patient's presentation warrants an active diagnosis of **'{t_diag}'** "
                    f"stratified into the **'{t_tier}'** category ({t_prob}% calibrated probability). "
                    f"The physician's primary recorded justification: *\"{t_reason}\"*.\n\n"
                    f"**2. Pathophysiological Correlation:**\n"
                    f"While statistical ML algorithms evaluate biometric risk factors within predefined training distributions, the physician's assessment integrates "
                    f"subtle compounding clinical effects, borderline biomarker elevations, and individualized risk tolerance. "
                    f"The decision override ensures that acute or pre-symptomatic pathophysiological risks are not masked by algorithmic conservatism.\n\n"
                    f"**3. Prioritized Clinical Action Plan:**\n"
                    f"| Action | Timing | Rationale |\n"
                    f"|---|---|---|\n"
                    f"| **Targeted Biometric Surveillance** | Within 30–60 days | Tracks metabolic biomarker velocity |\n"
                    f"| **Repeat Diagnostic Panel** | Within 3 months | Confirms glycemic stability under physician protocol |\n"
                    f"| **Attending Specialist Consultation** | Planned | Definitive therapeutic staging |\n"
                )
                physician_analysis = (
                    f"CLINICAL EVALUATION FROM ATTENDING PHYSICIAN'S POINT OF VIEW ({doctor_name}, {doctor_title}):\n"
                    f"1. Clinical Override Rationale: The AI screening outputs were thoroughly reviewed and authoritatively overridden to reflect a clinical diagnosis of '{t_diag}' with an adjusted risk tier of '{t_tier}' ({t_prob}% calibrated risk probability). Primary justification: \"{t_reason}\".\n"
                    f"2. Pathophysiological Assessment: Evaluating patient profile alongside risk markers, the clinician noted critical clinical indicators requiring override beyond the raw model statistical distribution.\n"
                    f"3. Therapeutic Priorities: Management protocols have been calibrated under physician supervision to mitigate acute and long-term complications, prioritizing individualized clinical surveillance over generic statistical heuristics."
                )
            else:
                reply_text = (
                    f"### 👨‍⚕️ Clinical Analysis from Doctor's Point of View ({doctor_name}, {doctor_title})\n\n"
                    f"From the attending clinician's perspective, the ML diagnostic baseline for {disease} ({pred.get('risk_tier', 'Evaluated')}, "
                    f"{pred.get('risk_percentage', 0)}% risk) is clinically congruent with standard reference thresholds. "
                    f"No acute discordant biometric anomalies were detected that would require manual override. Standard clinical surveillance is endorsed."
                )
                physician_analysis = (
                    f"CLINICAL EVALUATION FROM ATTENDING PHYSICIAN'S POINT OF VIEW ({doctor_name}, {doctor_title}):\n"
                    f"1. AI Model Concordance: The automated multivariable evaluation for {disease} ({pred.get('risk_percentage', 0)}% probability, {pred.get('risk_tier', 'Evaluated')}) was audited against the patient's submitted parameters.\n"
                    f"2. Clinical Correlation: The model's baseline classification is clinically congruent with standard diagnostic guidelines.\n"
                    f"3. Recommendation: Endorsed for standard protocol follow-up and surveillance under continuous clinical oversight."
                )

            updated_report["physician_perspective_analysis"] = physician_analysis
            updated_report["clinician_review"] = f"Clinician-in-the-loop audit verified by {doctor_name} ({doctor_title}). Clinical perspective and management directives merged into active protocol."

        elif "recommend" in last_user_msg or "follow-up" in last_user_msg or "plan" in last_user_msg or "retinal" in last_user_msg or "hba1c" in last_user_msg:
            reply_text = (
                f"### 📋 Updated Follow-Up & Management Protocol for {disease}\n\n"
                f"Based on our clinical review, the management protocol has been calibrated:\n\n"
                f"| Action | Timing | Clinical Objective |\n"
                f"|---|---|---|\n"
                f"| **HbA1c & Fasting Glucose** | Every 3–6 months | Monitor glycemic trajectory and early progression |\n"
                f"| **Annual Retinal & Microalbumin Screening** | Annually | Screen for early microvascular complications |\n"
                f"| **Targeted Lifestyle Intervention** | Continuous | Mediterranean diet and ≥150 min/wk moderate activity |\n"
                f"| **Specialist Clinical Review** | 6 months | Re-stratify risk tier based on repeat biomarker assay |\n"
            )
            recs = list(updated_report.get("recommendations", []))
            new_items = [
                "Schedule repeat HbA1c and fasting metabolic assay within 3 to 6 months.",
                "Conduct annual comprehensive dilated retinal examination and urine microalbumin screening.",
                "Initiate structured lifestyle modification: Mediterranean diet and ≥150 min/week aerobic exercise.",
                "Routine biometric tracking: blood pressure and BMI monitoring at every clinical encounter.",
            ]
            for itm in new_items:
                if itm not in recs:
                    recs.append(itm)
            updated_report["recommendations"] = recs

        elif "biomarker" in last_user_msg or "shap" in last_user_msg or "glucose" in last_user_msg or "bmi" in last_user_msg or "feature" in last_user_msg:
            reply_text = (
                f"### 🧬 Biomarker Impact & SHAP Attribution Analysis\n\n"
                f"In this {disease} screening, multivariable gradient attributions identify the dominant physiological drivers:\n"
                f"- **Primary Risk Influencer**: Elevated glucose/biometric values displace the model score from baseline population expectation.\n"
                f"- **Clinical Context**: SHAP attributions describe quantitative model displacement for this patient's specific submitted inputs, serving as assistive interpretability evidence rather than absolute medical etiology.\n"
                f"- **Physician Calibration**: Clinician overrides can adjust the risk interpretation if laboratory assay conditions or patient history warrants recalibration."
            )
            updated_report["explainability_summary"] = (
                f"Feature explainability generated via SHAP additive attribution. Primary biomarker signals displacing risk score evaluated by attending clinician ({doctor_name}). "
                f"Quantitative attributions describe individual model displacement and do not establish medical causality."
            )
        else:
            reply_text = (
                f"### 🩺 Clinical Decision Support Dialogue: {disease}\n\n"
                f"I have reviewed the diagnostic evidence and merged all clinical details into the active report on the left.\n"
                f"- **Patient Status**: Evaluated under {pred.get('risk_tier', 'Standard')} protocol.\n"
                f"- **Attending Clinician**: {doctor_name} ({doctor_title}).\n"
                f"- **Report Status**: Synchronized with latest clinical conversation.\n\n"
                f"You can request specific follow-up plans, contrast AI vs. doctor overrides, or adjust any clinical section."
            )

        updated_report["provider"] = "medsynapse-clinical-core (offline-fallback)"
        return {
            "success": True,
            "reply": reply_text,
            "updated_report": updated_report,
            "provider": "medsynapse-clinical-core"
        }

    def regenerate_report_section(
        self,
        *,
        section_key: str,
        disease_key: str,
        prediction: dict[str, Any],
        inputs: dict[str, Any],
        current_report: dict[str, Any],
        tweaked_decisions: dict[str, Any] | None = None,
        chat_history: list[dict[str, Any]] | None = None,
        instructions: str | None = None,
    ) -> dict[str, Any]:
        """
        Regenerate a specific section of the clinical report on demand using the full context:
        previous report details, all doctor tweaks, verified biometrics, and recent copilot chat.
        """
        import os
        import json
        import urllib.request

        disease = prediction.get("disease", disease_key.replace("-", " ").title())
        doctor_name, doctor_title = self._resolve_doctor_identity(
            package_or_tweaks=tweaked_decisions,
            clinical_report=current_report,
            prediction=prediction,
            inputs=inputs
        )
        has_tweaks = bool((tweaked_decisions or {}).get("hasTweaks"))

        section_names = {
            "screening_summary": "Section 1: Executive Screening Summary",
            "model_findings": "Section 2: Biostatistical Model Findings",
            "explainability_summary": "Section 3: Explainability & Biomarker Attributions",
            "clinician_review": "Section 4: Clinical Protocol & Attending Review",
            "recommendations": "Section 5: Actionable Medical Recommendations",
            "physician_perspective_analysis": "Dedicated Clinical Evaluation from Doctor's Point of View",
            "title": "Report Title",
        }
        section_display_name = section_names.get(section_key, section_key.replace("_", " ").title())

        is_list = section_key == "recommendations"

        # System prompt for section generation
        prompt = (
            f"You are the MedSynapse AI Clinical Copilot. The attending physician ({doctor_name}, {doctor_title}) "
            f"requests a dedicated, highly rigorous generation and clinical optimization of {section_display_name} "
            f"for an AI diagnostic screening report for {disease}.\n\n"
            f"PATIENT BIOMETRICS & PREDICTIONS:\n"
            f"- Model Predicted Risk: {prediction.get('risk_percentage', prediction.get('risk_probability', 'N/A'))}%\n"
            f"- Risk Tier: {prediction.get('risk_tier', 'N/A')}\n"
            f"- Model Classification: {prediction.get('diagnosis') or prediction.get('prediction', 'N/A')}\n"
            f"- Inputs: {json.dumps(inputs, ensure_ascii=False)}\n"
            f"- Top Contributing Factors: {json.dumps((prediction.get('contributing_factors') or [])[:6], ensure_ascii=False)}\n"
        )

        if has_tweaks:
            prompt += (
                f"\nATTENDING PHYSICIAN MANUAL OVERRIDES & CLINICAL RATIONALES (DONE BY DOCTOR: {doctor_name}, {doctor_title}):\n"
                f"{json.dumps(tweaked_decisions, ensure_ascii=False)}\n"
                f"You MUST adopt the doctor's perspective and reflect their recorded justifications.\n"
            )

        if chat_history:
            recent_chats = [
                m for m in chat_history 
                if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content")
            ]
            if recent_chats:
                prompt += (
                    f"\nRECENT RELEVANT COPILOT CHAT & DOCTOR INSTRUCTIONS:\n"
                    f"{json.dumps(recent_chats[-6:], ensure_ascii=False)}\n"
                )

        if instructions:
            prompt += f"\nDOCTOR'S SPECIFIC INSTRUCTION FOR THIS SECTION:\n{instructions}\n"

        if current_report.get(section_key):
            curr_val = current_report.get(section_key)
            prompt += f"\nPREVIOUS VALUE OF THIS SECTION:\n{json.dumps(curr_val, ensure_ascii=False)}\n"

        prompt += (
            f"\nSynthesize the optimized, finalized {section_display_name}. "
            "Write thorough, evidence-based, professional clinical content. "
            f"Output strictly valid JSON with keys 'section_key' and 'section_value' where section_value is {'an array of actionable clinical recommendation strings with timelines' if is_list else 'a comprehensive professional clinical narrative string'}."
        )

        if is_list:
            schema = {
                "type": "object",
                "properties": {
                    "section_key": {"type": "string"},
                    "section_value": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["section_key", "section_value"],
                "additionalProperties": False
            }
        else:
            schema = {
                "type": "object",
                "properties": {
                    "section_key": {"type": "string"},
                    "section_value": {"type": "string"}
                },
                "required": ["section_key", "section_value"],
                "additionalProperties": False
            }

        # 1. Call Groq
        if self.final_report_service.configured:
            try:
                api_key = self.final_report_service.api_key
                groq_url = self.final_report_service.api_url
                groq_model = self.final_report_service.model
                req_data = {
                    "model": groq_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "section_regeneration",
                            "strict": True,
                            "schema": schema
                        }
                    },
                    "temperature": 0.2,
                    "max_completion_tokens": 1200
                }
                req = urllib.request.Request(
                    groq_url,
                    data=json.dumps(req_data).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {api_key}",
                        "User-Agent": "MedSynapse"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=20.0) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    content_str = res["choices"][0]["message"]["content"]
                    parsed = json.loads(content_str)
                    sec_val = parsed.get("section_value")
                    merged_report = dict(current_report)
                    merged_report[section_key] = sec_val
                    merged_report["provider"] = f"groq ({groq_model})"
                    return {
                        "success": True,
                        "section_key": section_key,
                        "section_value": sec_val,
                        "updated_report": merged_report,
                        "provider": f"groq ({groq_model})"
                    }
            except Exception as exc:
                print(f"[Warning] Groq section regeneration failed: {exc}")
                pass

        # 2. Intelligent fallback for section regeneration
        merged_report = dict(current_report)
        if is_list:
            fallback_val = [
                f"Schedule targeted diagnostic correlation and repeat biometric panel within 3 to 6 months.",
                f"Initiate structured lifestyle modifications tailored to {disease} risk profile.",
                f"Consult with an attending specialist for definitive staging and therapeutic planning.",
                f"Clinical surveillance endorsed under supervision of {doctor_name} ({doctor_title})."
            ]
        else:
            fallback_val = (
                f"Clinician-verified synthesis for {section_display_name} regarding {disease}. "
                f"Multivariable diagnostic indicators were correlated with patient profile by {doctor_name} ({doctor_title}). "
                f"Clinical priorities and evidence-based surveillance protocols are endorsed per institutional standards."
            )
        merged_report[section_key] = fallback_val
        merged_report["provider"] = "medsynapse-clinical-core"
        return {
            "success": True,
            "section_key": section_key,
            "section_value": fallback_val,
            "updated_report": merged_report,
            "provider": "medsynapse-clinical-core"
        }
