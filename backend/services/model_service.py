import os
import io
import pickle
import numpy as np
from PIL import Image
import tensorflow as tf
from numpy.random import MT19937, RandomState
import numpy.random._pickle as np_pickle
from backend.services.breast_feature_contract import BREAST_FEATURE_ORDER

# Compatibility shims for Keras 3 layers
class FixedFlatten(tf.keras.layers.Flatten):
    def call(self, inputs, *args, **kwargs):
        if isinstance(inputs, (list, tuple)) and len(inputs) > 0:
            if not hasattr(inputs, 'shape'):
                inputs = inputs[0]
        while isinstance(inputs, (list, tuple)) and len(inputs) == 1:
            inputs = inputs[0]
        return super().call(inputs, *args, **kwargs)

    @classmethod
    def from_config(cls, config):
        return cls(**config)

class FixedPooling(tf.keras.layers.GlobalAveragePooling2D):
    def call(self, inputs, *args, **kwargs):
        if isinstance(inputs, (list, tuple)) and len(inputs) > 0:
            if not hasattr(inputs, 'shape'):
                inputs = inputs[0]
        while isinstance(inputs, (list, tuple)) and len(inputs) == 1:
            inputs = inputs[0]
        return super().call(inputs, *args, **kwargs)

    @classmethod
    def from_config(cls, config):
        return cls(**config)

# Unpickler compatibility for legacy scikit-learn models
class CompatMT19937(MT19937):
    def __setstate__(self, state):
        try:
            super().__setstate__(state)
        except Exception:
            pass

def compat_ctor(*args, **kwargs):
    return CompatMT19937()

def compat_randomstate_ctor(*args, **kwargs):
    return RandomState()

class CustomUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if 'MT19937' in name or module.startswith('numpy.random'):
            if 'MT19937' in name:
                return CompatMT19937
            if name == '__bit_generator_ctor':
                return compat_ctor
            if name == '__randomstate_ctor':
                return compat_randomstate_ctor
        return super().find_class(module, name)

np_pickle.__bit_generator_ctor = compat_ctor
np_pickle.__randomstate_ctor = compat_randomstate_ctor

DATABASE_DIABETES_FEATURE_ORDER = (
    'Pregnancies',
    'Glucose',
    'BloodPressure',
    'SkinThickness',
    'Insulin',
    'BMI',
    'Age',
    'BMI_Cat',
)

LEGACY_DATABASE_DIABETES_FEATURE_ORDER = (
    'Pregnancies',
    'Glucose',
    'BloodPressure',
    'SkinThickness',
    'Insulin',
    'BMI',
    'DiabetesPedigreeFunction',
    'Age',
    'BMI_Cat',
)


class ModelService:
    _instance = None

    def __init__(self):
        # Resolve project root from backend/services/
        self.base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        self.models_dir = os.path.join(self.base_dir, 'models')
        self._diabetes_model = None
        self._diabetes_scaler = None
        self._heart_model = None
        self._heart_scaler = None
        self._xray_model = None
        # These slots are intentionally lazy-loaded. Add the trained artifacts
        # later without changing the API or frontend integration:
        # models/eye_disease.keras and models/breast_cancer.keras.
        self._eye_model = None
        self._breast_model = None
        self._breast_scaler = None
        self._breast_pca = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ModelService()
        return cls._instance

    # 1. Diabetes Model
    def get_diabetes_model(self):
        if self._diabetes_model is None:
            model_path = os.path.join(self.models_dir, 'diabetes_model.pkl')
            scaler_path = os.path.join(self.models_dir, 'diabetes_scaler.pkl')
            with open(model_path, 'rb') as f:
                self._diabetes_model = CustomUnpickler(f).load()
            with open(scaler_path, 'rb') as f:
                self._diabetes_scaler = pickle.load(f)
        return self._diabetes_model, self._diabetes_scaler

    def predict_diabetes(self, data: dict) -> dict:
        model, scaler = self.get_diabetes_model()
        pregnancies = float(data.get('pregnancies', 0))
        glucose = float(data.get('glucose', 100))
        blood_pressure = float(data.get('blood_pressure', 70))
        skin_thickness = float(data.get('skin_thickness', 20))
        insulin = float(data.get('insulin', 80))
        bmi = float(data.get('bmi', 25.0))
        dpf = float(data.get('dpf', 0.5))
        age = float(data.get('age', 30))

        # Categorize BMI
        if bmi < 18.5:
            bmi_cat = 0
        elif 18.5 <= bmi < 25:
            bmi_cat = 1
        elif 25 <= bmi < 30:
            bmi_cat = 2
        else:
            bmi_cat = 3

        input_arr = np.array([[pregnancies, glucose, blood_pressure, skin_thickness, insulin, bmi, dpf, age, bmi_cat]])
        scaled_input = scaler.transform(input_arr)
        
        prediction = int(model.predict(scaled_input)[0])
        probabilities = model.predict_proba(scaled_input)[0]
        risk_probability = float(probabilities[1])

        # Clinical factor analysis
        factors = []
        if glucose >= 126:
            factors.append({'factor': 'Fasting Glucose', 'value': f"{glucose} mg/dL", 'impact': 'High (Diabetic threshold exceeded)'})
        elif glucose >= 100:
            factors.append({'factor': 'Fasting Glucose', 'value': f"{glucose} mg/dL", 'impact': 'Moderate (Impaired fasting glucose)'})
        
        if bmi >= 30:
            factors.append({'factor': 'Body Mass Index', 'value': f"{bmi} kg/m²", 'impact': 'High (Obesity Class I+)'})
        elif bmi >= 25:
            factors.append({'factor': 'Body Mass Index', 'value': f"{bmi} kg/m²", 'impact': 'Moderate (Overweight)'})
            
        if insulin > 166:
            factors.append({'factor': 'Serum Insulin', 'value': f"{insulin} μU/mL", 'impact': 'High (Possible Insulin Resistance)'})

        if blood_pressure >= 85:
            factors.append({'factor': 'Diastolic BP', 'value': f"{blood_pressure} mm Hg", 'impact': 'Elevated vascular tension'})

        if not factors:
            factors.append({'factor': 'Metabolic Profile', 'value': 'Optimal', 'impact': 'Parameters within standard baseline'})

        recommendations = []
        if risk_probability >= 0.5:
            recommendations = [
                "Schedule a clinical consultation for oral glucose tolerance test (OGTT) and HbA1c screening.",
                "Adopt a low-glycemic dietary regimen rich in soluble fiber and lean protein.",
                "Engage in at least 150 minutes per week of moderate-intensity aerobic and resistance exercise.",
                "Monitor self-monitored blood glucose levels (fasting and 2-hr postprandial)."
            ]
        else:
            recommendations = [
                "Maintain a balanced, nutrient-dense diet and stay physically active.",
                "Undergo routine annual wellness and preventative metabolic screenings.",
                "Keep body mass index (BMI) within the healthy range (18.5 - 24.9 kg/m²)."
            ]

        return {
            'disease': 'Diabetes Mellitus',
            'prediction': prediction,
            'has_disease': bool(prediction == 1),
            'risk_probability': round(risk_probability, 4),
            'risk_percentage': round(risk_probability * 100, 1),
            'risk_tier': 'High Risk' if risk_probability >= 0.65 else ('Moderate Risk' if risk_probability >= 0.35 else 'Low Risk'),
            'contributing_factors': factors,
            'recommendations': recommendations
        }

    def predict_diabetes_from_feature_store(self, model_features: dict) -> dict:
        """Run diabetes inference using only the validated database feature set.

        The production contract is DPF-free. A legacy nine-feature artifact is
        accepted only for explicitly enabled synthetic pipeline testing, and
        only when the database record already contains an approximated DPF.
        """
        model, scaler = self.get_diabetes_model()
        expected_feature_count = getattr(scaler, 'n_features_in_', None)
        allow_synthetic_dpf = os.getenv(
            'MEDSYNAPSE_ALLOW_SYNTHETIC_DPF', ''
        ).strip().lower() in {'1', 'true', 'yes'}
        feature_order = DATABASE_DIABETES_FEATURE_ORDER
        using_synthetic_dpf = False

        if expected_feature_count == len(LEGACY_DATABASE_DIABETES_FEATURE_ORDER):
            if not allow_synthetic_dpf:
                raise ValueError(
                    "The installed diabetes artifact requires 9 features, including "
                    "DiabetesPedigreeFunction. It cannot use the DPF-free local feature "
                    "store unless MEDSYNAPSE_ALLOW_SYNTHETIC_DPF=1 is explicitly enabled "
                    "for synthetic pipeline testing."
                )
            feature_order = LEGACY_DATABASE_DIABETES_FEATURE_ORDER
            using_synthetic_dpf = True
        elif expected_feature_count != len(DATABASE_DIABETES_FEATURE_ORDER):
            raise ValueError(
                f"The installed diabetes scaler has an unsupported feature count: {expected_feature_count}."
            )

        missing = [name for name in feature_order if name not in model_features]
        if missing:
            raise ValueError(f"Stored diabetes features are missing: {', '.join(missing)}")
        try:
            input_arr = np.array([[
                float(model_features[name]) for name in feature_order
            ]])
        except (TypeError, ValueError) as exc:
            raise ValueError("Stored diabetes features must all be finite numeric values.") from exc
        if not np.isfinite(input_arr).all():
            raise ValueError("Stored diabetes features must all be finite numeric values.")

        scaled_input = scaler.transform(input_arr)
        prediction = int(model.predict(scaled_input)[0])
        probabilities = model.predict_proba(scaled_input)[0]
        risk_probability = float(probabilities[1])
        glucose = float(model_features['Glucose'])
        bmi = float(model_features['BMI'])
        insulin = float(model_features['Insulin'])
        blood_pressure = float(model_features['BloodPressure'])
        factors = []
        if glucose >= 126:
            factors.append({'factor': 'Fasting Glucose', 'value': f"{glucose} mg/dL", 'impact': 'High (Diabetic threshold exceeded)'})
        elif glucose >= 100:
            factors.append({'factor': 'Fasting Glucose', 'value': f"{glucose} mg/dL", 'impact': 'Moderate (Impaired fasting glucose)'})
        if bmi >= 30:
            factors.append({'factor': 'Body Mass Index', 'value': f"{bmi} kg/m²", 'impact': 'High (Obesity Class I+)'})
        elif bmi >= 25:
            factors.append({'factor': 'Body Mass Index', 'value': f"{bmi} kg/m²", 'impact': 'Moderate (Overweight)'})
        if insulin > 166:
            factors.append({'factor': 'Serum Insulin', 'value': f"{insulin} μU/mL", 'impact': 'High (Possible Insulin Resistance)'})
        if blood_pressure >= 85:
            factors.append({'factor': 'Diastolic BP', 'value': f"{blood_pressure} mm Hg", 'impact': 'Elevated vascular tension'})
        if not factors:
            factors.append({'factor': 'Metabolic Profile', 'value': 'Optimal', 'impact': 'Parameters within standard baseline'})

        recommendations = (
            [
                "Schedule a clinical consultation for oral glucose tolerance test (OGTT) and HbA1c screening.",
                "Adopt a low-glycemic dietary regimen rich in soluble fiber and lean protein.",
                "Engage in at least 150 minutes per week of moderate-intensity aerobic and resistance exercise.",
                "Monitor self-monitored blood glucose levels (fasting and 2-hr postprandial).",
            ]
            if risk_probability >= 0.5
            else [
                "Maintain a balanced, nutrient-dense diet and stay physically active.",
                "Undergo routine annual wellness and preventative metabolic screenings.",
                "Keep body mass index (BMI) within the healthy range (18.5 - 24.9 kg/m²).",
            ]
        )
        return {
            'disease': 'Diabetes Mellitus',
            'prediction': prediction,
            'has_disease': bool(prediction == 1),
            'risk_probability': round(risk_probability, 4),
            'risk_percentage': round(risk_probability * 100, 1),
            'risk_tier': 'High Risk' if risk_probability >= 0.65 else ('Moderate Risk' if risk_probability >= 0.35 else 'Low Risk'),
            'contributing_factors': factors,
            'recommendations': recommendations,
            'synthetic_dpf_test_mode': using_synthetic_dpf,
        }

    # 2. Heart Disease Model
    def get_heart_model(self):
        if self._heart_model is None:
            model_path = os.path.join(self.models_dir, 'heart_model.pkl')
            scaler_path = os.path.join(self.models_dir, 'heart_scaler.pkl')
            with open(model_path, 'rb') as f:
                self._heart_model = CustomUnpickler(f).load()
            with open(scaler_path, 'rb') as f:
                self._heart_scaler = pickle.load(f)
        return self._heart_model, self._heart_scaler

    def predict_heart(self, data: dict) -> dict:
        model, scaler = self.get_heart_model()
        age = float(data.get('age', 50))
        sex = float(data.get('sex', 1))
        cp = float(data.get('cp', 0))
        trestbps = float(data.get('trestbps', 120))
        chol = float(data.get('chol', 200))
        fbs = float(data.get('fbs', 0))
        restecg = float(data.get('restecg', 0))
        thalach = float(data.get('thalach', 150))
        exang = float(data.get('exang', 0))
        oldpeak = float(data.get('oldpeak', 0.0))
        slope = float(data.get('slope', 1))
        ca = float(data.get('ca', 0))
        thal = float(data.get('thal', 2))

        input_arr = np.array([[age, sex, cp, trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal]])
        scaled_input = scaler.transform(input_arr)

        prediction = int(model.predict(scaled_input)[0])
        probabilities = model.predict_proba(scaled_input)[0]
        risk_probability = float(probabilities[1])

        factors = []
        if chol >= 240:
            factors.append({'factor': 'Serum Cholesterol', 'value': f"{chol} mg/dL", 'impact': 'High (Atherosclerosis risk)'})
        elif chol >= 200:
            factors.append({'factor': 'Serum Cholesterol', 'value': f"{chol} mg/dL", 'impact': 'Borderline Elevated'})

        if trestbps >= 140:
            factors.append({'factor': 'Resting BP', 'value': f"{trestbps} mm Hg", 'impact': 'Stage 2 Hypertension'})
        elif trestbps >= 130:
            factors.append({'factor': 'Resting BP', 'value': f"{trestbps} mm Hg", 'impact': 'Stage 1 Hypertension'})

        if exang == 1:
            factors.append({'factor': 'Exercise Induced Angina', 'value': 'Present', 'impact': 'Myocardial ischemia indicator'})

        if oldpeak >= 2.0:
            factors.append({'factor': 'ST Depression (Oldpeak)', 'value': f"{oldpeak} mm", 'impact': 'Significant ST depression'})

        if not factors:
            factors.append({'factor': 'Cardiovascular Markers', 'value': 'Stable', 'impact': 'Parameters within normal bounds'})

        recommendations = []
        if risk_probability >= 0.5:
            recommendations = [
                "Urgent referral to a cardiologist for comprehensive 12-lead ECG, Echo, or Stress Test.",
                "Review lipid profile (LDL/HDL/Triglycerides) and consider statin therapy if indicated.",
                "Initiate cardiovascular dietary modifications (DASH diet, Mediterranean diet, reduced sodium).",
                "Strict blood pressure management and smoking cessation."
            ]
        else:
            recommendations = [
                "Continue heart-healthy lifestyle with regular physical exercise.",
                "Maintain optimal blood pressure (< 120/80 mm Hg) and cholesterol levels (< 200 mg/dL).",
                "Schedule annual preventative cardiac checkups."
            ]

        return {
            'disease': 'Coronary Heart Disease',
            'prediction': prediction,
            'has_disease': bool(prediction == 1),
            'risk_probability': round(risk_probability, 4),
            'risk_percentage': round(risk_probability * 100, 1),
            'risk_tier': 'High Risk' if risk_probability >= 0.65 else ('Moderate Risk' if risk_probability >= 0.35 else 'Low Risk'),
            'contributing_factors': factors,
            'recommendations': recommendations
        }

    @staticmethod
    def transform_image(image_bytes: bytes, target_size: tuple = (224, 224)) -> tuple[np.ndarray, dict]:
        """
        Transforms any arbitrary input image (various sizes, aspect ratios, color modes, orientations)
        into the exact tensor shape and format required by deep learning models.
        
        target_size: (width, height), e.g. (224, 224) for X-Ray
        """
        if not image_bytes or len(image_bytes) == 0:
            raise ValueError("Input image bytes are empty.")
            
        try:
            from PIL import ImageOps
            img = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            raise ValueError(f"Failed to decode image file: {str(e)}. Please upload a valid PNG, JPEG, WEBP, or TIFF.")

        orig_w, orig_h = img.size
        orig_mode = img.mode

        # 1. Handle EXIF rotation metadata if present
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # 2. Handle transparency / alpha channels cleanly
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            # Create a solid black background (standard in medical imaging) and composite
            img_rgba = img.convert('RGBA')
            bg = Image.new('RGB', img_rgba.size, (0, 0, 0))
            bg.paste(img_rgba, mask=img_rgba.split()[3])
            img = bg
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # 3. High-fidelity resampling to target tensor shape
        target_w, target_h = target_size
        img_transformed = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

        # 4. Convert to float32 NumPy array normalized to [0.0, 1.0]
        img_arr = np.array(img_transformed, dtype=np.float32) / 255.0

        # 5. Expand batch dimension -> shape: (1, target_h, target_w, 3)
        if img_arr.ndim == 3:
            img_tensor = np.expand_dims(img_arr, axis=0)
        else:
            img_tensor = img_arr

        # Enforce exact tensor shape validation
        expected_shape = (1, target_h, target_w, 3)
        if img_tensor.shape != expected_shape:
            raise ValueError(f"Image tensor shape mismatch: got {img_tensor.shape}, expected {expected_shape}")

        metadata = {
            'original_dimensions': f"{orig_w} × {orig_h} px",
            'original_mode': orig_mode,
            'transformed_shape': f"{target_w} × {target_h} × 3",
            'normalization': 'Float32 [0.0 - 1.0]'
        }

        return img_tensor, metadata

    # 3. Chest X-Ray Model
    def extract_pneumonia_image_features(self, image_bytes: bytes) -> tuple[np.ndarray, dict]:
        """Build the exact image feature tensor required by the pneumonia CNN.

        The deployed pneumonia model has no report-text feature interface. Its
        model features are the complete normalized 224×224×3 pixel tensor.
        Only non-identifying tensor summary statistics are returned in JSON;
        the tensor itself stays in memory for inference and the original image
        is retained in the local image feature store when requested.
        """
        image_tensor, preprocessing = self.transform_image(image_bytes, target_size=(224, 224))
        pixels = image_tensor[0]
        return image_tensor, {
            "feature_type": "normalized_chest_xray_pixel_tensor",
            "feature_count": int(pixels.size),
            "tensor_shape": list(image_tensor.shape),
            "preprocessing": preprocessing,
            "pixel_summary": {
                "mean": round(float(np.mean(pixels)), 6),
                "standard_deviation": round(float(np.std(pixels)), 6),
                "minimum": round(float(np.min(pixels)), 6),
                "maximum": round(float(np.max(pixels)), 6),
            },
            "note": "The CNN consumes all normalized pixels, not the summary statistics.",
        }

    def get_xray_model(self):
        if self._xray_model is None:
            model_path = os.path.join(self.models_dir, 'xrays_pneumonia.keras')
            custom_objects = {
                'Flatten': FixedFlatten,
                'GlobalAveragePooling2D': FixedPooling
            }
            try:
                self._xray_model = tf.keras.models.load_model(model_path, compile=False, custom_objects=custom_objects)
            except Exception:
                self._xray_model = tf.keras.models.load_model(model_path, compile=False, safe_mode=False, custom_objects=custom_objects)
        return self._xray_model

    def predict_xray(self, image_bytes: bytes) -> dict:
        model = self.get_xray_model()
        img_arr, image_features = self.extract_pneumonia_image_features(image_bytes)
        transform_meta = image_features["preprocessing"]

        preds = model.predict(img_arr, verbose=0)
        if len(preds[0]) > 1:
            prob = float(preds[0][1])
        else:
            prob = float(preds[0][0])

        is_pneumonia = prob > 0.5
        confidence = prob if is_pneumonia else (1.0 - prob)

        recommendations = []
        if is_pneumonia:
            recommendations = [
                "Immediate medical evaluation by a pulmonologist or primary care physician.",
                "Confirm clinical symptoms (fever, productive cough, shortness of breath, pleuritic chest pain).",
                "Evaluate for antibiotic or antiviral treatment depending on clinical etiology.",
                "Pulse oximetry monitoring for adequate oxygen saturation (> 94%)."
            ]
        else:
            recommendations = [
                "No radiological evidence of acute pneumonia infiltration detected.",
                "If respiratory symptoms persist, consult a doctor for differential evaluation (bronchitis, asthma, allergies).",
                "Maintain good respiratory hygiene and seasonal vaccinations."
            ]

        factors = [
            {
                'factor': 'Pneumonia probability',
                'value': f"{prob * 100:.1f}%",
                'impact': 'Positive radiographic classification' if is_pneumonia else 'Below positive classification threshold'
            }
        ]

        return {
            # Keep the same normalized prediction contract used by diabetes and
            # cardiac inference so the shared diagnostic report works uniformly.
            'disease': 'Pneumonia',
            'prediction': int(is_pneumonia),
            'has_disease': is_pneumonia,
            'risk_probability': round(prob, 4),
            'risk_percentage': round(prob * 100, 1),
            'risk_tier': 'High Risk' if prob >= 0.65 else ('Moderate Risk' if prob >= 0.35 else 'Low Risk'),
            'contributing_factors': factors,
            'modality': 'Chest Radiography (X-Ray)',
            'diagnosis': 'Pneumonia' if is_pneumonia else 'Normal (Clear Lungs)',
            'is_positive': is_pneumonia,
            'pneumonia_probability': round(prob, 4),
            'confidence_percentage': round(confidence * 100, 1),
            'severity': 'Elevated Radiological Density' if is_pneumonia else 'Normal Pulmonary Clarity',
            'image_transformation': transform_meta,
            'image_features': image_features,
            'recommendations': recommendations
        }

    def _load_image_model(self, attribute_name: str, filename: str):
        model = getattr(self, attribute_name)
        if model is not None:
            return model
        model_path = os.path.join(self.models_dir, filename)
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model artifact not found: models/{filename}. "
                f"Train/export the {filename.removesuffix('.keras')} model before inference."
            )
        custom_objects = {'Flatten': FixedFlatten, 'GlobalAveragePooling2D': FixedPooling}
        try:
            model = tf.keras.models.load_model(model_path, compile=False, custom_objects=custom_objects)
        except Exception:
            model = tf.keras.models.load_model(
                model_path, compile=False, safe_mode=False, custom_objects=custom_objects
            )
        setattr(self, attribute_name, model)
        return model

    def _predict_planned_image_model(self, image_bytes: bytes, *, model_attr: str,
                                     artifact: str, disease: str, positive_label: str,
                                     negative_label: str, target_size=(224, 224)) -> dict:
        model = self._load_image_model(model_attr, artifact)
        image_tensor, transform_meta = self.transform_image(image_bytes, target_size=target_size)
        raw = np.asarray(model.predict(image_tensor, verbose=0))
        scores = np.asarray(raw[0] if raw.ndim > 1 else raw, dtype=np.float32).reshape(-1)
        if scores.size == 0:
            raise ValueError(f"{disease} model returned an empty prediction.")

        if scores.size == 1:
            positive_probability = float(np.clip(scores[0], 0.0, 1.0))
            probabilities = {negative_label: round(1.0 - positive_probability, 4),
                             positive_label: round(positive_probability, 4)}
            diagnosis = positive_label if positive_probability >= 0.5 else negative_label
            confidence = positive_probability if diagnosis == positive_label else 1.0 - positive_probability
        else:
            # Supports future softmax classifiers without requiring a frontend change.
            if not np.isclose(float(scores.sum()), 1.0, atol=1e-3):
                scores = np.exp(scores - np.max(scores))
                scores = scores / scores.sum()
            labels = [negative_label, positive_label] if scores.size == 2 else [f"Class {i}" for i in range(scores.size)]
            probabilities = {label: round(float(score), 4) for label, score in zip(labels, scores)}
            top_index = int(np.argmax(scores))
            diagnosis = labels[top_index]
            confidence = float(scores[top_index])
            positive_probability = float(scores[1] if scores.size == 2 else confidence)

        return {
            'disease': disease,
            'diagnosis': diagnosis,
            'is_positive': diagnosis == positive_label,
            'risk_probability': round(positive_probability, 4),
            'risk_percentage': round(positive_probability * 100, 1),
            'confidence_percentage': round(confidence * 100, 1),
            'class_probabilities': probabilities,
            'image_transformation': transform_meta,
            'model_status': 'artifact_loaded',
            'recommendations': [
                'This integrated output is for research workflow testing only.',
                'Replace the placeholder class mapping with the labels used during training.',
                'Have a qualified clinician review any result before taking action.',
            ],
        }

    def predict_eye(self, image_bytes: bytes) -> dict:
        return self._predict_planned_image_model(
            image_bytes, model_attr='_eye_model', artifact='eye_disease.keras',
            disease='Eye Disease', positive_label='Eye Disease Detected',
            negative_label='No Eye Disease Detected'
        )

    def get_eye_model(self):
        """Expose the active ocular CNN for Grad-CAM report explanations."""
        return self._load_image_model('_eye_model', 'eye_disease.keras')

    def get_breast_cancer_model(self):
        if self._breast_model is None:
            artifacts = {
                'model': os.path.join(self.models_dir, 'breast_cancer_model.pkl'),
                'scaler': os.path.join(self.models_dir, 'breast_cancer_scaler.pkl'),
                'pca': os.path.join(self.models_dir, 'breast_cancer_pca.pkl'),
            }
            missing = [name for name, path in artifacts.items() if not os.path.exists(path)]
            if missing:
                raise FileNotFoundError(
                    'Breast-cancer tabular artifacts are unavailable: ' + ', '.join(missing) +
                    '. Train/export breast_cancer_model.pkl, breast_cancer_scaler.pkl, and breast_cancer_pca.pkl first.'
                )
            with open(artifacts['model'], 'rb') as handle:
                self._breast_model = CustomUnpickler(handle).load()
            with open(artifacts['scaler'], 'rb') as handle:
                self._breast_scaler = pickle.load(handle)
            with open(artifacts['pca'], 'rb') as handle:
                self._breast_pca = pickle.load(handle)
        return self._breast_model, self._breast_scaler, self._breast_pca

    def predict_breast_cancer(self, model_features: dict) -> dict:
        """Predict benign/malignant status from the exact 30 WDBC FNA features."""
        missing = [name for name in BREAST_FEATURE_ORDER if name not in model_features]
        if missing:
            raise ValueError(f"Missing breast-cancer features: {', '.join(missing)}")
        try:
            values = np.array([[float(model_features[name]) for name in BREAST_FEATURE_ORDER]])
        except (TypeError, ValueError) as exc:
            raise ValueError('Breast-cancer features must be finite numeric values.') from exc
        if not np.isfinite(values).all():
            raise ValueError('Breast-cancer features must be finite numeric values.')
        model, scaler, pca = self.get_breast_cancer_model()
        transformed = pca.transform(scaler.transform(values))
        prediction = int(model.predict(transformed)[0])
        probabilities = model.predict_proba(transformed)[0]
        malignant_probability = float(probabilities[1])
        return {
            'disease': 'Breast Cancer', 'prediction': prediction,
            'diagnosis': 'Malignant' if prediction == 1 else 'Benign',
            'is_positive': bool(prediction == 1),
            'risk_probability': round(malignant_probability, 4),
            'risk_percentage': round(malignant_probability * 100, 1),
            'risk_tier': 'High Risk' if malignant_probability >= 0.65 else ('Moderate Risk' if malignant_probability >= 0.35 else 'Low Risk'),
            'contributing_factors': [],
            'recommendations': ['This research screening output requires qualified clinician review.'],
            'model_status': 'artifact_loaded',
        }
