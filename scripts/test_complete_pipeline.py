#!/usr/bin/env python3
"""Exercise the real MedSynapse backend; generate fixtures, JSON evidence and report.md.

Run: venv/bin/python scripts/test_complete_pipeline.py
Test dependencies: httpx, reportlab, plus requirements.txt.
No model, OCR, Gemma, database or explanation responses are mocked. Synthetic
fixtures test plumbing, not diagnostic accuracy. Exit 1 means failures/blockers.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import time
import traceback

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TF_NUM_INTRAOP_THREADS", "2")
os.environ.setdefault("TF_NUM_INTEROP_THREADS", "2")

DIABETES = dict(pregnancies=2, glucose=168, blood_pressure=90,
                skin_thickness=28, insulin=42.5, bmi=33.4, dpf=0.65, age=42)
LOW_DIABETES = dict(pregnancies=0, glucose=84, blood_pressure=74,
                    skin_thickness=18, insulin=8.4, bmi=21.4, dpf=0.22, age=29)
HEART = dict(age=58, sex=1, cp=0, trestbps=152, chol=275, fbs=1,
             restecg=1, thalach=122, exang=1, oldpeak=2.6, slope=1, ca=2, thal=3)
INTENDED = {
    "diabetes": "PDF/image -> OCR -> seven validated Gemma fields -> BMI_Cat -> SQLite -> clinician review -> matching eight-feature scaler/ensemble -> SHAP -> clinical report -> optional narrative. Legacy review/form path uses DPF and nine features.",
    "heart": "PDF/image -> OCR -> validated 13-feature extraction -> SQLite evidence -> clinician review -> 13 ordered inputs -> scaler -> heart classifier -> SHAP -> clinical report -> optional narrative.",
    "breast": "FNA/pathology PDF/image -> OCR -> 30 labelled WDBC features (deterministic extraction, Gemma fallback) -> SQLite -> clinician review -> scaler -> PCA -> classifier -> SHAP -> clinical report.",
    "pneumonia": "Chest X-ray image (not report text) -> RGB 224x224 float32 pixels /255 -> CNN -> image/evidence storage -> Grad-CAM -> clinical report; stored image can be replayed.",
    "eye": "Ocular image (not report text) -> RGB 224x224 float32 pixels /255 -> trained ocular CNN with verified labels -> Grad-CAM -> clinical report.",
}


class Audit:
    def __init__(self, directory):
        self.directory = directory
        self.checks = []
        self.responses = {}
        self.reports = {}
        self.inventory = {}

    def record(self, disease, stage, status, detail, evidence=None):
        item = dict(disease=disease, stage=stage, status=status, detail=detail,
                    evidence=evidence)
        self.checks.append(item)
        print(f"[{status}] {disease}: {stage}: {detail}", flush=True)
        return item

    def check(self, disease, stage, condition, detail, evidence=None):
        return self.record(disease, stage, "PASS" if condition else "FAIL", detail, evidence)

    def attempt(self, disease, stage, action):
        try:
            return action()
        except Exception as exc:
            self.record(disease, stage, "BLOCKED", f"{type(exc).__name__}: {exc}")
            return None

    def request(self, client, disease, stage, path, **kwargs):
        start = time.monotonic()
        response = client.post(path, **kwargs)
        try:
            body = response.json()
        except ValueError:
            body = {"non_json_response": response.text[:2000]}
        self.responses[f"{disease}/{stage}"] = dict(
            path=path, http_status=response.status_code,
            elapsed_seconds=round(time.monotonic() - start, 3), body=body)
        return response.status_code, body

    def prediction(self, disease, stage, response):
        status, body = response
        if status != 200 or not body.get("success"):
            self.record(disease, stage, "BLOCKED", f"HTTP {status}: {body.get('detail', body)}")
            return None
        data = body.get("data", {})
        probability = data.get("risk_probability")
        self.check(disease, stage, isinstance(probability, (int, float)) and
                   math.isfinite(probability) and 0 <= probability <= 1,
                   f"HTTP 200; class={data.get('prediction', data.get('diagnosis'))}; probability={probability}", data)
        report = body.get("clinical_report")
        self.check(disease, stage + " structured report", isinstance(report, dict) and
                   report.get("model_output") == data and
                   report.get("screening", {}).get("probability") == probability and
                   report.get("safety", {}).get("requires_clinician_review") is True and
                   report.get("decision_trace", {}).get("input_validation") == "passed",
                   "Report, decision trace, probability and review flag agree with model output")
        if report:
            self.reports[f"{disease}-{stage}"] = report
            explanation = report.get("explainability", {})
            self.record(disease, stage + " explanation",
                        "PASS" if explanation.get("status") == "available" else "BLOCKED",
                        f"{explanation.get('method')}: {explanation.get('reason', explanation.get('status'))}", explanation)
        return body


def diabetes_text(values):
    return "\n".join([
        "METABOLIC LABORATORY REPORT", "Patient: Synthetic Test Patient",
        f"Age: {values['age']} years", "Sex: Female",
        f"Pregnancies: {values['pregnancies']}",
        f"Fasting Blood Glucose: {values['glucose']} mg/dL",
        f"Blood Pressure: 142/{values['blood_pressure']} mmHg",
        f"Skin Thickness: {values['skin_thickness']} mm",
        f"Fasting Insulin: {values['insulin']} uIU/mL",
        f"Body Mass Index: {values['bmi']} kg/m2",
        f"Diabetes Pedigree Function: {values['dpf']}",
    ])


def create_fixtures(directory):
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    import pymupdf
    from PIL import Image, ImageDraw
    from backend.services.breast_feature_contract import BREAST_FEATURE_ORDER
    # Explicit WDBC-labelled measurements; no claim that these encode a diagnosis.
    base = [14.2, 20.1, 92.5, 620, 0.095, 0.12, 0.08, 0.045, 0.18, 0.062]
    breast = {name: float(base[i % 10] * (1 if i < 10 else 0.05 if i < 20 else 1.2))
              for i, name in enumerate(BREAST_FEATURE_ORDER)}
    texts = {
        "diabetes": diabetes_text(DIABETES),
        "diabetes_low": diabetes_text(LOW_DIABETES),
        "heart": "\n".join([
            "CARDIOLOGY EVALUATION REPORT", "Patient: Synthetic Test Patient",
            "Age: 58 years", "Sex: Male", "Chest Pain: Typical Angina (Type 0)",
            "Resting Blood Pressure: 152/94 mmHg", "Total Cholesterol: 275 mg/dL",
            "Fasting Blood Glucose: 130 mg/dL", "FastingBloodSugar: 1",
            "Resting ECG: ST-T wave abnormality (1)", "Maximum Heart Rate: 122 bpm",
            "Exercise Induced Angina: Yes (1)", "ST Depression: 2.6 mm",
            "Slope: Flat (1)", "Major Vessels: 2", "Thalassemia: Reversible Defect (3)"]),
        "breast": "\n".join(["BREAST FNA MORPHOLOGY REPORT", "Patient: Synthetic Test Patient"] +
                                [f"{name}: {value:.8g}" for name, value in breast.items()]),
        "pneumonia": "CHEST IMAGING TEST REPORT\nPatient: Synthetic Test Patient\nModality: Chest X-ray\nAttached image: pneumonia_input.png\nSynthetic image; no clinical ground truth.",
        "eye": "OCULAR IMAGING TEST REPORT\nPatient: Synthetic Test Patient\nModality: Ocular image\nAttached image: eye_input.png\nSynthetic image; no clinical ground truth.",
    }
    fixtures = {}
    for name, text in texts.items():
        folder = directory / name
        folder.mkdir(parents=True)
        (folder / "report.txt").write_text(text + "\n")
        pdf = folder / "report.pdf"
        c = canvas.Canvas(str(pdf), pagesize=A4)
        c.setTitle(f"MedSynapse synthetic {name} pipeline fixture")
        c.setFont("Helvetica-Bold", 14)
        c.drawString(45, 798, "MedSynapse Pipeline Test")
        c.setFont("Helvetica", 9)
        c.drawString(45, 780, "SYNTHETIC TEST DATA - NOT A PATIENT RECORD")
        c.setFont("Courier", 10)
        for index, line in enumerate(text.splitlines()):
            c.drawString(45, 752 - index * 17, line)
        c.setFont("Helvetica", 8)
        c.drawString(45, 30, "Fixture for software verification. No diagnostic accuracy claim.")
        c.save()
        with pymupdf.open(pdf) as doc:
            embedded = doc[0].get_text()
            if not all(line in embedded for line in text.splitlines()):
                raise ValueError(f"PDF text clipped or changed: {name}")
            pix = doc[0].get_pixmap(dpi=150)
            png = folder / "report.png"
            pix.save(png)
            scan = pymupdf.open()
            page = scan.new_page(width=A4[0], height=A4[1])
            page.insert_image(page.rect, stream=png.read_bytes())
            scan.save(folder / "scanned_report.pdf")
            scan.close()
        fixtures[name] = dict(text=text, pdf=pdf, png=png, scan=folder / "scanned_report.pdf")
    chest = directory / "pneumonia" / "pneumonia_input.png"
    source = ROOT / "test_reports" / "05_sample_chest_xray.png"
    if source.exists():
        shutil.copyfile(source, chest)
    else:
        Image.new("RGB", (512, 512), (90, 90, 90)).save(chest)
    eye = directory / "eye" / "eye_input.png"
    image = Image.new("RGB", (512, 512), "black")
    draw = ImageDraw.Draw(image)
    draw.ellipse((25, 25, 485, 485), fill=(120, 55, 25))
    draw.ellipse((295, 195, 350, 250), fill=(220, 165, 80))
    image.save(eye)
    fixtures["pneumonia"]["image"] = chest
    fixtures["eye"]["image"] = eye
    return fixtures, breast


def values_match(actual, expected):
    return {key: {"expected": value, "actual": actual.get(key)}
            for key, value in expected.items()
            if not isinstance(actual.get(key), (float, int)) or
            not math.isclose(actual[key], value, abs_tol=1e-6)}


def exercise(audit, fixtures, breast):
    from fastapi.testclient import TestClient
    from backend import main
    from backend.database import load_model_features, save_feature_extraction, set_clinician_approval
    from backend.services.ocr_service import MedicalOCREngine

    # Keep generated explanation files inside this run, not production data/.
    main.clinical_report_service.explanations_dir = audit.directory / "explanations"
    audit.inventory["routes"] = [r.path for r in main.app.routes if hasattr(r, "methods") and r.path.startswith("/api/")]
    audit.inventory["gemma"] = dict(configured=main.gemma_service.configured,
                                    model=main.gemma_service.model_name,
                                    timeout_seconds=main.gemma_service.timeout_seconds)
    audit.inventory["tesseract"] = shutil.which("tesseract")
    for disease, getter in [("diabetes", main.model_service.get_diabetes_model),
                            ("heart", main.model_service.get_heart_model),
                            ("breast", main.model_service.get_breast_cancer_model)]:
        loaded = audit.attempt(disease, "load artifacts", getter)
        if loaded:
            info = [{"type": type(obj).__name__, "n_features_in": getattr(obj, "n_features_in_", None),
                     "classes": getattr(obj, "classes_", []).tolist() if hasattr(obj, "classes_") else None}
                    for obj in loaded]
            audit.inventory[disease] = info
            audit.record(disease, "load artifacts", "PASS", json.dumps(info))

    with TestClient(main.app, raise_server_exceptions=False) as client:
        audit.inventory["health"] = client.get("/api/health").json()
        for name, fixture in fixtures.items():
            disease = "diabetes" if name == "diabetes_low" else name
            for format_name, key in [("text PDF", "pdf"), ("PNG OCR", "png"), ("scanned PDF OCR", "scan")]:
                path = fixture[key]
                extracted = audit.attempt(disease, f"{name} {format_name}", lambda p=path: MedicalOCREngine.extract_text(p.read_bytes(), p.name))
                if extracted is None:
                    continue
                audit.responses[f"{name}/{format_name}"] = {"raw_text": extracted}
                error_text = "Extraction Error:" in extracted or "OCR Error:" in extracted
                if error_text:
                    audit.record(disease, f"{name} {format_name}", "BLOCKED", extracted[:500])
                else:
                    audit.check(disease, f"{name} {format_name}", "Synthetic Test Patient" in extracted and len(extracted) > 30,
                                f"Extracted {len(extracted)} characters; synthetic patient marker checked")
                if not error_text and disease in {"diabetes", "heart"}:
                    ready = MedicalOCREngine.parse_report_parameters(extracted, disease)["ready_inputs"][disease]
                    expected = LOW_DIABETES if name == "diabetes_low" else DIABETES if disease == "diabetes" else HEART
                    diff = values_match(ready, expected)
                    audit.check(disease, f"{name} {format_name} feature fidelity", not diff,
                                "Every predictor equals the fixture" if not diff else f"Mismatched values: {diff}", diff)

        extracted_bodies = {}
        for disease in ("diabetes", "heart", "breast"):
            path = fixtures[disease]["pdf"]
            response = audit.request(client, disease, "PDF upload extraction", "/api/ocr/parse-report",
                                     data={"disease_type": disease}, files={"file": (path.name, path.read_bytes(), "application/pdf")})
            status, body = response
            audit.check(disease, "PDF upload extraction", status == 200 and body.get("success") is True,
                        f"HTTP {status}; extracted_count={body.get('extracted_count')}")
            extracted_bodies[disease] = body
            verify_suitability(audit, disease, body)
            key = {"diabetes": "gemma_diabetes", "heart": "gemma_heart", "breast": "gemma_breast_cancer"}[disease]
            extraction = body.get(key, {})
            state = extraction.get("status")
            audit.record(disease, "validated extraction", "PASS" if state == "ready_for_inference" else "BLOCKED",
                         f"{state}; missing={extraction.get('missing_or_unverified')}; {extraction.get('message', '')}", extraction)
            if state == "ready_for_inference":
                expected = breast if disease == "breast" else HEART if disease == "heart" else dict(
                    Pregnancies=2, Glucose=168, BloodPressure=90, SkinThickness=28, Insulin=42.5, BMI=33.4, Age=42, BMI_Cat=3)
                diff = values_match(extraction.get("model_features", {}), expected)
                audit.check(disease, "validated feature fidelity", not diff, "All validated values equal fixture" if not diff else str(diff), diff)
            id_key = {"diabetes": "feature_extraction_id", "heart": "heart_feature_extraction_id", "breast": "breast_feature_extraction_id"}[disease]
            extraction_id = body.get(id_key)
            with sqlite3.connect(os.environ["MEDSYNAPSE_DATABASE_PATH"]) as db:
                row = db.execute("SELECT disease_type, extraction_status, clinician_approval_status, report_sha256 FROM feature_extractions WHERE id=?", (extraction_id,)).fetchone()
            audit.check(disease, "extraction persisted", bool(row) and row[0] == disease,
                        f"Stored row disease/status/approval/digest: {row}")
            if state == "ready_for_inference":
                try:
                    load_model_features(extraction_id, disease)
                    pending_blocked = False
                except ValueError as exc:
                    pending_blocked = "requires clinician approval" in str(exc)
                audit.check(disease, "pending approval blocks store read", pending_blocked,
                            "Pending evidence is rejected before model feature loading")
                approval = client.post(f"/api/feature-extractions/{extraction_id}/review", json={
                    "status": "approved", "reviewed_by": "Synthetic Pipeline Auditor",
                    "note": "Automated synthetic pipeline test",
                })
                audit.check(disease, "clinician approval transition", approval.status_code == 200 and
                            approval.json().get("data", {}).get("clinician_approval_status") == "approved",
                            f"HTTP {approval.status_code}; explicit approval recorded")
                saved = audit.attempt(disease, "load approved stored features", lambda: load_model_features(extraction_id, disease))
                if saved is not None:
                    audit.check(disease, "storage round trip", saved == extraction["model_features"], "Approved stored features match extracted features")
            if disease in {"diabetes", "breast"} and extraction_id:
                endpoint = "diabetes" if disease == "diabetes" else "breast-cancer"
                audit.prediction(disease, "uploaded report store prediction", audit.request(client, disease, "uploaded report store prediction",
                    f"/api/predict/{endpoint}/from-feature-store/{extraction_id}"))
            elif disease == "heart":
                audit.record(disease, "store prediction route", "BLOCKED", "No heart/from-feature-store endpoint is registered; frontend transfers legacy ready_inputs to the direct heart endpoint")

        for name, expected in [("diabetes", DIABETES), ("diabetes_low", LOW_DIABETES), ("heart", HEART)]:
            disease = "diabetes" if name.startswith("diabetes") else "heart"
            audit.prediction(disease, f"{name} explicit form prediction", audit.request(client, disease, f"{name} explicit form prediction",
                             f"/api/predict/{disease}", json=expected))
            ready = (extracted_bodies[disease].get("ready_inputs", {}).get(disease) if name != "diabetes_low"
                     else MedicalOCREngine.parse_report_parameters(fixtures[name]["text"], disease)["ready_inputs"][disease])
            if ready:
                diff = values_match(ready, expected)
                audit.check(disease, f"{name} transferred feature fidelity", not diff, "Form transfer equals report" if not diff else str(diff))
                audit.prediction(disease, f"{name} OCR transfer prediction", audit.request(client, disease, f"{name} OCR transfer prediction",
                                 f"/api/predict/{disease}", json=ready))
        audit.prediction("breast", "explicit 30-feature prediction", audit.request(client, "breast", "explicit 30-feature prediction",
                         "/api/predict/breast-cancer", json={"features": breast}))

        # A valid report-backed eight-field fixture isolates the diabetes artifact
        # contract even if real Gemma extraction is blocked; it is not an E2E pass.
        seeded = dict(Pregnancies=2, Glucose=168, BloodPressure=90, SkinThickness=28, Insulin=42.5, BMI=33.4, Age=42, BMI_Cat=3)
        seeded_id = save_feature_extraction(disease_type="diabetes", source_filename="isolated-contract-fixture",
                    report_text=fixtures["diabetes"]["text"], features={}, model_features=seeded, extraction_status="ready_for_inference")
        set_clinician_approval(seeded_id, status="approved", reviewed_by="Synthetic Pipeline Auditor",
                               note="Isolated artifact contract test")
        status, body = audit.request(client, "diabetes", "isolated eight-feature artifact contract", f"/api/predict/diabetes/from-feature-store/{seeded_id}")
        audit.check("diabetes", "legacy mismatch refused safely", status == 409 and "requires 9 features" in str(body),
                    f"HTTP {status}: {body.get('detail', body)}")

        for disease, endpoint in [("pneumonia", "xray"), ("eye", "eye")]:
            path = fixtures[disease]["image"]
            tensor = audit.attempt(disease, "image preprocessing", lambda: main.model_service.transform_image(path.read_bytes()))
            if tensor:
                import numpy as np
                arr, metadata = tensor
                audit.check(disease, "image preprocessing", arr.shape == (1, 224, 224, 3) and arr.dtype == np.float32 and
                            np.isfinite(arr).all() and float(arr.min()) >= 0 and float(arr.max()) <= 1,
                            f"shape={arr.shape}; dtype={arr.dtype}; range={float(arr.min()):.4f}..{float(arr.max()):.4f}", metadata)
            body = audit.prediction(disease, "image prediction", audit.request(client, disease, "image prediction", f"/api/predict/{endpoint}",
                                   files={"file": (path.name, path.read_bytes(), "image/png")}))
            if body and disease == "pneumonia":
                extraction_id = body["feature_extraction_id"]
                with sqlite3.connect(os.environ["MEDSYNAPSE_DATABASE_PATH"]) as db:
                    row = db.execute("SELECT image_sha256, image_bytes, clinician_approval_status FROM image_feature_extractions WHERE id=?", (extraction_id,)).fetchone()
                audit.check(disease, "image evidence persisted", bool(row) and row[1] == path.read_bytes() and
                            row[0] == hashlib.sha256(path.read_bytes()).hexdigest(),
                            f"Original image bytes and SHA256 checked; approval={row[2] if row else None}")
                replay = audit.prediction(disease, "stored image replay", audit.request(client, disease, "stored image replay",
                                         f"/api/predict/xray/from-feature-store/{extraction_id}"))
                if replay:
                    audit.check(disease, "replay prediction matches", replay["data"] == body["data"], "Original and stored-image outputs match exactly")
                    audit.check(disease, "pending approval blocks replay", bool(row) and row[2] != "pending",
                                f"Stored image replay returned HTTP 200; approval={row[2] if row else None}")

        # Negative checks assert intended API/evidence contracts, not just status 200.
        for stage, kwargs, expected_status in [
            ("missing upload rejected", {}, 400),
            ("empty upload rejected", {"files": {"file": ("empty.pdf", b"", "application/pdf")}}, 400),
            ("invalid report image rejected", {"files": {"file": ("bad.png", b"not-an-image", "image/png")}, "data": {"disease_type": "breast"}}, 400),
        ]:
            status, body = audit.request(client, "shared", stage, "/api/ocr/parse-report", **kwargs)
            audit.check("shared", stage, status == expected_status, f"Expected HTTP {expected_status}; actual HTTP {status}; {str(body)[:300]}")
        status, body = audit.request(client, "shared", "unrelated text routing", "/api/ocr/parse-report",
                                    data={"raw_text": "Administrative note: please schedule an appointment.", "disease_type": "breast"})
        audit.check("shared", "unrelated text blocks extraction", status == 200 and body.get("gemma_breast_cancer", {}).get("model_features") is None,
                    f"HTTP {status}; unrelated text has no complete WDBC model features")
        for disease in ("diabetes", "heart"):
            status, body = audit.request(client, disease, "empty form rejected", f"/api/predict/{disease}", json={})
            audit.check(disease, "empty form rejected", status == 422, f"Expected HTTP 422 for missing measurements; actual HTTP {status}")
        status, body = audit.request(client, "breast", "incomplete WDBC rejected", "/api/predict/breast-cancer", json={"features": {"radius_mean": 14.2}})
        audit.check("breast", "incomplete WDBC rejected", status == 422, f"Expected/actual HTTP 422/{status}")
        for disease, endpoint in [("pneumonia", "xray"), ("eye", "eye")]:
            status, body = audit.request(client, disease, "empty image rejected", f"/api/predict/{endpoint}", files={"file": ("empty.png", b"", "image/png")})
            audit.check(disease, "empty image rejected", status == 400, f"Expected/actual HTTP 400/{status}")
        for disease, endpoint in [("diabetes", "diabetes"), ("breast", "breast-cancer"), ("pneumonia", "xray")]:
            status, body = audit.request(client, disease, "missing store record", f"/api/predict/{endpoint}/from-feature-store/missing-audit-record")
            audit.check(disease, "missing store record", status == 404, f"Expected/actual HTTP 404/{status}")
        for key, report in audit.reports.items():
            disease = key.split("-", 1)[0]
            status, body = audit.request(client, disease, key + " narrative", "/api/reports/generate-narrative", json={"report": report})
            audit.record(disease, key + " narrative", "PASS" if status == 200 and body.get("data", {}).get("narrative") else "BLOCKED",
                         f"HTTP {status}: {body.get('detail', 'Narrative generated')}")


def retry_gemma(audit, timeout_seconds):
    """Supplement default-timeout results without changing application settings.

    Called only when --retry-gemma-timeout is supplied. The original default
    results remain authoritative; retries are separate diagnostic evidence.
    """
    from backend.services.gemma_service import GemmaService
    from backend.database import save_feature_extraction, load_model_features
    from backend import main
    from fastapi.testclient import TestClient
    service = GemmaService(timeout_seconds=timeout_seconds)
    if not service.configured:
        return
    audit.inventory["gemma_retry_timeout_seconds"] = timeout_seconds
    for disease in ("diabetes", "heart"):
        original = audit.responses.get(f"{disease}/PDF upload extraction", {}).get("body", {})
        key = "gemma_diabetes" if disease == "diabetes" else "gemma_heart"
        if original.get(key, {}).get("status") != "unavailable":
            continue
        report_text = (audit.directory / "fixtures" / disease / "report.txt").read_text()
        start = time.monotonic()
        result = audit.attempt(disease, "extended timeout extraction diagnostic",
                  lambda: getattr(service, f"extract_{disease}_features")(report_text))
        if result is None:
            continue
        audit.responses[f"{disease}/extended timeout extraction diagnostic"] = dict(
            elapsed_seconds=round(time.monotonic() - start, 3), timeout_seconds=timeout_seconds, body=result)
        audit.record(disease, "extended timeout extraction diagnostic",
                     "PASS" if result.get("status") == "ready_for_inference" else "BLOCKED",
                     f"Timeout override {timeout_seconds}s; elapsed {time.monotonic() - start:.1f}s; status={result.get('status')}; missing={result.get('missing_or_unverified')}", result)
        if result.get("model_features") is not None:
            expected = HEART if disease == "heart" else dict(Pregnancies=2, Glucose=168, BloodPressure=90,
                      SkinThickness=28, Insulin=42.5, BMI=33.4, Age=42, BMI_Cat=3)
            diff = values_match(result["model_features"], expected)
            audit.check(disease, "extended timeout feature fidelity", not diff,
                        "All retry extraction values equal fixture" if not diff else str(diff), diff)
            extraction_id = save_feature_extraction(disease_type=disease, source_filename="extended-timeout-diagnostic",
                       report_text=report_text, features=result["features"], model_features=result["model_features"],
                       extraction_status=result["status"])
            set_clinician_approval(extraction_id, status="approved", reviewed_by="Synthetic Pipeline Auditor",
                                   note="Extended-timeout synthetic pipeline test")
            saved = load_model_features(extraction_id, disease)
            audit.check(disease, "extended timeout store round trip", saved == result["model_features"], "Retry features persisted and loaded exactly")
            if disease == "diabetes":
                with TestClient(main.app, raise_server_exceptions=False) as client:
                    audit.prediction(disease, "extended timeout store prediction", audit.request(client, disease,
                        "extended timeout store prediction", f"/api/predict/diabetes/from-feature-store/{extraction_id}"))


def verify_extraction_provenance(audit):
    """These generated reports each have one page; evidence must point to it."""
    for disease, key in [("diabetes", "gemma_diabetes"), ("heart", "gemma_heart"), ("breast", "gemma_breast_cancer")]:
        body = audit.responses.get(f"{disease}/PDF upload extraction", {}).get("body", {})
        extraction = body.get(key, {})
        if extraction.get("status") != "ready_for_inference":
            continue
        invalid = {name: {"page": item.get("page"), "source_text": item.get("source_text")}
                   for name, item in extraction.get("features", {}).items()
                   if item.get("status") == "extracted" and
                   (item.get("page") != 1 or not item.get("source_text") or
                    item["source_text"] not in body.get("raw_text", ""))}
        audit.check(disease, "extraction evidence provenance", not invalid,
                    "Every source quote is present and points to the single source page" if not invalid else
                    f"Invalid evidence in {len(invalid)} fields (first 3): {dict(list(invalid.items())[:3])}", invalid)


def verify_suitability(audit, disease, body):
    required = {"diabetes": 8, "heart": 13, "breast": 30}[disease]
    label = {"diabetes": "Diabetes Mellitus", "heart": "Coronary Heart Disease", "breast": "Breast Cancer"}[disease]
    score = next((item for item in body.get("jev_scoring", []) if item.get("disease") == label), {})
    value = score.get("suitability_score")
    missing = score.get("missing_features", [])
    expected_status = "needs_more_evidence" if missing else "ready_for_routing"
    valid = (isinstance(value, (int, float)) and 0 <= value <= 1 and
             score.get("required_feature_count") == required and
             score.get("available_feature_count", -1) + len(missing) == required and
             score.get("status") == expected_status)
    audit.check(disease, "JEV evidence routing", valid,
                f"status={score.get('status')}; suitability={value}; available={score.get('available_feature_count')}/{required}; missing={missing}", score)


def write_results(audit, report_path, started):
    counts = Counter(item["status"] for item in audit.checks)
    evidence = dict(started_at=started, finished_at=datetime.now(timezone.utc).isoformat(),
                    inventory=audit.inventory, totals=dict(counts), checks=audit.checks, responses=audit.responses)
    (audit.directory / "results.json").write_text(json.dumps(evidence, indent=2, default=str) + "\n")
    reports_dir = audit.directory / "clinical_reports"
    reports_dir.mkdir(exist_ok=True)
    for name, report in audit.reports.items():
        (reports_dir / f"{name}.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    relative = os.path.relpath(audit.directory, report_path.parent)
    def cell(value):
        return str(value).replace("|", "\\|").replace("\n", " ")
    lines = ["# MedSynapse complete pipeline verification", "", f"Run started: `{started}` (UTC).",
             f"Checkout: `{audit.inventory.get('branch', 'unknown')}` at `{audit.inventory.get('commit', 'unknown')}`.", "",
             f"**{counts['PASS']} checks passed, {counts['FAIL']} failed, {counts['BLOCKED']} blocked.**",
             "Failures assert an intended behavior that the current implementation violates. Blockers identify dependencies, artifacts, extraction, or inference failures. Passing an error-handling check does not make the disease pipeline operational.", "",
             "## Scope and reproduction", "",
             "```bash", "venv/bin/python scripts/test_complete_pipeline.py", "```", "",
             "The runner creates six synthetic clinical source reports (diabetes high/low, heart, breast, pneumonia, eye), each as TXT, text PDF, PNG and scanned PDF, plus image-model fixtures. It calls the real FastAPI app in process with its startup lifecycle, real model artifacts, local Gemma, OCR, SQLite and explanation adapters. No production model or patient database is altered. The test database and generated explanations live inside the run directory.", "",
             "`httpx` and `reportlab` are test dependencies in addition to `requirements.txt`. Exit code 1 is intentional when any required check fails or is blocked. Each execution gets a new output directory; this Markdown file describes the latest execution.", "",
             f"Evidence: [{relative}/results.json]({relative}/results.json). Fixtures: `{relative}/fixtures/`. Successful screening reports: `{relative}/clinical_reports/`. Isolated SQLite database: `{relative}/test.sqlite3`.", "",
             "These fixtures establish software behavior only. There are no labelled patient cohorts, so these results do not establish sensitivity, specificity, calibration or diagnostic accuracy. Image-model inputs are synthetic. The test covers backend API/service behavior and the documented frontend value-transfer contract; browser interaction, print/export layout and clinician workflow usability are not exercised.", "",
             "## Intended pipeline", "", "```mermaid", "flowchart TD",
             " A[Synthetic report or imaging fixture] --> B{Input type}",
             " B -->|PDF or report image| C[PyMuPDF or Tesseract OCR]",
             " C --> D[Extraction, provenance and feature validation]",
             " D --> L[JEV evidence suitability scoring]",
             " L --> E[Evidence store and clinician review]",
             " E --> F[Matching scaler and disease classifier]",
             " B -->|X-ray or ocular pixels| G[Decode, RGB, resize, normalize]",
             " G --> H[CNN inference and image evidence]",
             " F --> I[SHAP and structured screening report]",
             " H --> J[Grad-CAM and structured screening report]",
             " I --> K[Optional configured narrative]", " J --> K", "```", "",
             "## Per-module results", "", "| Module | Inference | Verification state |",
             "|---|---|---|"]
    if audit.inventory.get("gemma_retry_timeout_seconds"):
        lines[lines.index("## Intended pipeline"):lines.index("## Intended pipeline")] = [
            "A supplemental local Gemma diagnostic used a longer timeout without changing the application's settings. Reproduce both default checks and retries with:", "",
            "```bash", f"venv/bin/python scripts/test_complete_pipeline.py --retry-gemma-timeout {audit.inventory['gemma_retry_timeout_seconds']:g}", "```", ""]
    for disease, intention in INTENDED.items():
        checks = [item for item in audit.checks if item["disease"] == disease]
        summary = Counter(item["status"] for item in checks)
        predictions = [item for item in checks if isinstance(item["evidence"], dict) and "risk_probability" in item["evidence"]]
        observed = "Inference returned a real prediction; full pipeline partial" if predictions else "Model inference blocked"
        lines.append(f"| {disease} | {observed} | {dict(summary)} |")
    lines += ["", "Module counts include companion-report ingestion checks as well as model stages. Tesseract failures for an imaging module's companion report do not prevent its direct image classifier from running. Required inference, feature fidelity, evidence, and explanation stages must all succeed before a complete pipeline is claimed."]
    lines += ["", "### Actual model outputs", "", "| Module | Input path | Predicted class | Positive-class probability | Risk tier |", "|---|---|---|---|---|"]
    for item in audit.checks:
        data = item.get("evidence")
        if isinstance(data, dict) and "risk_probability" in data:
            lines.append(f"| {item['disease']} | {item['stage']} | {data.get('prediction', data.get('diagnosis'))} | {data['risk_probability']} | {data.get('risk_tier')} |")
    for disease, intention in INTENDED.items():
        lines += ["", f"### {disease.title()}: intended versus current", "", f"**Intended:** {intention}", ""]
        problems = list(dict.fromkeys(item["detail"] for item in audit.checks if item["disease"] == disease and item["status"] != "PASS"))
        lines += [f"- {problem}" for problem in problems]
    lines += ["", "## Source-level causes and next fixes", "",
              "These links identify the implemented boundaries inspected during this audit. The outcome matrix below supplies the runtime evidence.", "",
              "| Boundary | Current implementation | Required follow-through |", "|---|---|---|",
              "| Report OCR | [ocr_service.py](backend/services/ocr_service.py) invokes system Tesseract for PNG/scanned PDF | Install/configure the Tesseract executable; its Python wrapper alone is insufficient. |",
              "| OCR-to-form transfer | [ocr_service.py](backend/services/ocr_service.py) builds `ready_inputs` with defaults, while [OCRScannerView.jsx](frontend/src/components/OCRScannerView.jsx) transfers them to forms | Preserve explicit report values, expose missing values, and require review before inference; compare heart fields against the fixture. |",
              "| Extraction provenance | [breast_feature_contract.py](backend/services/breast_feature_contract.py) sets `page=line_number` for labelled text | Retain actual document page metadata. All generated text reports here have one page. |",
              "| Manual input validation | [main.py](backend/main.py) gives defaults to every diabetes/heart field | Reject missing measurements or require explicit review; an empty JSON request currently represents invented form inputs. |",
              "| Diabetes feature width | [model_service.py](backend/services/model_service.py) loads `diabetes_model.pkl`/`diabetes_scaler.pkl`; store route expects eight features | Train/export and load compatible DPF-free artifacts; keep the nine-field legacy endpoint contract aligned. |",
              "| Gemma | [gemma_service.py](backend/services/gemma_service.py) uses the configured request timeout | Examine the recorded request duration/error. Any extended-timeout diagnostic is separate from the default runtime result. |",
              "| Eye / breast artifacts | [model_service.py](backend/services/model_service.py) lazy-loads ocular CNN or breast classifier/scaler/PCA | Supply trained artifacts with the exact required feature order and class mapping; rerun real inference. |",
              "| Explainability | [explainability_service.py](backend/services/explainability_service.py) requires SHAP/reference cohorts or compatible CNN graph tensors | Supply the optional package/reference data and repair Grad-CAM tensor handling when its recorded error demands it. |",
              "| Review enforcement | [database.py](backend/database.py) loaders check extraction readiness but do not read clinician approval | Add an approval transition and enforce it at the intended inference boundary if review must gate prediction. |",
              "| OCR request errors | [main.py](backend/main.py) wraps all parse errors, including HTTPException, in HTTP 500 | Preserve intended 400 statuses; reject failed decode/OCR rather than treating an error string as report text. |",
              "| Narrative | [clinical_report_service.py](backend/services/clinical_report_service.py) requires `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` | Configure a provider to verify optional narrative generation; no credentials are included in these outputs. |"]
    lines += ["", "## Exact stage outcomes", "", "| Module | Stage | Status | Observed result |", "|---|---|---|---|"]
    for item in audit.checks:
        lines.append(f"| {cell(item['disease'])} | {cell(item['stage'])} | {item['status']} | {cell(item['detail'])} |")
    lines += ["", "## Runtime and artifacts", "", "```json", json.dumps(audit.inventory, indent=2, default=str), "```", "",
              "## Interpretation and remaining integration boundaries", "",
              "- Diabetes has two different contracts: direct/form inference uses nine fields including DPF; Gemma/database extraction produces eight without DPF. A 409 refusal of incompatible artifacts is correct protection, while the report-to-database prediction remains incomplete.",
              "- Heart evidence is persisted, but there is no registered heart prediction endpoint consuming an extraction ID. The current frontend uses `ready_inputs`; value-fidelity checks expose any parser defaults replacing report values.",
              "- Breast text extraction can complete without Gemma when all 30 WDBC labels are explicit. Prediction additionally requires the classifier, scaler and PCA artifacts. A missing artifact is not an extraction failure.",
              "- Pneumonia and eye models consume images, not the narrative in their companion reports. Image preprocessing checks do not establish that the trained model or class mapping is correct.",
              "- `requires_clinician_review` in a report is a flag, not proof of approval enforcement. Pending-record tests check the actual database/API behavior. There is no clinician approval mutation endpoint in this audit's route inventory.",
              "- Health currently reports artifact existence; successful model deserialization and prediction are verified separately above.",
              "- Optional explanations and narratives have their own results. A successful model prediction with an unavailable explanation is a partial pipeline, even if HTTP 200 is returned.",
              "- MRI/brain tumor is excluded because the current backend registers no MRI prediction route. Eye and breast are included because their routes are integrated, even though their trained artifacts may be absent.", ""]
    report_path.write_text("\n".join(lines))
    print(f"\nResults: {dict(counts)}\nReport: {report_path}\nEvidence: {audit.directory / 'results.json'}", flush=True)
    return 1 if counts["FAIL"] or counts["BLOCKED"] else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=ROOT / "report.md")
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--retry-gemma-timeout", type=float, help="Supplement failed default Gemma calls with an explicit longer-timeout diagnostic")
    args = parser.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    directory = (args.output_dir or ROOT / "output" / "pipeline_runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")).resolve()
    # Never reuse a run database, and never accept an existing directory.
    directory.mkdir(parents=True, exist_ok=False)
    os.environ["MEDSYNAPSE_DATABASE_PATH"] = str(directory / "test.sqlite3")
    audit = Audit(directory)
    for label, command in [("branch", ["git", "branch", "--show-current"]), ("commit", ["git", "rev-parse", "HEAD"])]:
        audit.inventory[label] = subprocess.check_output(command, cwd=ROOT, text=True).strip()
    audit.inventory["python"] = sys.version
    audit.inventory["versions"] = {}
    for name in ("fastapi", "tensorflow", "scikit-learn", "numpy", "pymupdf", "pytesseract", "shap", "httpx", "reportlab"):
        try:
            audit.inventory["versions"][name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            audit.inventory["versions"][name] = "not installed"
    audit.inventory["artifacts"] = {str(path.relative_to(ROOT)): dict(bytes=path.stat().st_size,
                  sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for path in (ROOT / "models").glob("*") if path.is_file()}
    try:
        fixtures, breast = create_fixtures(directory / "fixtures")
        audit.record("shared", "create synthetic fixtures", "PASS", "Six reports; TXT/text PDF/PNG/scanned PDF; two image fixtures; all PDF text round-trips")
        exercise(audit, fixtures, breast)
        verify_extraction_provenance(audit)
        if args.retry_gemma_timeout:
            retry_gemma(audit, args.retry_gemma_timeout)
    except Exception as exc:
        audit.record("shared", "runner execution", "BLOCKED", f"{type(exc).__name__}: {exc}")
        (directory / "runner_error.txt").write_text(traceback.format_exc())
        traceback.print_exc()
    return write_results(audit, args.report.resolve(), started)


if __name__ == "__main__":
    raise SystemExit(main())
