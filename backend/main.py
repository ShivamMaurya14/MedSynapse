import os
import sys
import io
import traceback
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from typing import Optional, Dict, Any, Literal

# Ensure project root in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
load_dotenv(Path(BASE_DIR) / ".env")

try:
    from backend.database import (
        build_approved_report_package,
        initialize_database,
        load_feature_extraction_for_review,
        load_image_feature_extraction,
        load_model_run,
        load_model_features,
        review_model_run,
        save_final_report,
        save_feature_extraction,
        save_image_feature_extraction,
        save_model_run,
        set_clinician_approval,
    )
    from backend.services.ocr_service import MedicalOCREngine
    from backend.services.model_service import ModelService
    from backend.services.gemma_service import GemmaService, GemmaServiceError
    from backend.services.jev_scoring import score_disease_suitability
    from backend.services.feature_resolution import resolve_features
    from backend.services.heart_feature_contract import HEART_API_NAMES
    from backend.services.clinical_report_service import ClinicalReportService
except ImportError:
    from database import (
        build_approved_report_package,
        initialize_database,
        load_feature_extraction_for_review,
        load_image_feature_extraction,
        load_model_run,
        load_model_features,
        review_model_run,
        save_final_report,
        save_feature_extraction,
        save_image_feature_extraction,
        save_model_run,
        set_clinician_approval,
    )
    from services.ocr_service import MedicalOCREngine
    from services.model_service import ModelService
    from services.gemma_service import GemmaService, GemmaServiceError
    from services.jev_scoring import score_disease_suitability
    from services.feature_resolution import resolve_features
    from services.heart_feature_contract import HEART_API_NAMES
    from services.clinical_report_service import ClinicalReportService

app = FastAPI(
    title="MedSynapse Clinical Diagnostic API",
    description="AI-driven multi-disease diagnostics with automated OCR medical report parameter extraction.",
    version="2.0.0"
)


@app.on_event("startup")
def initialize_feature_database() -> None:
    """Ensure the local feature-evidence store exists before serving requests."""
    initialize_database()

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_service = ModelService.get_instance()
gemma_service = GemmaService()
clinical_report_service = ClinicalReportService(model_service, BASE_DIR)

# Pydantic Schemas
class DiabetesInput(BaseModel):
    pregnancies: Optional[float] = 1
    glucose: float = 120
    blood_pressure: float = 70
    skin_thickness: Optional[float] = 20
    insulin: Optional[float] = 80
    bmi: float = 25.0
    dpf: Optional[float] = 0.5
    age: float = 35

class HeartInput(BaseModel):
    age: float = 52
    sex: int = 1
    cp: int = 0
    trestbps: float = 125
    chol: float = 210
    fbs: Optional[int] = 0
    restecg: Optional[int] = 0
    thalach: float = 150
    exang: Optional[int] = 0
    oldpeak: Optional[float] = 0.8
    slope: Optional[int] = 1
    ca: Optional[int] = 0
    thal: Optional[int] = 2


class BreastCancerInput(BaseModel):
    features: Dict[str, float]


class ReportNarrativeInput(BaseModel):
    report: Dict[str, Any]


class ClinicianReviewInput(BaseModel):
    status: Literal["approved", "rejected"]
    reviewed_by: str = Field(min_length=1, max_length=120)
    note: Optional[str] = Field(default=None, max_length=1000)


class ModelRunReviewInput(BaseModel):
    decision: Literal["approved", "rejected"]
    reviewed_by: str = Field(min_length=1, max_length=120)
    comment: Optional[str] = Field(default=None, max_length=2000)


def create_model_run_response(
    *,
    disease_key: str,
    result: Dict[str, Any],
    inputs: Dict[str, Any],
    feature_source: str = "direct_submission",
    feature_extraction_id: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Apply the common explanation, review, and final-report workflow."""
    report = clinical_report_service.build_report(
        disease_key=disease_key,
        prediction=result,
        inputs=inputs,
        feature_source=feature_source,
        feature_extraction_id=feature_extraction_id,
        image_bytes=image_bytes,
    )
    run = save_model_run(
        disease_type=disease_key,
        prediction=result,
        clinical_report=report,
        feature_extraction_id=feature_extraction_id,
    )
    response = {
        "success": True,
        "data": result,
        "clinical_report": run["clinical_report"],
        "model_run_id": run["model_run_id"],
        "workflow_status": run["workflow_status"],
    }
    if extra:
        response.update(extra)
    return response


@app.get("/api/health")
def health_check():
    models_status = {
        "diabetes_model": os.path.exists(os.path.join(BASE_DIR, "models", "diabetes_model.pkl")),
        "heart_model": os.path.exists(os.path.join(BASE_DIR, "models", "heart_model.pkl")),
        "xray_pneumonia_model": os.path.exists(os.path.join(BASE_DIR, "models", "xrays_pneumonia.keras")),
        "eye_disease_model": os.path.exists(os.path.join(BASE_DIR, "models", "eye_disease.keras")),
        "breast_cancer_model": os.path.exists(os.path.join(BASE_DIR, "models", "breast_cancer_model.pkl")),
    }
    return {
        "status": "online",
        "system": "MedSynapse AI v2.0",
        "ocr_engine": "Tesseract OCR + PyMuPDF Active",
        "models": models_status,
        "final_report_provider": clinical_report_service.final_report_service.public_configuration(),
    }


@app.get("/api/sample-reports")
def get_sample_reports():
    """Provides sample clinical lab reports for instant 1-click OCR demonstration."""
    return [
        {
            "id": "sample-diabetic",
            "title": "Comprehensive Diabetic Metabolic Panel",
            "patient": "Eleanor Vance (Female, Age 42)",
            "disease_target": "diabetes",
            "sample_text": """METROPOLITAN CLINICAL LABORATORIES
Patient Name: Eleanor Vance
Age: 42 yrs    Gender: Female    Pregnancies: 2
Date of Collection: 14-Aug-2026

METABOLIC & GLYCEMIC PROFILE:
- Fasting Blood Sugar (FBS / Glucose): 154 mg/dL  [Reference: 70 - 99 mg/dL] - HIGH
- Serum Fasting Insulin: 38.2 μU/mL  [Reference: 2.6 - 24.9 μU/mL] - ELEVATED
- HbA1c (Glycated Hemoglobin): 7.6 %  [Reference: 4.0 - 5.6 %]
- Blood Pressure (Resting BP): 136/88 mm Hg  [Reference: < 120/80 mm Hg]
- Body Mass Index (BMI): 31.4 kg/m2  (Weight: 84 kg, Height: 164 cm)
- Triceps Skinfold Thickness: 28 mm
- Diabetes Pedigree Score: 0.65
""",
            "expected_outcome": "High Risk of Diabetes (FBS: 154 mg/dL, BMI: 31.4)"
        },
        {
            "id": "sample-cardiac",
            "title": "Cardiovascular Stress & Lipid Evaluation",
            "patient": "Arthur Pendelton (Male, Age 58)",
            "disease_target": "heart",
            "sample_text": """ST. JUDE CARDIOLOGY INSTITUTE
Patient: Arthur Pendelton    Age: 58    Sex: Male
Clinical Indications: Chest tightness on exertion, shortness of breath

LABORATORY & CARDIAC FINDINGS:
- Resting Blood Pressure (trestbps): 148/92 mm Hg
- Serum Total Cholesterol: 265 mg/dL  [Reference: < 200 mg/dL] - HIGH
- Fasting Blood Glucose: 130 mg/dL
- Maximum Heart Rate Achieved (thalach): 128 bpm
- Chest Pain Presentation: Typical Angina (Type 0)
- Exercise Induced Angina: Positive (Yes)
- Resting Electrocardiogram (ECG): ST-T wave abnormality
- ST Depression induced by exercise (oldpeak): 2.4 mm
- Slope of peak ST segment: Flat (1)
- Major vessels colored by fluoroscopy (ca): 2
- Thalassemia: Reversable Defect (3)
""",
            "expected_outcome": "High Risk of Coronary Heart Disease (Chol: 265, ST Dep: 2.4)"
        },
        {
            "id": "sample-healthy",
            "title": "Routine Executive Wellness Screening",
            "patient": "Sophia Chen (Female, Age 29)",
            "disease_target": "diabetes",
            "sample_text": """GLOBAL HEALTHCARE DIAGNOSTICS
Patient Name: Sophia Chen    Age: 29    Sex: Female    Pregnancies: 0
Annual Wellness Examination

TEST RESULTS:
- Fasting Blood Glucose: 86 mg/dL  [Normal: 70 - 99 mg/dL]
- Blood Pressure: 115/75 mm Hg  [Optimal: < 120/80 mm Hg]
- Total Cholesterol: 168 mg/dL  [Desirable: < 200 mg/dL]
- Serum Fasting Insulin: 8.4 μU/mL  [Normal: 2.6 - 24.9 μU/mL]
- Body Mass Index (BMI): 21.8 kg/m2  [Normal: 18.5 - 24.9 kg/m2]
- Max Heart Rate (Pulse): 165 bpm
- ECG: Normal Sinus Rhythm
- Skin Thickness: 18 mm
- Diabetes Pedigree Function: 0.22
""",
            "expected_outcome": "Low Risk / Optimal Healthy Baseline"
        }
    ]


@app.post("/api/ocr/parse-report")
async def parse_medical_report(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    disease_type: str = Form("all")
):
    """Parses an uploaded lab report (PDF/image) or raw report text and extracts clinical parameters."""
    try:
        extracted_text = ""
        filename = ""
        
        if file is not None:
            filename = file.filename
            contents = await file.read()
            if len(contents) == 0:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            extracted_text = MedicalOCREngine.extract_text(contents, filename)
        elif raw_text:
            extracted_text = raw_text
        else:
            raise HTTPException(status_code=400, detail="Please upload a file or provide report text.")

        if not extracted_text.strip():
            return {
                "success": False,
                "message": "No text could be extracted from the document.",
                "raw_text": "",
                "parameters": {},
                "extracted_count": 0
            }

        parsed_data = MedicalOCREngine.parse_report_parameters(extracted_text, disease_type)
        resolved_parameters, feature_resolution_log = resolve_features(parsed_data["parameters"])
        response = {
            "success": True,
            "filename": filename,
            "raw_text": parsed_data["raw_text"],
            "line_count": parsed_data["line_count"],
            "extracted_count": parsed_data["extracted_count"],
            "parameters": resolved_parameters,
            "feature_resolution_log": feature_resolution_log,
            "ready_inputs": parsed_data["ready_inputs"]
        }
        response["jev_scoring"] = score_disease_suitability(
            resolved_parameters, disease_type=disease_type
        )
        # Existing OCR and regex extraction remain the first stage. Gemma only
        # consumes the OCR text afterwards and returns separately auditable
        # diabetes evidence; it does not overwrite the OCR response.
        if disease_type.lower() in {"all", "diabetes"}:
            try:
                response["gemma_diabetes"] = gemma_service.extract_diabetes_features(extracted_text)
            except GemmaServiceError as exc:
                response["gemma_diabetes"] = {
                    "status": "unavailable",
                    "message": str(exc),
                    "features": {},
                    "missing_or_unverified": [],
                    "model_features": None,
                }
            gemma_result = response["gemma_diabetes"]
            response["feature_extraction_id"] = save_feature_extraction(
                disease_type="diabetes",
                source_filename=filename,
                report_text=extracted_text,
                features={
                    "ocr_parameters": resolved_parameters,
                    "gemma_features": gemma_result["features"],
                },
                model_features=gemma_result["model_features"],
                extraction_status=gemma_result["status"],
            )
        if disease_type.lower() in {"all", "heart"}:
            try:
                heart_result = gemma_service.extract_heart_features(extracted_text)
            except GemmaServiceError as exc:
                heart_result = {
                    "status": "unavailable",
                    "message": str(exc),
                    "features": {},
                    "missing_or_unverified": [],
                    "model_features": None,
                }
            response["gemma_heart"] = heart_result
            heart_parameters = {
                HEART_API_NAMES[name]: feature
                for name, feature in heart_result.get("features", {}).items()
                if name in HEART_API_NAMES
            }
            if heart_parameters:
                heart_score = score_disease_suitability(heart_parameters, disease_type="heart")
                response["jev_scoring"] = [
                    score for score in response["jev_scoring"]
                    if score["disease"] != "Coronary Heart Disease"
                ] + heart_score
            response["heart_feature_extraction_id"] = save_feature_extraction(
                disease_type="heart",
                source_filename=filename,
                report_text=extracted_text,
                features={
                    "ocr_parameters": resolved_parameters,
                    "gemma_features": heart_result["features"],
                },
                model_features=heart_result["model_features"],
                extraction_status=heart_result["status"],
            )
        if disease_type.lower() == "breast":
            try:
                breast_result = gemma_service.extract_breast_cancer_features(extracted_text)
            except GemmaServiceError as exc:
                breast_result = {"status": "unavailable", "message": str(exc), "features": {}, "missing_or_unverified": [], "model_features": None}
            response["gemma_breast_cancer"] = breast_result
            response["breast_features"] = breast_result["features"]
            response["breast_extracted_count"] = sum(
                1 for feature in breast_result["features"].values()
                if feature.get("status") == "extracted" and feature.get("value") is not None
            )
            response["extracted_count"] = max(response["extracted_count"], response["breast_extracted_count"])
            response["jev_scoring"] = score_disease_suitability(
                parsed_data["parameters"], disease_type="breast",
                breast_features=breast_result.get("features", {}),
            )
            response["breast_feature_extraction_id"] = save_feature_extraction(
                disease_type="breast", source_filename=filename, report_text=extracted_text,
                features=breast_result["features"], model_features=breast_result["model_features"],
                extraction_status=breast_result["status"],
            )
        return response
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@app.post("/api/predict/diabetes")
def predict_diabetes_risk(payload: DiabetesInput):
    try:
        inputs = payload.model_dump()
        result = model_service.predict_diabetes(inputs)
        return create_model_run_response(
            disease_key="diabetes", result=result, inputs=inputs
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Diabetes prediction failed: {str(e)}")


@app.post("/api/predict/diabetes/from-feature-store/{feature_extraction_id}")
def predict_diabetes_from_feature_store(feature_extraction_id: str):
    """Predict from validated diabetes features persisted after OCR/Gemma extraction."""
    try:
        model_features = load_model_features(feature_extraction_id, "diabetes")
        result = model_service.predict_diabetes_from_feature_store(model_features)
        return create_model_run_response(
            disease_key="diabetes",
            result=result,
            inputs=model_features,
            feature_source="local_database", feature_extraction_id=feature_extraction_id,
            extra={
                "feature_extraction_id": feature_extraction_id,
                "feature_source": "local_database",
            },
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Diabetes prediction failed: {str(exc)}") from exc


@app.get("/api/feature-extractions/{feature_extraction_id}/review")
def get_feature_extraction_review(feature_extraction_id: str):
    """Return structured evidence for clinician review; raw report text is not stored."""
    try:
        return {
            "success": True,
            "data": load_feature_extraction_for_review(feature_extraction_id),
        }
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/feature-extractions/{feature_extraction_id}/review")
def review_feature_extraction(feature_extraction_id: str, payload: ClinicianReviewInput):
    """Approve or reject structured evidence before database-backed inference."""
    try:
        return {
            "success": True,
            "data": set_clinician_approval(
                feature_extraction_id,
                status=payload.status,
                reviewed_by=payload.reviewed_by,
                note=payload.note,
            ),
        }
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/predict/heart")
def predict_heart_risk(payload: HeartInput):
    try:
        inputs = payload.model_dump()
        result = model_service.predict_heart(inputs)
        return create_model_run_response(
            disease_key="heart", result=result, inputs=inputs
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Heart disease prediction failed: {str(e)}")


@app.post("/api/predict/xray")
async def predict_xray(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Uploaded X-Ray image is empty.")
        result = model_service.predict_xray(contents)
        feature_extraction_id = save_image_feature_extraction(
            disease_type="pneumonia",
            source_filename=file.filename or "",
            image_bytes=contents,
            preprocessing=result["image_features"],
        )
        return create_model_run_response(
            disease_key="pneumonia",
            result=result,
            inputs={"source_filename": file.filename or ""},
            feature_source="uploaded_image_persisted_local_database",
            feature_extraction_id=feature_extraction_id,
            image_bytes=contents,
            extra={
                "feature_extraction_id": feature_extraction_id,
                "feature_source": "uploaded_image_persisted_local_database",
            },
        )
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"X-Ray analysis failed: {str(e)}")


@app.post("/api/predict/xray/from-feature-store/{feature_extraction_id}")
def predict_xray_from_feature_store(feature_extraction_id: str):
    """Run pneumonia inference from the validated locally persisted X-ray."""
    try:
        image_bytes, stored_preprocessing = load_image_feature_extraction(
            feature_extraction_id, "pneumonia"
        )
        result = model_service.predict_xray(image_bytes)
        return create_model_run_response(
            disease_key="pneumonia",
            result=result,
            inputs={"source": "local image feature store"},
            feature_source="local_database",
            feature_extraction_id=feature_extraction_id,
            image_bytes=image_bytes,
            extra={
                "feature_extraction_id": feature_extraction_id,
                "feature_source": "local_database",
                "stored_preprocessing": stored_preprocessing,
            },
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"X-Ray analysis failed: {str(exc)}") from exc


async def _predict_uploaded_image(file: UploadFile, predictor, error_label: str):
    try:
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")
        return {"success": True, "data": predictor(contents)}
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{error_label} failed: {str(e)}")


@app.post("/api/predict/eye")
async def predict_eye(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")
        result = model_service.predict_eye(contents)
        return create_model_run_response(
            disease_key="eye",
            result=result,
            inputs={"source_filename": file.filename or ""},
            image_bytes=contents,
        )
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Eye disease analysis failed: {str(exc)}") from exc


@app.post("/api/predict/breast-cancer")
def predict_breast_cancer(payload: BreastCancerInput):
    try:
        result = model_service.predict_breast_cancer(payload.features)
        return create_model_run_response(
            disease_key="breast", result=result, inputs=payload.features
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/predict/breast-cancer/from-feature-store/{feature_extraction_id}")
def predict_breast_cancer_from_feature_store(feature_extraction_id: str):
    try:
        features = load_model_features(feature_extraction_id, "breast")
        result = model_service.predict_breast_cancer(features)
        return create_model_run_response(
            disease_key="breast",
            result=result,
            inputs=features,
            feature_source="local_database",
            feature_extraction_id=feature_extraction_id,
            extra={
                "feature_source": "local_database",
                "feature_extraction_id": feature_extraction_id,
            },
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/reports/generate-narrative")
def generate_report_narrative(payload: ReportNarrativeInput):
    """Legacy route that now enforces model-run clinician approval."""
    try:
        model_run_id = payload.report.get("model_run_id")
        if not model_run_id:
            raise ValueError("An approved model_run_id is required for final report generation.")
        approved_package = build_approved_report_package(model_run_id)
        generated = clinical_report_service.generate_final_report(approved_package)
        saved = save_final_report(model_run_id, approved_package, generated)
        return {"success": True, "data": saved["final_report"], "model_run": saved}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/model-runs/{model_run_id}")
def get_model_run(model_run_id: str):
    try:
        return {"success": True, "data": load_model_run(model_run_id)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/model-runs/{model_run_id}/review")
def review_completed_model_run(model_run_id: str, payload: ModelRunReviewInput):
    try:
        return {
            "success": True,
            "data": review_model_run(
                model_run_id,
                decision=payload.decision,
                reviewed_by=payload.reviewed_by,
                comment=payload.comment,
            ),
        }
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/model-runs/{model_run_id}/final-report")
def generate_final_model_run_report(model_run_id: str):
    """Make the only LLM call, strictly after clinician approval."""
    try:
        approved_package = build_approved_report_package(model_run_id)
        generated = clinical_report_service.generate_final_report(approved_package)
        saved = save_final_report(model_run_id, approved_package, generated)
        return {"success": True, "data": saved["final_report"], "model_run": saved}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# Serve built frontend static assets in production
dist_dir = os.path.join(BASE_DIR, "frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept /api routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(dist_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))
