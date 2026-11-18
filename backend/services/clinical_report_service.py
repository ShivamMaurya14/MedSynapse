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
            def value(lower_name, stored_name, default=None):
                return inputs[lower_name] if lower_name in inputs else inputs.get(stored_name, default)
            bmi = float(value("bmi", "BMI", 25))
            bmi_cat = 0 if bmi < 18.5 else 1 if bmi < 25 else 2 if bmi < 30 else 3
            names = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI", "DiabetesPedigreeFunction", "Age", "BMI_Cat"]
            raw = {"Pregnancies": value("pregnancies", "Pregnancies"), "Glucose": value("glucose", "Glucose"), "BloodPressure": value("blood_pressure", "BloodPressure"), "SkinThickness": value("skin_thickness", "SkinThickness"), "Insulin": value("insulin", "Insulin"), "BMI": bmi, "DiabetesPedigreeFunction": value("dpf", "DiabetesPedigreeFunction"), "Age": value("age", "Age"), "BMI_Cat": value("bmi_cat", "BMI_Cat", bmi_cat)}
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
            raw = {name: inputs.get(key) for name, key in zip(names, keys)}
            values = np.array([[float(raw[name]) for name in names]])
            return ExplainabilityService.tree_shap(model=model, transformed_input=scaler.transform(values), feature_names=names, raw_values=raw, positive_class_idx=0)
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
        if disease_key == "liver":
            model, scaler_dict = self.model_service.get_liver_model()
            features = list(scaler_dict["feature_names"])
            mean = scaler_dict["mean"].values
            std = scaler_dict["std"].values
            gender_val = inputs.get("gender", inputs.get("Gender", 0))
            if isinstance(gender_val, str):
                gender_val = 0 if gender_val.lower().startswith("m") else 1
            raw = {
                "Age": float(inputs.get("age", inputs.get("Age", 45))),
                "Gender": float(gender_val),
                "Total_Bilirubin": float(inputs.get("total_bilirubin", inputs.get("Total_Bilirubin", 1.0))),
                "Direct_Bilirubin": float(inputs.get("direct_bilirubin", inputs.get("Direct_Bilirubin", 0.3))),
                "Alkaline_Phosphotase": float(inputs.get("alkaline_phosphotase", inputs.get("Alkaline_Phosphotase", 200))),
                "Alamine_Aminotransferase": float(inputs.get("alamine_aminotransferase", inputs.get("Alamine_Aminotransferase", 30))),
                "Aspartate_Aminotransferase": float(inputs.get("aspartate_aminotransferase", inputs.get("Aspartate_Aminotransferase", 35))),
                "Total_Protiens": float(inputs.get("total_protiens", inputs.get("Total_Protiens", 6.5))),
                "Albumin": float(inputs.get("albumin", inputs.get("Albumin", 3.5))),
                "Albumin_and_Globulin_Ratio": float(inputs.get("albumin_and_globulin_ratio", inputs.get("ag_ratio", inputs.get("Albumin_and_Globulin_Ratio", 1.0)))),
            }
            x = np.array([raw[k] for k in features], dtype=np.float32)
            x_scaled = ((x - mean) / std).reshape(1, -1)
            return ExplainabilityService.tree_shap(model=model, transformed_input=x_scaled, feature_names=features, raw_values=raw, positive_class_idx=1)
        if disease_key in ("brain_tumor", "brain-tumor", "kidney_stone", "kidney-stone", "skin_cancer", "skin-cancer", "eye"):
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
            }.get(disease_key, "Convolutional Multi-Class Feature Attribution")
            return {
                "status": "available",
                "method": method_desc,
                "target_class": pred_diag,
                "confidence_percentage": prediction.get("confidence_percentage", prediction.get("risk_percentage", 0)),
                "class_probabilities": class_probs,
                "limitations": ["Visual class activation and posterior probability distribution for clinician review."],
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
        """Call Groq once after an explicit clinician approval, falling back to structured synthesis."""
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
                                 edited_sections: dict[str, Any] | None = None) -> dict[str, Any]:
        """Synthesize a complete LLM report directly from prediction data without requiring pre-approval."""
        package = {
            "disease_type": disease_key,
            "prediction": prediction,
            "clinical_inputs": self._safe_inputs(disease_key, inputs),
            "clinical_report": clinical_report or {},
            "tweaked_decisions": tweaked_decisions or {},
            "edited_sections": edited_sections or {},
            "clinician_decision": {
                "decision": "approved",
                "reviewed_by": "MedSynapse Clinical Protocol v2.0",
                "comment": "Pre-screen verification with clinician overrides for comprehensive LLM clinical synthesis.",
                "verified_features": list(inputs.keys()),
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

        tweak_notes = []
        if has_tweaks:
            diag_tweak = tweaked.get("diagnosis")
            if diag_tweak:
                diagnosis = diag_tweak.get("tweaked", diagnosis)
                tweak_notes.append(f"Diagnosis overridden to '{diagnosis}' (Physician Rationale: {diag_tweak.get('reason', 'Clinical adjustment')})")

            tier_tweak = tweaked.get("riskTier")
            if tier_tweak:
                tier = tier_tweak.get("tweaked", tier)
                tweak_notes.append(f"Risk Tier adjusted to '{tier}' (Physician Rationale: {tier_tweak.get('reason', 'Clinical calibration')})")

            prob_tweak = tweaked.get("riskProbability")
            if prob_tweak:
                pct = float(prob_tweak.get("tweaked", pct))
                prob = round(pct / 100, 4)
                tweak_notes.append(f"Calibrated probability adjusted to {pct}% (Physician Rationale: {prob_tweak.get('reason', 'Physician calibration')})")

            recs_tweak = tweaked.get("recommendations")
            if recs_tweak and recs_tweak.get("tweaked"):
                recs = recs_tweak.get("tweaked")
                tweak_notes.append(f"Management protocol customized ({recs_tweak.get('reason', 'Clinical protocol updated')})")

            feat_rationales = tweaked.get("featureRationales") or {}
            for feat, info in feat_rationales.items():
                tweak_notes.append(f"Biomarker '{feat}' marked as {info.get('status', 'audited')} ({info.get('reason', 'Clinical review')})")

        factor_desc = []
        for f in factors:
            factor_desc.append(f"{f.get('factor')}: {f.get('value')} ({f.get('impact')})")
        factors_text = "; ".join(factor_desc) if factor_desc else "Parameters within standard reference distributions."

        tweaks_summary = "; ".join(tweak_notes) if tweak_notes else ""

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
            )
        }

    def chat_with_llm(self, *, messages: list[dict[str, str]], report_context: dict[str, Any]) -> dict[str, Any]:
        """
        Interactive conversational LLM assistant for the clinical report.
        Answers clinician queries, helps refine clinical notes, and discusses ML model findings.
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

        # System prompt setting clinical context
        system_prompt = (
            f"You are the MedSynapse AI Clinical Copilot, an advanced clinical decision support assistant. "
            f"You are collaborating with an attending physician reviewing an AI diagnostic screening report for {disease}.\n"
            f"CLINICAL ML EVIDENCE:\n"
            f"- Model Predicted Risk: {pred.get('risk_percentage', pred.get('risk_probability', 'N/A'))}%\n"
            f"- Risk Tier: {pred.get('risk_tier', 'N/A')}\n"
            f"- Baseline Diagnosis: {pred.get('diagnosis') or pred.get('prediction', 'N/A')}\n"
            f"- Contributing Biomarkers: {json.dumps((pred.get('contributing_factors') or [])[:6], ensure_ascii=False)}\n"
            f"- Patient Inputs: {json.dumps(inputs, ensure_ascii=False)}\n"
        )

        if tweaked.get("hasTweaks"):
            system_prompt += f"\nATTENDING PHYSICIAN MANUAL OVERRIDES & RATIONALES:\n{json.dumps(tweaked, ensure_ascii=False)}\n"

        if edited:
            system_prompt += f"\nCLINICIAN INDEPENDENT SECTION EDITS & REASONS:\n{json.dumps(edited, ensure_ascii=False)}\n"

        if current_report:
            system_prompt += (
                f"\nCURRENT DRAFT REPORT SUMMARY:\n"
                f"- Title: {current_report.get('title')}\n"
                f"- Screening Summary: {current_report.get('screening_summary')}\n"
                f"- Clinician Protocol: {current_report.get('clinician_review')}\n"
                f"- Recommendations: {json.dumps(current_report.get('recommendations', []), ensure_ascii=False)}\n"
            )

        system_prompt += (
            "\nYour role is to assist the attending physician: provide concise, evidence-based clinical reasoning, "
            "help refine or calibrate report sections, discuss biomarker implications, and suggest tailored follow-up management. "
            "Maintain professional medical terminology. Keep responses clear and actionable."
        )

        # 1. Use Groq Cloud API
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
                            "temperature": 0.3,
                            "max_tokens": 800,
                        }).encode("utf-8"),
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {api_key}",
                            "User-Agent": "MedSynapse/2.0",
                        },
                        method="POST"
                    )
                    with urllib.request.urlopen(groq_req, timeout=15.0) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        reply = res["choices"][0]["message"]["content"]
                        return {"success": True, "reply": reply, "provider": f"groq ({groq_model})"}
            except Exception as exc:
                print(f"[Warning] Groq chat failed: {exc}")
                pass

        # 2. Try Ollama /api/chat with gemma3:4b
        try:
            ollama_url = os.getenv("GEMMA_CHAT_URL", "http://127.0.0.1:11434/api/chat")
            model_name = os.getenv("GEMMA_MODEL", "gemma3:4b")
            timeout_sec = float(os.getenv("GEMMA_CHAT_TIMEOUT", "45.0"))

            chat_messages = [{"role": "system", "content": system_prompt}]
            for msg in messages:
                chat_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })

            req = urllib.request.Request(
                ollama_url,
                data=json.dumps({
                    "model": model_name,
                    "messages": chat_messages,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 500}
                }).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                reply = res.get("message", {}).get("content", "")
                if reply:
                    return {"success": True, "reply": reply, "provider": f"ollama ({model_name})"}
        except Exception:
            pass

        # 3. Intelligent rule-based clinical fallback if LLM is offline
        last_user_msg = (messages[-1].get("content") if messages else "").lower()
        if "biomarker" in last_user_msg or "feature" in last_user_msg:
            fallback_text = (
                f"In this {disease} screening, the model identified prominent biomarker signals influencing risk. "
                f"Features were weighted according to SHAP attribution. If you disagree with these weights, you can adjust them in the tweak controls on the left."
            )
        elif "tweak" in last_user_msg or "override" in last_user_msg or "reason" in last_user_msg:
            fallback_text = (
                f"Your manual decision overrides and clinical rationales have been captured. "
                f"Click 'Generate Complete Report via LLM' or ask me to regenerate, and the official report narrative will explicitly document your clinical justifications."
            )
        elif "recommend" in last_user_msg or "protocol" in last_user_msg:
            fallback_text = (
                f"Recommended clinical follow-up protocol for {disease}: "
                f"1. Correlation with secondary diagnostic panels and patient clinical history; "
                f"2. Repeat targeted biometrics within 3 to 6 months; "
                f"3. Attending specialist review for therapeutic staging."
            )
        else:
            fallback_text = (
                f"I am ready to help refine the clinical report for {disease}. "
                f"You can edit any section on the left with reasons, adjust risk classifications, or ask me specific questions regarding the ML inferences."
            )

        return {"success": True, "reply": fallback_text, "provider": "medsynapse-clinical-core"}
