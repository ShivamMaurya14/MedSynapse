#!/usr/bin/env python3
"""
MedSynapse Clinical Benchmark & Evaluation Dataset Generator.
Generates comprehensive clinical diagnostic reports (PDF, PNG, TXT, JSON)
for all 9 disease modules using exact, predefined sampled reports, images,
and biometric data points already in the codebase without modification.
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image
import pymupdf
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.services.model_service import ModelService
from backend.services.clinical_report_service import ClinicalReportService
from backend.services.breast_feature_contract import BREAST_FEATURE_ORDER

DATASET_DIR = ROOT / "dataset"

# ---------------------------------------------------------------------------
# Predefined Sample Fixtures & Data Points (Exact values from codebase)
# ---------------------------------------------------------------------------

BREAST_BASE_A = (
    14.20, 20.10, 92.50, 620.0, 0.0950, 0.1200, 0.0800, 0.0450, 0.1800, 0.0620,
    0.710, 1.005, 4.625, 31.00, 0.00475, 0.00600, 0.00400, 0.00225, 0.00900, 0.00310,
    17.04, 24.12, 111.0, 744.0, 0.1140, 0.1440, 0.0960, 0.0540, 0.2160, 0.0744,
)
BREAST_BASE_B = (
    11.42, 20.38, 77.58, 386.1, 0.1425, 0.2839, 0.2414, 0.1052, 0.2597, 0.09744,
    0.4956, 1.1560, 3.445, 27.23, 0.00911, 0.07458, 0.05661, 0.01867, 0.05963, 0.009208,
    14.91, 26.50, 98.87, 567.7, 0.2098, 0.8663, 0.6869, 0.2575, 0.6638, 0.1730,
)
BREAST_MALIGNANT_PRESET = {
    "radius_mean": 17.99, "texture_mean": 10.38, "perimeter_mean": 122.8, "area_mean": 1001.0, "smoothness_mean": 0.1184,
    "compactness_mean": 0.2776, "concavity_mean": 0.3001, "concave_points_mean": 0.1471, "symmetry_mean": 0.2419, "fractal_dimension_mean": 0.07871,
    "radius_se": 1.095, "texture_se": 0.9053, "perimeter_se": 8.589, "area_se": 153.4, "smoothness_se": 0.006399,
    "compactness_se": 0.04904, "concavity_se": 0.05373, "concave_points_se": 0.01587, "symmetry_se": 0.03003, "fractal_dimension_se": 0.006193,
    "radius_worst": 25.38, "texture_worst": 17.33, "perimeter_worst": 184.6, "area_worst": 2019.0, "smoothness_worst": 0.1622,
    "compactness_worst": 0.6656, "concavity_worst": 0.7119, "concave_points_worst": 0.2654, "symmetry_worst": 0.4601, "fractal_dimension_worst": 0.1189
}
BREAST_BENIGN_PRESET = {
    "radius_mean": 13.54, "texture_mean": 14.36, "perimeter_mean": 87.46, "area_mean": 566.3, "smoothness_mean": 0.09779,
    "compactness_mean": 0.08129, "concavity_mean": 0.06664, "concave_points_mean": 0.04781, "symmetry_mean": 0.1885, "fractal_dimension_mean": 0.05766,
    "radius_se": 0.2699, "texture_se": 0.7886, "perimeter_se": 2.058, "area_se": 23.56, "smoothness_se": 0.008462,
    "compactness_se": 0.0146, "concavity_se": 0.02387, "concave_points_se": 0.01315, "symmetry_se": 0.0198, "fractal_dimension_se": 0.0023,
    "radius_worst": 15.11, "texture_worst": 19.26, "perimeter_worst": 99.7, "area_worst": 711.2, "smoothness_worst": 0.144,
    "compactness_worst": 0.1773, "concavity_worst": 0.239, "concave_points_worst": 0.1288, "symmetry_worst": 0.2977, "fractal_dimension_worst": 0.07259
}

DISEASE_MODULE_SPECS = [
    # -----------------------------------------------------------------------
    # 1. Diabetes Mellitus (Tabular)
    # -----------------------------------------------------------------------
    {
        "module_id": "01_diabetes_mellitus",
        "disease_name": "Diabetes Mellitus",
        "disease_key": "diabetes",
        "modality": "Biochemical Glycemic Panel (Tabular)",
        "is_image": False,
        "cases": [
            {
                "case_id": "EVAL-DIAB-001",
                "folder_name": "case_01_diabetic_high_risk",
                "title": "High Risk Uncontrolled Type 2 Diabetes Panel",
                "scenario": "Severe hyperglycemia with high fasting insulin resistance and class I obesity",
                "source_ref": "datasets/sample_reports/01_diabetic_high_risk_panel",
                "inputs": {
                    "pregnancies": 2, "glucose": 168.0, "blood_pressure": 90.0,
                    "skin_thickness": 32.0, "insulin": 42.5, "bmi": 33.4, "dpf": 0.78, "age": 45
                },
                "feature_units": {
                    "pregnancies": ("Gravida / Pregnancies", "count", "Normal: 0-2"),
                    "glucose": ("Fasting Plasma Glucose", "mg/dL", "Normal: 70-99 mg/dL"),
                    "blood_pressure": ("Diastolic Blood Pressure", "mm Hg", "Normal: < 80 mm Hg"),
                    "skin_thickness": ("Triceps Skinfold", "mm", "Normal: 15-25 mm"),
                    "insulin": ("Fasting Serum Insulin", "μU/mL", "Normal: 2.6-24.9 μU/mL"),
                    "bmi": ("Body Mass Index", "kg/m²", "Normal: 18.5-24.9 kg/m²"),
                    "dpf": ("Diabetes Pedigree Function", "score", "Population: 0.1-0.5"),
                    "age": ("Patient Age", "years", "Adult reference")
                }
            },
            {
                "case_id": "EVAL-DIAB-002",
                "folder_name": "case_02_prediabetic_borderline",
                "title": "Prediabetic Borderline Glycemic Screening",
                "scenario": "Impaired fasting glucose with overweight BMI and borderline diastolic pressure",
                "source_ref": "datasets/sample_reports/04_prediabetic_borderline_report",
                "inputs": {
                    "pregnancies": 1, "glucose": 114.0, "blood_pressure": 82.0,
                    "skin_thickness": 24.0, "insulin": 22.0, "bmi": 27.6, "dpf": 0.45, "age": 46
                },
                "feature_units": {
                    "pregnancies": ("Gravida / Pregnancies", "count", "Normal: 0-2"),
                    "glucose": ("Fasting Plasma Glucose", "mg/dL", "Normal: 70-99 mg/dL"),
                    "blood_pressure": ("Diastolic Blood Pressure", "mm Hg", "Normal: < 80 mm Hg"),
                    "skin_thickness": ("Triceps Skinfold", "mm", "Normal: 15-25 mm"),
                    "insulin": ("Fasting Serum Insulin", "μU/mL", "Normal: 2.6-24.9 μU/mL"),
                    "bmi": ("Body Mass Index", "kg/m²", "Normal: 18.5-24.9 kg/m²"),
                    "dpf": ("Diabetes Pedigree Function", "score", "Population: 0.1-0.5"),
                    "age": ("Patient Age", "years", "Adult reference")
                }
            },
            {
                "case_id": "EVAL-DIAB-003",
                "folder_name": "case_03_healthy_annual_wellness",
                "title": "Healthy Annual Wellness Glycemic Baseline",
                "scenario": "Optimal fasting glucose, normal insulin sensitivity, and healthy BMI",
                "source_ref": "datasets/sample_reports/03_healthy_annual_wellness",
                "inputs": {
                    "pregnancies": 0, "glucose": 84.0, "blood_pressure": 74.0,
                    "skin_thickness": 18.0, "insulin": 6.8, "bmi": 21.4, "dpf": 0.18, "age": 28
                },
                "feature_units": {
                    "pregnancies": ("Gravida / Pregnancies", "count", "Normal: 0-2"),
                    "glucose": ("Fasting Plasma Glucose", "mg/dL", "Normal: 70-99 mg/dL"),
                    "blood_pressure": ("Diastolic Blood Pressure", "mm Hg", "Normal: < 80 mm Hg"),
                    "skin_thickness": ("Triceps Skinfold", "mm", "Normal: 15-25 mm"),
                    "insulin": ("Fasting Serum Insulin", "μU/mL", "Normal: 2.6-24.9 μU/mL"),
                    "bmi": ("Body Mass Index", "kg/m²", "Normal: 18.5-24.9 kg/m²"),
                    "dpf": ("Diabetes Pedigree Function", "score", "Population: 0.1-0.5"),
                    "age": ("Patient Age", "years", "Adult reference")
                }
            },
            {
                "case_id": "EVAL-DIAB-004",
                "folder_name": "case_04_moderate_risk_preset",
                "title": "Moderate Risk Diabetic Screening Preset",
                "scenario": "Mild fasting hyperglycemia with elevated body mass index",
                "source_ref": "frontend/src/components/DiabetesView.jsx (Preset 2)",
                "inputs": {
                    "pregnancies": 2, "glucose": 118.0, "blood_pressure": 78.0,
                    "skin_thickness": 25.0, "insulin": 95.0, "bmi": 27.8, "dpf": 0.52, "age": 44
                },
                "feature_units": {
                    "pregnancies": ("Gravida / Pregnancies", "count", "Normal: 0-2"),
                    "glucose": ("Fasting Plasma Glucose", "mg/dL", "Normal: 70-99 mg/dL"),
                    "blood_pressure": ("Diastolic Blood Pressure", "mm Hg", "Normal: < 80 mm Hg"),
                    "skin_thickness": ("Triceps Skinfold", "mm", "Normal: 15-25 mm"),
                    "insulin": ("Fasting Serum Insulin", "μU/mL", "Normal: 2.6-24.9 μU/mL"),
                    "bmi": ("Body Mass Index", "kg/m²", "Normal: 18.5-24.9 kg/m²"),
                    "dpf": ("Diabetes Pedigree Function", "score", "Population: 0.1-0.5"),
                    "age": ("Patient Age", "years", "Adult reference")
                }
            },
            {
                "case_id": "EVAL-DIAB-005",
                "folder_name": "case_05_severe_hyperglycemia_preset",
                "title": "Severe Hyperglycemia with Hyperinsulinemia Preset",
                "scenario": "Marked fasting glucose elevation and advanced insulin resistance",
                "source_ref": "frontend/src/components/DiabetesView.jsx (Preset 3)",
                "inputs": {
                    "pregnancies": 3, "glucose": 168.0, "blood_pressure": 88.0,
                    "skin_thickness": 34.0, "insulin": 195.0, "bmi": 34.2, "dpf": 0.88, "age": 52
                },
                "feature_units": {
                    "pregnancies": ("Gravida / Pregnancies", "count", "Normal: 0-2"),
                    "glucose": ("Fasting Plasma Glucose", "mg/dL", "Normal: 70-99 mg/dL"),
                    "blood_pressure": ("Diastolic Blood Pressure", "mm Hg", "Normal: < 80 mm Hg"),
                    "skin_thickness": ("Triceps Skinfold", "mm", "Normal: 15-25 mm"),
                    "insulin": ("Fasting Serum Insulin", "μU/mL", "Normal: 2.6-24.9 μU/mL"),
                    "bmi": ("Body Mass Index", "kg/m²", "Normal: 18.5-24.9 kg/m²"),
                    "dpf": ("Diabetes Pedigree Function", "score", "Population: 0.1-0.5"),
                    "age": ("Patient Age", "years", "Adult reference")
                }
            }
        ]
    },

    # -----------------------------------------------------------------------
    # 2. Coronary Heart Disease (Tabular)
    # -----------------------------------------------------------------------
    {
        "module_id": "02_coronary_heart_disease",
        "disease_name": "Coronary Heart Disease",
        "disease_key": "heart",
        "modality": "Cardiovascular Clinical Biomarkers (Tabular)",
        "is_image": False,
        "cases": [
            {
                "case_id": "EVAL-CAD-001",
                "folder_name": "case_01_cardiac_high_risk",
                "title": "High Risk Coronary Artery Disease Panel",
                "scenario": "Severe hypercholesterolemia, stage 2 hypertension, ST depression, and exertional angina",
                "source_ref": "datasets/sample_reports/02_cardiac_high_risk_panel",
                "inputs": {
                    "age": 59, "sex": 1, "cp": 0, "trestbps": 152, "chol": 275,
                    "fbs": 1, "restecg": 1, "thalach": 122, "exang": 1, "oldpeak": 2.6,
                    "slope": 1, "ca": 2, "thal": 3
                },
                "feature_units": {
                    "age": ("Patient Age", "years", "Adult reference"),
                    "sex": ("Biological Sex", "binary", "1=Male, 0=Female"),
                    "cp": ("Chest Pain Type", "category", "0=Typical Angina"),
                    "trestbps": ("Resting Blood Pressure", "mm Hg", "Target: < 120 mm Hg"),
                    "chol": ("Serum Total Cholesterol", "mg/dL", "Desirable: < 200 mg/dL"),
                    "fbs": ("Fasting Blood Sugar > 120", "binary", "1=Elevated, 0=Normal"),
                    "restecg": ("Resting Electrocardiogram", "category", "1=ST-T abnormality"),
                    "thalach": ("Maximum Heart Rate", "bpm", "Expected: 140-170 bpm"),
                    "exang": ("Exercise Induced Angina", "binary", "1=Yes, 0=No"),
                    "oldpeak": ("ST Depression (Oldpeak)", "mm", "Normal: < 1.0 mm"),
                    "slope": ("Slope of Peak ST Segment", "category", "1=Flat"),
                    "ca": ("Fluoroscopy Major Vessels", "count", "0-3 vessels colored"),
                    "thal": ("Thalassemia Defect Status", "category", "3=Reversible defect")
                }
            },
            {
                "case_id": "EVAL-CAD-002",
                "folder_name": "case_02_healthy_cardiovascular_baseline",
                "title": "Healthy Cardiovascular Baseline Evaluation",
                "scenario": "Normotensive adult, optimal lipid levels, no angina or ischemic ECG changes",
                "source_ref": "frontend/src/components/HeartView.jsx (Preset 1)",
                "inputs": {
                    "age": 38, "sex": 0, "cp": 1, "trestbps": 115, "chol": 175,
                    "fbs": 0, "restecg": 0, "thalach": 165, "exang": 0, "oldpeak": 0.2,
                    "slope": 2, "ca": 0, "thal": 1
                },
                "feature_units": {
                    "age": ("Patient Age", "years", "Adult reference"),
                    "sex": ("Biological Sex", "binary", "1=Male, 0=Female"),
                    "cp": ("Chest Pain Type", "category", "1=Atypical Angina"),
                    "trestbps": ("Resting Blood Pressure", "mm Hg", "Target: < 120 mm Hg"),
                    "chol": ("Serum Total Cholesterol", "mg/dL", "Desirable: < 200 mg/dL"),
                    "fbs": ("Fasting Blood Sugar > 120", "binary", "1=Elevated, 0=Normal"),
                    "restecg": ("Resting Electrocardiogram", "category", "0=Normal"),
                    "thalach": ("Maximum Heart Rate", "bpm", "Expected: 140-170 bpm"),
                    "exang": ("Exercise Induced Angina", "binary", "1=Yes, 0=No"),
                    "oldpeak": ("ST Depression (Oldpeak)", "mm", "Normal: < 1.0 mm"),
                    "slope": ("Slope of Peak ST Segment", "category", "2=Upsloping"),
                    "ca": ("Fluoroscopy Major Vessels", "count", "0 vessels"),
                    "thal": ("Thalassemia Defect Status", "category", "1=Normal")
                }
            },
            {
                "case_id": "EVAL-CAD-003",
                "folder_name": "case_03_cad_angina_preset",
                "title": "Symptomatic Coronary Artery Disease Preset",
                "scenario": "Male patient with typical angina, hypercholesterolemia, and positive ischemic ST depression",
                "source_ref": "tests/test_e2e_all_diseases_reports.py (CAD Preset)",
                "inputs": {
                    "age": 58, "sex": 1, "cp": 0, "trestbps": 148, "chol": 265,
                    "fbs": 1, "restecg": 1, "thalach": 128, "exang": 1, "oldpeak": 2.4,
                    "slope": 1, "ca": 2, "thal": 3
                },
                "feature_units": {
                    "age": ("Patient Age", "years", "Adult reference"),
                    "sex": ("Biological Sex", "binary", "1=Male, 0=Female"),
                    "cp": ("Chest Pain Type", "category", "0=Typical Angina"),
                    "trestbps": ("Resting Blood Pressure", "mm Hg", "Target: < 120 mm Hg"),
                    "chol": ("Serum Total Cholesterol", "mg/dL", "Desirable: < 200 mg/dL"),
                    "fbs": ("Fasting Blood Sugar > 120", "binary", "1=Elevated, 0=Normal"),
                    "restecg": ("Resting Electrocardiogram", "category", "1=ST-T abnormality"),
                    "thalach": ("Maximum Heart Rate", "bpm", "Expected: 140-170 bpm"),
                    "exang": ("Exercise Induced Angina", "binary", "1=Yes, 0=No"),
                    "oldpeak": ("ST Depression (Oldpeak)", "mm", "Normal: < 1.0 mm"),
                    "slope": ("Slope of Peak ST Segment", "category", "1=Flat"),
                    "ca": ("Fluoroscopy Major Vessels", "count", "2 vessels"),
                    "thal": ("Thalassemia Defect Status", "category", "3=Reversible defect")
                }
            }
        ]
    },

    # -----------------------------------------------------------------------
    # 3. Pneumonia (Chest Radiography / X-Ray)
    # -----------------------------------------------------------------------
    {
        "module_id": "03_pneumonia_chest_xray",
        "disease_name": "Pneumonia",
        "disease_key": "pneumonia",
        "modality": "Chest Radiography (X-Ray)",
        "is_image": True,
        "cases": [
            {
                "case_id": "EVAL-XRAY-001",
                "folder_name": "case_01_acute_pneumonia",
                "title": "Acute Lobar Pneumonia Consolidation Scan",
                "scenario": "High-density parenchymal infiltrate and consolidation across right lower pulmonary zone",
                "source_image": "frontend/public/test_samples/xray_pneumonia.jpeg",
                "inputs": {"modality": "Chest X-Ray (AP)", "projection": "Anterior-Posterior"}
            },
            {
                "case_id": "EVAL-XRAY-002",
                "folder_name": "case_02_normal_clear_lungs",
                "title": "Normal Clear Lungs Radiograph",
                "scenario": "Clear bilateral lung fields with sharp costophrenic angles and normal cardiothoracic ratio",
                "source_image": "frontend/public/test_samples/xray_normal.jpeg",
                "inputs": {"modality": "Chest X-Ray (PA)", "projection": "Posterior-Anterior"}
            },
            {
                "case_id": "EVAL-XRAY-003",
                "folder_name": "case_03_synthetic_xray_fixture",
                "title": "Standardized Calibration Chest Radiograph",
                "scenario": "Synthetic radiographic test scan for automated density and receptive field calibration",
                "source_image": "datasets/sample_reports/05_sample_chest_xray.png",
                "inputs": {"modality": "Synthetic Radiograph Scan", "projection": "Benchmark"}
            }
        ]
    },

    # -----------------------------------------------------------------------
    # 4. Brain Tumor (Cranial MRI 4-Class)
    # -----------------------------------------------------------------------
    {
        "module_id": "04_brain_tumor_mri",
        "disease_name": "Brain Tumor (MRI)",
        "disease_key": "brain_tumor",
        "modality": "Cranial Magnetic Resonance Imaging (MRI)",
        "is_image": True,
        "cases": [
            {
                "case_id": "EVAL-BRAIN-001",
                "folder_name": "case_01_glioma",
                "title": "Intra-axial Glial Neoplasm Cranial MRI",
                "scenario": "Infiltrative hyperintense mass lesion located within the cerebral hemisphere consistent with Glioma",
                "source_image": "frontend/public/test_samples/brain_glioma.jpg",
                "inputs": {"modality": "T1-weighted Contrast Cranial MRI", "sequence": "Axial Slice"}
            },
            {
                "case_id": "EVAL-BRAIN-002",
                "folder_name": "case_02_meningioma",
                "title": "Extra-axial Dural-Tail Meningioma MRI",
                "scenario": "Well-circumscribed extra-axial dural-based compressive mass lesion",
                "source_image": "frontend/public/test_samples/brain_meningioma.jpg",
                "inputs": {"modality": "T1-weighted Contrast Cranial MRI", "sequence": "Axial Slice"}
            },
            {
                "case_id": "EVAL-BRAIN-003",
                "folder_name": "case_03_pituitary_adenoma",
                "title": "Sellar / Suprasellar Pituitary Adenoma MRI",
                "scenario": "Circumscribed neoplasm situated in the sellar region adjacent to the optic chiasm",
                "source_image": "frontend/public/test_samples/brain_pituitary.jpg",
                "inputs": {"modality": "Coronal T1 Cranial MRI", "sequence": "Pituitary Protocol"}
            },
            {
                "case_id": "EVAL-BRAIN-004",
                "folder_name": "case_04_no_tumor_healthy",
                "title": "Normal Cranial MRI Screening (No Tumor)",
                "scenario": "Unremarkable cerebral and cerebellar parenchyma without focal mass lesions or midline shift",
                "source_image": "frontend/public/test_samples/brain_notumor.jpg",
                "inputs": {"modality": "Standard Cranial MRI Screening", "sequence": "Axial Slice"}
            }
        ]
    },

    # -----------------------------------------------------------------------
    # 5. Breast Cancer (WDBC FNA 30-Feature Morphometry)
    # -----------------------------------------------------------------------
    {
        "module_id": "05_breast_cancer_fna",
        "disease_name": "Breast Cancer",
        "disease_key": "breast",
        "modality": "Fine Needle Aspirate (FNA) Nuclear Morphometry",
        "is_image": False,
        "cases": [
            {
                "case_id": "EVAL-BREAST-001",
                "folder_name": "case_01_complete_wdbc_case_a",
                "title": "WDBC Complete Nuclear Morphometry Profile Case A",
                "scenario": "Full 30-dimensional cytological nuclear feature panel from fine needle aspirate biopsy",
                "source_ref": "datasets/sample_reports/07_breast_fna_complete_case_a",
                "inputs": dict(zip(BREAST_FEATURE_ORDER, BREAST_BASE_A))
            },
            {
                "case_id": "EVAL-BREAST-002",
                "folder_name": "case_02_complete_wdbc_case_b",
                "title": "WDBC Complete Nuclear Morphometry Profile Case B",
                "scenario": "Second complete 30-feature cytopathological aspirate profile",
                "source_ref": "datasets/sample_reports/08_breast_fna_complete_case_b",
                "inputs": dict(zip(BREAST_FEATURE_ORDER, BREAST_BASE_B))
            },
            {
                "case_id": "EVAL-BREAST-003",
                "folder_name": "case_03_malignant_preset",
                "title": "High-Grade Malignant Invasive Ductal FNA Profile",
                "scenario": "Nuclear pleomorphism, enlarged mean radius (17.99), high perimeter and severe concavity",
                "source_ref": "frontend/src/components/BreastCancerView.jsx (MALIGNANT_SAMPLE)",
                "inputs": BREAST_MALIGNANT_PRESET
            },
            {
                "case_id": "EVAL-BREAST-004",
                "folder_name": "case_04_benign_preset",
                "title": "Benign Fibroadenoma Regular Nuclear Profile",
                "scenario": "Regular nuclear margins, small mean radius (13.54), low concavity and uniform chromatin",
                "source_ref": "frontend/src/components/BreastCancerView.jsx (BENIGN_SAMPLE)",
                "inputs": BREAST_BENIGN_PRESET
            },
            {
                "case_id": "EVAL-BREAST-005",
                "folder_name": "case_05_incomplete_review_case",
                "title": "Incomplete FNA Morphometry Profile (Review Required)",
                "scenario": "Deliberately incomplete 10-feature panel requiring clinician completion under clinical contract",
                "source_ref": "datasets/sample_reports/09_breast_fna_incomplete_review_case",
                "inputs": dict(zip(BREAST_FEATURE_ORDER[:10], BREAST_BASE_A[:10])),
                "is_incomplete": True
            }
        ]
    },

    # -----------------------------------------------------------------------
    # 6. Kidney Pathology (Abdominal CT 4-Class)
    # -----------------------------------------------------------------------
    {
        "module_id": "06_kidney_pathology_ct",
        "disease_name": "Kidney Pathology (CT)",
        "disease_key": "kidney_stone",
        "modality": "Non-Contrast Abdominal CT Scan",
        "is_image": True,
        "cases": [
            {
                "case_id": "EVAL-KIDNEY-001",
                "folder_name": "case_01_renal_stone",
                "title": "Nephrolithiasis / Calcified Calculus CT Scan",
                "scenario": "High-attenuation calcified calculus identified within the renal pelvicalyceal system",
                "source_image": "frontend/public/test_samples/kidney_stone.jpg",
                "inputs": {"modality": "Non-contrast Abdominal CT", "slice": "Transverse Renal Axial"}
            },
            {
                "case_id": "EVAL-KIDNEY-002",
                "folder_name": "case_02_cortical_cyst",
                "title": "Cortical Renal Fluid Cyst CT Scan",
                "scenario": "Well-circumscribed hypoattenuating fluid cyst located in renal cortex",
                "source_image": "frontend/public/test_samples/kidney_cyst.jpg",
                "inputs": {"modality": "Non-contrast Abdominal CT", "slice": "Transverse Renal Axial"}
            },
            {
                "case_id": "EVAL-KIDNEY-003",
                "folder_name": "case_03_renal_tumor",
                "title": "Solid Renal Parenchymal Tumor CT Scan",
                "scenario": "Solid hyperdense renal mass lesion with parenchymal architectural distortion",
                "source_image": "frontend/public/test_samples/kidney_tumor.jpg",
                "inputs": {"modality": "Non-contrast Abdominal CT", "slice": "Transverse Renal Axial"}
            },
            {
                "case_id": "EVAL-KIDNEY-004",
                "folder_name": "case_04_normal_kidney",
                "title": "Normal Renal CT Examination",
                "scenario": "Bilateral unremarkable renal parenchyma with no calcifications, cysts, or masses",
                "source_image": "frontend/public/test_samples/kidney_normal.jpg",
                "inputs": {"modality": "Non-contrast Abdominal CT", "slice": "Transverse Renal Axial"}
            }
        ]
    },

    # -----------------------------------------------------------------------
    # 7. Skin Cancer & Cutaneous Lesions (HAM10000 7-Class Dermoscopy)
    # -----------------------------------------------------------------------
    {
        "module_id": "07_skin_cancer_dermoscopy",
        "disease_name": "Skin Cancer & Cutaneous Lesions (HAM10000)",
        "disease_key": "skin_cancer",
        "modality": "Polarized Contact Dermoscopy",
        "is_image": True,
        "cases": [
            {
                "case_id": "EVAL-SKIN-001",
                "folder_name": "case_01_melanoma_malignant",
                "title": "Malignant Cutaneous Melanoma Dermoscopy",
                "scenario": "Asymmetric pigmented lesion with irregular borders, atypical pigment network, and color variegation",
                "source_image": "frontend/public/test_samples/skin_melanoma.jpg",
                "inputs": {"modality": "Contact Polarized Dermoscopy", "anatomical_site": "Trunk"}
            },
            {
                "case_id": "EVAL-SKIN-002",
                "folder_name": "case_02_basal_cell_carcinoma",
                "title": "Basal Cell Carcinoma (BCC) Dermoscopy",
                "scenario": "Nodular/superficial basal cell carcinoma with arborizing telangiectasia and ulceration",
                "source_image": "frontend/public/test_samples/skin_basal_cell_carcinoma.jpg",
                "inputs": {"modality": "Contact Polarized Dermoscopy", "anatomical_site": "Face / Neck"}
            },
            {
                "case_id": "EVAL-SKIN-003",
                "folder_name": "case_03_benign_keratosis",
                "title": "Benign Keratosis-like Lesion Dermoscopy",
                "scenario": "Seborrheic keratosis with pseudofollicular openings and sharp demarcated borders",
                "source_image": "frontend/public/test_samples/skin_benign_keratosis.jpg",
                "inputs": {"modality": "Contact Polarized Dermoscopy", "anatomical_site": "Chest"}
            },
            {
                "case_id": "EVAL-SKIN-004",
                "folder_name": "case_04_actinic_keratosis",
                "title": "Pre-malignant Actinic Keratosis / Bowen Disease",
                "scenario": "Erythematous scaly plaque with strawberry pattern and follicular plugs",
                "source_image": "frontend/public/test_samples/skin_actinic_keratosis.jpg",
                "inputs": {"modality": "Contact Polarized Dermoscopy", "anatomical_site": "Scalp"}
            },
            {
                "case_id": "EVAL-SKIN-005",
                "folder_name": "case_05_melanocytic_nevus",
                "title": "Benign Melanocytic Nevus (Common Mole)",
                "scenario": "Symmetric, uniform brown reticular pattern without architectural atypia",
                "source_image": "frontend/public/test_samples/skin_nevus.jpg",
                "inputs": {"modality": "Contact Polarized Dermoscopy", "anatomical_site": "Extremity"}
            },
            {
                "case_id": "EVAL-SKIN-006",
                "folder_name": "case_06_vascular_lesion",
                "title": "Cutaneous Vascular Lesion / Hemangioma",
                "scenario": "Red-purple well-defined vascular lacunae consistent with cherry hemangioma",
                "source_image": "frontend/public/test_samples/skin_vascular.jpg",
                "inputs": {"modality": "Contact Polarized Dermoscopy", "anatomical_site": "Abdomen"}
            },
            {
                "case_id": "EVAL-SKIN-007",
                "folder_name": "case_07_dermatofibroma",
                "title": "Benign Dermatofibroma / Histiocytoma",
                "scenario": "Central white patch surrounded by delicate faint pigment network",
                "source_image": "frontend/public/test_samples/skin_dermatofibroma.jpg",
                "inputs": {"modality": "Contact Polarized Dermoscopy", "anatomical_site": "Lower Extremity"}
            }
        ]
    },

    # -----------------------------------------------------------------------
    # 8. Liver Disease (ILPD 10-Feature Tabular)
    # -----------------------------------------------------------------------
    {
        "module_id": "08_liver_disease_ilpd",
        "disease_name": "Liver Disease (ILPD)",
        "disease_key": "liver",
        "modality": "Hepatic Functional Panel & Serology (Tabular)",
        "is_image": False,
        "cases": [
            {
                "case_id": "EVAL-LIVER-001",
                "folder_name": "case_01_healthy_liver_profile",
                "title": "Healthy Liver Function Profile",
                "scenario": "Bilirubin, transaminases, and synthetic proteins in optimal reference ranges",
                "source_ref": "frontend/src/components/LiverDiseaseView.jsx (Preset 1)",
                "inputs": {
                    "age": 34, "gender": "Male", "total_bilirubin": 0.7, "direct_bilirubin": 0.2,
                    "alkaline_phosphotase": 95, "alamine_aminotransferase": 24, "aspartate_aminotransferase": 22,
                    "total_protiens": 7.2, "albumin": 4.2, "ag_ratio": 1.4
                },
                "feature_units": {
                    "age": ("Patient Age", "years", "Adult reference"),
                    "gender": ("Biological Gender", "string", "Male / Female"),
                    "total_bilirubin": ("Total Serum Bilirubin", "mg/dL", "Normal: 0.2 - 1.2 mg/dL"),
                    "direct_bilirubin": ("Direct Conjugated Bilirubin", "mg/dL", "Normal: 0.0 - 0.4 mg/dL"),
                    "alkaline_phosphotase": ("Alkaline Phosphatase (ALP)", "IU/L", "Normal: 44 - 147 IU/L"),
                    "alamine_aminotransferase": ("ALT / SGPT Transaminase", "IU/L", "Normal: 7 - 56 IU/L"),
                    "aspartate_aminotransferase": ("AST / SGOT Transaminase", "IU/L", "Normal: 10 - 40 IU/L"),
                    "total_protiens": ("Total Serum Proteins", "g/dL", "Normal: 6.0 - 8.3 g/dL"),
                    "albumin": ("Serum Albumin", "g/dL", "Normal: 3.5 - 5.5 g/dL"),
                    "ag_ratio": ("Albumin / Globulin Ratio", "ratio", "Normal: 1.0 - 2.5")
                }
            },
            {
                "case_id": "EVAL-LIVER-002",
                "folder_name": "case_02_acute_hepatocellular_injury",
                "title": "Acute Hepatocellular Cytolysis / Injury Profile",
                "scenario": "Marked transaminase elevation (ALT/AST > 180 IU/L) with moderate hyperbilirubinemia",
                "source_ref": "frontend/src/components/LiverDiseaseView.jsx (Preset 2)",
                "inputs": {
                    "age": 48, "gender": "Male", "total_bilirubin": 2.8, "direct_bilirubin": 1.2,
                    "alkaline_phosphotase": 190, "alamine_aminotransferase": 240, "aspartate_aminotransferase": 185,
                    "total_protiens": 6.5, "albumin": 3.3, "ag_ratio": 1.0
                },
                "feature_units": {
                    "age": ("Patient Age", "years", "Adult reference"),
                    "gender": ("Biological Gender", "string", "Male / Female"),
                    "total_bilirubin": ("Total Serum Bilirubin", "mg/dL", "Normal: 0.2 - 1.2 mg/dL"),
                    "direct_bilirubin": ("Direct Conjugated Bilirubin", "mg/dL", "Normal: 0.0 - 0.4 mg/dL"),
                    "alkaline_phosphotase": ("Alkaline Phosphatase (ALP)", "IU/L", "Normal: 44 - 147 IU/L"),
                    "alamine_aminotransferase": ("ALT / SGPT Transaminase", "IU/L", "Normal: 7 - 56 IU/L"),
                    "aspartate_aminotransferase": ("AST / SGOT Transaminase", "IU/L", "Normal: 10 - 40 IU/L"),
                    "total_protiens": ("Total Serum Proteins", "g/dL", "Normal: 6.0 - 8.3 g/dL"),
                    "albumin": ("Serum Albumin", "g/dL", "Normal: 3.5 - 5.5 g/dL"),
                    "ag_ratio": ("Albumin / Globulin Ratio", "ratio", "Normal: 1.0 - 2.5")
                }
            },
            {
                "case_id": "EVAL-LIVER-003",
                "folder_name": "case_03_cholestatic_biliary_obstruction",
                "title": "Cholestatic Biliary Stasis & Obstruction Profile",
                "scenario": "Severe alkaline phosphatase elevation (ALP 420 IU/L) with conjugated direct bilirubin",
                "source_ref": "frontend/src/components/LiverDiseaseView.jsx (Preset 3)",
                "inputs": {
                    "age": 56, "gender": "Female", "total_bilirubin": 3.9, "direct_bilirubin": 2.1,
                    "alkaline_phosphotase": 420, "alamine_aminotransferase": 68, "aspartate_aminotransferase": 74,
                    "total_protiens": 6.8, "albumin": 3.6, "ag_ratio": 1.1
                },
                "feature_units": {
                    "age": ("Patient Age", "years", "Adult reference"),
                    "gender": ("Biological Gender", "string", "Male / Female"),
                    "total_bilirubin": ("Total Serum Bilirubin", "mg/dL", "Normal: 0.2 - 1.2 mg/dL"),
                    "direct_bilirubin": ("Direct Conjugated Bilirubin", "mg/dL", "Normal: 0.0 - 0.4 mg/dL"),
                    "alkaline_phosphotase": ("Alkaline Phosphatase (ALP)", "IU/L", "Normal: 44 - 147 IU/L"),
                    "alamine_aminotransferase": ("ALT / SGPT Transaminase", "IU/L", "Normal: 7 - 56 IU/L"),
                    "aspartate_aminotransferase": ("AST / SGOT Transaminase", "IU/L", "Normal: 10 - 40 IU/L"),
                    "total_protiens": ("Total Serum Proteins", "g/dL", "Normal: 6.0 - 8.3 g/dL"),
                    "albumin": ("Serum Albumin", "g/dL", "Normal: 3.5 - 5.5 g/dL"),
                    "ag_ratio": ("Albumin / Globulin Ratio", "ratio", "Normal: 1.0 - 2.5")
                }
            },
            {
                "case_id": "EVAL-LIVER-004",
                "folder_name": "case_04_cirrhotic_decompensated",
                "title": "Cirrhotic / Decompensated Chronic Hepatic Profile",
                "scenario": "Severe hypoalbuminemia (2.3 g/dL), inverted A/G ratio (0.7), and marked clinical jaundice",
                "source_ref": "frontend/src/components/LiverDiseaseView.jsx (Preset 4)",
                "inputs": {
                    "age": 62, "gender": "Male", "total_bilirubin": 4.5, "direct_bilirubin": 2.4,
                    "alkaline_phosphotase": 280, "alamine_aminotransferase": 95, "aspartate_aminotransferase": 110,
                    "total_protiens": 5.4, "albumin": 2.3, "ag_ratio": 0.7
                },
                "feature_units": {
                    "age": ("Patient Age", "years", "Adult reference"),
                    "gender": ("Biological Gender", "string", "Male / Female"),
                    "total_bilirubin": ("Total Serum Bilirubin", "mg/dL", "Normal: 0.2 - 1.2 mg/dL"),
                    "direct_bilirubin": ("Direct Conjugated Bilirubin", "mg/dL", "Normal: 0.0 - 0.4 mg/dL"),
                    "alkaline_phosphotase": ("Alkaline Phosphatase (ALP)", "IU/L", "Normal: 44 - 147 IU/L"),
                    "alamine_aminotransferase": ("ALT / SGPT Transaminase", "IU/L", "Normal: 7 - 56 IU/L"),
                    "aspartate_aminotransferase": ("AST / SGOT Transaminase", "IU/L", "Normal: 10 - 40 IU/L"),
                    "total_protiens": ("Total Serum Proteins", "g/dL", "Normal: 6.0 - 8.3 g/dL"),
                    "albumin": ("Serum Albumin", "g/dL", "Normal: 3.5 - 5.5 g/dL"),
                    "ag_ratio": ("Albumin / Globulin Ratio", "ratio", "Normal: 1.0 - 2.5")
                }
            },
            {
                "case_id": "EVAL-LIVER-005",
                "folder_name": "case_05_clinical_diagnostic_profile",
                "title": "Chronic Low-Grade Hepatic Inflammation Profile",
                "scenario": "Slight transaminase elevation with borderline alkaline phosphatase elevation",
                "source_ref": "tests/test_e2e_all_diseases_reports.py (Liver Case)",
                "inputs": {
                    "age": 45, "gender": "Male", "total_bilirubin": 1.4, "direct_bilirubin": 0.6,
                    "alkaline_phosphotase": 260, "alamine_aminotransferase": 48, "aspartate_aminotransferase": 56,
                    "total_protiens": 6.8, "albumin": 3.1, "ag_ratio": 0.83
                },
                "feature_units": {
                    "age": ("Patient Age", "years", "Adult reference"),
                    "gender": ("Biological Gender", "string", "Male / Female"),
                    "total_bilirubin": ("Total Serum Bilirubin", "mg/dL", "Normal: 0.2 - 1.2 mg/dL"),
                    "direct_bilirubin": ("Direct Conjugated Bilirubin", "mg/dL", "Normal: 0.0 - 0.4 mg/dL"),
                    "alkaline_phosphotase": ("Alkaline Phosphatase (ALP)", "IU/L", "Normal: 44 - 147 IU/L"),
                    "alamine_aminotransferase": ("ALT / SGPT Transaminase", "IU/L", "Normal: 7 - 56 IU/L"),
                    "aspartate_aminotransferase": ("AST / SGOT Transaminase", "IU/L", "Normal: 10 - 40 IU/L"),
                    "total_protiens": ("Total Serum Proteins", "g/dL", "Normal: 6.0 - 8.3 g/dL"),
                    "albumin": ("Serum Albumin", "g/dL", "Normal: 3.5 - 5.5 g/dL"),
                    "ag_ratio": ("Albumin / Globulin Ratio", "ratio", "Normal: 1.0 - 2.5")
                }
            }
        ]
    },

    # -----------------------------------------------------------------------
    # 9. Eye Disease (Digital Retinal Fundus Photography 5-Class)
    # -----------------------------------------------------------------------
    {
        "module_id": "09_eye_disease_fundus",
        "disease_name": "Eye Disease (Ophthalmic)",
        "disease_key": "eye",
        "modality": "Digital Retinal Fundus & Ophthalmic Photography",
        "is_image": True,
        "cases": [
            {
                "case_id": "EVAL-EYE-001",
                "folder_name": "case_01_glaucoma_optic_neuropathy",
                "title": "Glaucomatous Optic Nerve Cupping Fundus Scan",
                "scenario": "Optic disc cupping, neuroretinal rim thinning, and retinal nerve fiber layer attrition",
                "source_image": "frontend/public/test_samples/eye_glaucoma.jpeg",
                "inputs": {"modality": "Digital Color Fundus Photography", "field": "45° Posterior Pole"}
            },
            {
                "case_id": "EVAL-EYE-002",
                "folder_name": "case_02_cataract_lens_opacification",
                "title": "Cataractous Lens Opacity Retinal Fundus",
                "scenario": "Dense nuclear sclerotic crystalline lens opacification obscuring macular details",
                "source_image": "frontend/public/test_samples/eye_cataract.jpeg",
                "inputs": {"modality": "Digital Color Fundus Photography", "field": "45° Posterior Pole"}
            },
            {
                "case_id": "EVAL-EYE-003",
                "folder_name": "case_03_bulging_eyes_proptosis",
                "title": "Thyroid Orbitopathy / Bulging Eyes Clinical Scan",
                "scenario": "Exophthalmos / proptosis secondary to orbital connective tissue proliferation",
                "source_image": "frontend/public/test_samples/eye_bulging.jpeg",
                "inputs": {"modality": "External Ophthalmic Clinical Photography", "view": "Primary Gaze"}
            },
            {
                "case_id": "EVAL-EYE-004",
                "folder_name": "case_04_crossed_eyes_strabismus",
                "title": "Extraocular Strabismus / Ocular Misalignment",
                "scenario": "Binocular misalignment / esotropia resulting from ocular motor nerve or muscular imbalance",
                "source_image": "frontend/public/test_samples/eye_crossed.jpeg",
                "inputs": {"modality": "External Ophthalmic Clinical Photography", "view": "Primary Gaze"}
            },
            {
                "case_id": "EVAL-EYE-005",
                "folder_name": "case_05_uveitis_intraocular_inflammation",
                "title": "Intraocular Uveitis Inflammatory Scan",
                "scenario": "Anterior chamber flare and inflammatory cell infiltration across the uveal tract",
                "source_image": "frontend/public/test_samples/eye_uveitis.jpeg",
                "inputs": {"modality": "Slit-Lamp / Anterior Segment Photography", "magnification": "16x"}
            },
            {
                "case_id": "EVAL-EYE-006",
                "folder_name": "case_06_normal_fundus_screening",
                "title": "Normal Physiological Retinal Screening Fundus",
                "scenario": "Unremarkable retinal macula, crisp optic disc margins, and normal vascular caliber",
                "source_image": "frontend/public/test_samples/eye_normal.png",
                "inputs": {"modality": "Digital Color Fundus Photography", "field": "45° Posterior Pole"}
            },
            {
                "case_id": "EVAL-EYE-007",
                "folder_name": "case_07_diabetic_retinopathy_referral",
                "title": "Diabetic Retinopathy Referral Fundus Scan",
                "scenario": "Microvascular changes, microaneurysms, and intraretinal blot hemorrhages",
                "source_image": "frontend/public/test_samples/eye_diabetic_retinopathy.png",
                "inputs": {"modality": "Digital Color Fundus Photography", "field": "45° Posterior Pole"}
            }
        ]
    }
]


# ---------------------------------------------------------------------------
# PDF Generation with ReportLab
# ---------------------------------------------------------------------------

def draw_clinical_report_pdf(
    pdf_path: Path,
    case_meta: dict[str, Any],
    pred: dict[str, Any],
    diag_rep: dict[str, Any],
    llm_rep: dict[str, Any],
    image_thumb_path: Path | None = None,
    gradcam_thumb_path: Path | None = None
) -> None:
    c = Canvas(str(pdf_path), pagesize=A4)
    w, h = A4
    margin = 36
    c.setTitle(f"MedSynapse Evaluation Report - {case_meta['case_id']}")
    c.setAuthor("MedSynapse Clinical Diagnostic Benchmark Platform")

    # Determine status color
    prob = float(pred.get("risk_probability", 0.0) or 0.0)
    risk_tier = pred.get("risk_tier", "Low Risk")
    is_positive = bool(pred.get("is_positive") or pred.get("has_disease") or prob >= 0.5)

    if risk_tier == "High Risk" or is_positive:
        badge_bg = colors.HexColor("#ef4444")
        badge_text = "HIGH RISK / POSITIVE"
    elif risk_tier == "Moderate Risk":
        badge_bg = colors.HexColor("#f59e0b")
        badge_text = "MODERATE RISK"
    else:
        badge_bg = colors.HexColor("#10b981")
        badge_text = "LOW RISK / NORMAL"

    if case_meta.get("is_incomplete"):
        badge_bg = colors.HexColor("#6366f1")
        badge_text = "REVIEW REQUIRED"

    # 1. Top Header Banner
    header_h = 58
    c.setFillColor(colors.HexColor("#0f2942"))
    c.rect(0, h - header_h, w, header_h, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin, h - 26, "MedSynapse | Clinical Diagnostic Report")
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#94a3b8"))
    c.drawString(margin, h - 42, "STANDARDIZED AI SYSTEM BENCHMARK & MULTIVARIABLE CLINICAL DECISION SUPPORT")

    # Header badge
    c.setFillColor(badge_bg)
    c.roundRect(w - margin - 150, h - 42, 150, 24, 3, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(w - margin - 75, h - 33, badge_text)

    # 2. Encounter Metadata Box
    y = h - header_h - 12
    box_h = 42
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.roundRect(margin, y - box_h, w - 2 * margin, box_h, 3, fill=1, stroke=1)

    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin + 10, y - 16, f"CASE ID: {case_meta['case_id']}")
    c.drawString(margin + 175, y - 16, f"MODALITY: {case_meta.get('modality', 'Clinical Biometrics')[:35]}")
    c.drawString(margin + 360, y - 16, "CLINICIAN: Dr. Sarah Chen, MD")

    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#475569"))
    c.drawString(margin + 10, y - 31, f"SCENARIO: {case_meta.get('title', '')[:35]}")
    c.drawString(margin + 175, y - 31, f"EVAL DATE: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    c.drawString(margin + 360, y - 31, "AFFILIATION: MedSynapse Health Network")

    # 3. Section 1: Clinical Findings & Patient Inputs
    y = y - box_h - 14
    c.setFillColor(colors.HexColor("#0f3d4c"))
    c.rect(margin, y - 16, w - 2 * margin, 16, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(margin + 8, y - 11, "1. CLINICAL PARAMETERS & DIAGNOSTIC OBSERVATIONS")
    y -= 22

    if not case_meta.get("is_image", False):
        # Tabular features rendering
        inputs = case_meta.get("inputs", {})
        feature_units = case_meta.get("feature_units", {})
        entries = list(inputs.items())

        # If lots of features (e.g. breast cancer 30 features), render in 2 columns
        if len(entries) > 12:
            cols = 2
            col_w = (w - 2 * margin - 14) / cols
            rows_per_col = (len(entries) + cols - 1) // cols
            row_h = 10.5
            for col_idx in range(cols):
                cx = margin + col_idx * (col_w + 14)
                for r_idx, (fname, fval) in enumerate(entries[col_idx * rows_per_col:(col_idx + 1) * rows_per_col]):
                    ry = y - r_idx * row_h
                    if r_idx % 2 == 0:
                        c.setFillColor(colors.HexColor("#f8fafc"))
                        c.rect(cx, ry - 7.5, col_w, 9.5, fill=1, stroke=0)
                    c.setFillColor(colors.HexColor("#1e293b"))
                    c.setFont("Courier-Bold", 7)
                    c.drawString(cx + 4, ry - 1, fname[:24])
                    val_str = f"{fval:.4f}" if isinstance(fval, float) else str(fval)
                    c.drawRightString(cx + col_w - 4, ry - 1, val_str)
            y -= rows_per_col * row_h + 8
        else:
            # Clean structured table with Reference & Status
            table_w = w - 2 * margin
            row_h = 12.5
            c.setFillColor(colors.HexColor("#f1f5f9"))
            c.rect(margin, y - 10, table_w, 12, fill=1, stroke=0)
            c.setFillColor(colors.HexColor("#475569"))
            c.setFont("Helvetica-Bold", 7)
            c.drawString(margin + 6, y - 7, "BIOMARKER / PARAMETER")
            c.drawString(margin + 170, y - 7, "MEASURED VALUE")
            c.drawString(margin + 280, y - 7, "REFERENCE THRESHOLD")
            c.drawString(margin + 420, y - 7, "CLINICAL EVALUATION")
            y -= 14

            for r_idx, (fname, fval) in enumerate(entries):
                ry = y - r_idx * row_h
                if r_idx % 2 == 0:
                    c.setFillColor(colors.HexColor("#f8fafc"))
                    c.rect(margin, ry - 9.5, table_w, 11.5, fill=1, stroke=0)

                disp_name, unit_str, ref_str = feature_units.get(fname, (fname.replace("_", " ").title(), "", "Standard reference"))
                c.setFillColor(colors.HexColor("#0f172a"))
                c.setFont("Helvetica", 7.5)
                c.drawString(margin + 6, ry - 6, f"{disp_name} ({fname})")

                c.setFont("Courier-Bold", 7.5)
                val_text = f"{fval} {unit_str}".strip() if isinstance(fval, (int, float, str)) else str(fval)
                c.drawString(margin + 170, ry - 6, val_text[:20])

                c.setFont("Helvetica", 7)
                c.setFillColor(colors.HexColor("#64748b"))
                c.drawString(margin + 280, ry - 6, ref_str[:25])

                # Status tag
                c.setFont("Helvetica-Bold", 7)
                if (fname == "glucose" and float(fval) >= 126) or (fname == "chol" and float(fval) >= 240) or (fname == "total_bilirubin" and float(fval) > 1.2):
                    c.setFillColor(colors.HexColor("#dc2626"))
                    status_text = "ELEVATED"
                elif (fname == "glucose" and float(fval) >= 100) or (fname == "bmi" and float(fval) >= 25):
                    c.setFillColor(colors.HexColor("#d97706"))
                    status_text = "BORDERLINE"
                else:
                    c.setFillColor(colors.HexColor("#16a34a"))
                    status_text = "NORMAL"
                c.drawString(margin + 420, ry - 6, status_text)
            y -= len(entries) * row_h + 8

    else:
        # Image scan details & thumbnails
        left_w = 260
        img_box_h = 100
        c.setFillColor(colors.HexColor("#f8fafc"))
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.roundRect(margin, y - img_box_h, left_w, img_box_h, 3, fill=1, stroke=1)

        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 8)
        c.drawString(margin + 10, y - 16, "IMAGE ACQUISITION & TENSOR SPECS")
        c.setFont("Helvetica", 7.5)
        c.setFillColor(colors.HexColor("#334155"))
        inputs = case_meta.get("inputs", {})
        c.drawString(margin + 10, y - 32, f"• Modality: {inputs.get('modality', case_meta.get('modality'))}")
        c.drawString(margin + 10, y - 46, f"• Resolution: Standard Medical Scan Input")
        c.drawString(margin + 10, y - 60, f"• Preprocessing: Deep Resampling & Normalization")
        c.drawString(margin + 10, y - 74, f"• Calibration: Artifact Filter & EXIF Compliance")
        c.drawString(margin + 10, y - 88, f"• Channel Structure: RGB 3-Channel Scaled [0, 1]")

        # Thumbnails on the right: Scan image & Grad-CAM overlay
        thumb_size = 90
        tx1 = margin + left_w + 16
        if image_thumb_path and image_thumb_path.exists():
            c.setStrokeColor(colors.HexColor("#cbd5e1"))
            c.setFillColor(colors.black)
            c.rect(tx1, y - img_box_h + 5, thumb_size, thumb_size, fill=1, stroke=1)
            c.drawImage(str(image_thumb_path), tx1, y - img_box_h + 5, width=thumb_size, height=thumb_size, preserveAspectRatio=True)
            c.setFillColor(colors.HexColor("#475569"))
            c.setFont("Helvetica-Bold", 6.5)
            c.drawCentredString(tx1 + thumb_size / 2, y - img_box_h - 4, "ORIGINAL SCAN")

        tx2 = tx1 + thumb_size + 14
        if gradcam_thumb_path and gradcam_thumb_path.exists():
            c.setStrokeColor(colors.HexColor("#cbd5e1"))
            c.setFillColor(colors.black)
            c.rect(tx2, y - img_box_h + 5, thumb_size, thumb_size, fill=1, stroke=1)
            c.drawImage(str(gradcam_thumb_path), tx2, y - img_box_h + 5, width=thumb_size, height=thumb_size, preserveAspectRatio=True)
            c.setFillColor(colors.HexColor("#dc2626"))
            c.setFont("Helvetica-Bold", 6.5)
            c.drawCentredString(tx2 + thumb_size / 2, y - img_box_h - 4, "GRAD-CAM SALIENCY")

        y -= img_box_h + 16

    # 4. Section 2: AI Diagnostic Inference & Risk Stratification
    c.setFillColor(colors.HexColor("#0f3d4c"))
    c.rect(margin, y - 16, w - 2 * margin, 16, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(margin + 8, y - 11, "2. AI MODEL DIAGNOSTIC INFERENCE & POSTERIOR PROBABILITY")
    y -= 22

    sec2_h = 48
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.roundRect(margin, y - sec2_h, w - 2 * margin, sec2_h, 3, fill=1, stroke=1)

    diag_text = pred.get("diagnosis") or pred.get("prediction") or "Evaluation Completed"
    conf_pct = pred.get("confidence_percentage") or pred.get("risk_percentage") or round(prob * 100, 1)

    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin + 12, y - 16, f"DIAGNOSIS: {diag_text}")

    c.setFont("Helvetica", 8)
    c.drawString(margin + 12, y - 32, f"Risk Stratification: {risk_tier}")
    c.drawString(margin + 140, y - 32, f"Calibrated Probability: {prob:.4f} ({conf_pct}%)")
    c.drawString(margin + 330, y - 32, "Decision Cutoff: 0.50 (Binary/Softmax)")

    # If class_probabilities present (multi-class models)
    class_probs = pred.get("class_probabilities", {})
    if class_probs:
        prob_strs = [f"{cls_name.split()[0]}: {p_val*100:.1f}%" for cls_name, p_val in list(class_probs.items())[:5]]
        c.setFont("Helvetica", 7.5)
        c.setFillColor(colors.HexColor("#475569"))
        c.drawString(margin + 12, y - 44, f"Class Posterior Distribution: {' | '.join(prob_strs)}")

    y -= sec2_h + 12

    # 5. Section 3: Explainable AI (XAI) Attribution
    c.setFillColor(colors.HexColor("#0f3d4c"))
    c.rect(margin, y - 16, w - 2 * margin, 16, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(margin + 8, y - 11, "3. EXPLAINABLE AI (XAI) ATTRIBUTION & MECHANISTIC AUDIT")
    y -= 22

    exp = diag_rep.get("explainability", {})
    exp_method = exp.get("method", "Deterministic Biometric Attribution")
    sec3_h = 60
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.roundRect(margin, y - sec3_h, w - 2 * margin, sec3_h, 3, fill=1, stroke=1)

    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin + 10, y - 14, f"EXPLAINABILITY METHOD: {exp_method}")

    # Top drivers
    if "grad-cam" in exp_method.lower():
        layer = exp.get("target_layer", "Final Convolutional Feature Layer")
        tgt = exp.get("target_class", diag_text)
        stats = exp.get("attention_statistics", {})
        c.setFont("Helvetica", 7.5)
        c.setFillColor(colors.HexColor("#334155"))
        c.drawString(margin + 10, y - 28, f"• Target Diagnostic Class: {tgt}")
        c.drawString(margin + 10, y - 40, f"• Convolutional Layer: {layer} | Max Saliency: {stats.get('max_attention', 1.0):.2f}")
        c.drawString(margin + 10, y - 52, f"• Heatmap Grid: {exp.get('heatmap_shape', '[7, 7]')} | Receptive Field Focused on High-Weight Morphological Structures")
    else:
        all_contribs = exp.get("all_contributions", [])
        top_pos = exp.get("top_positive_contributors", [c for c in all_contribs if float(c.get("shap_value", 0)) > 0])
        top_neg = [c for c in all_contribs if float(c.get("shap_value", 0)) < 0]

        pos_str = ", ".join([f"{c.get('feature')} (+{float(c.get('shap_value', 0)):.3f})" for c in top_pos[:3]]) or "None"
        neg_str = ", ".join([f"{c.get('feature')} ({float(c.get('shap_value', 0)):.3f})" for c in top_neg[:3]]) or "None"

        c.setFont("Helvetica", 7.5)
        c.setFillColor(colors.HexColor("#dc2626"))
        c.drawString(margin + 10, y - 28, f"• Primary Risk Drivers (Elevating Probability): {pos_str[:70]}")
        c.setFillColor(colors.HexColor("#16a34a"))
        c.drawString(margin + 10, y - 41, f"• Mitigating / Protective Factors: {neg_str[:70]}")
        c.setFillColor(colors.HexColor("#475569"))
        c.drawString(margin + 10, y - 53, f"• Attribution Model: Additive Shapley values displacing risk from base expected value")

    y -= sec3_h + 12

    # 6. Section 4: Attending Physician Perspective & Actionable Plan
    c.setFillColor(colors.HexColor("#0f3d4c"))
    c.rect(margin, y - 16, w - 2 * margin, 16, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(margin + 8, y - 11, "4. ATTENDING PHYSICIAN PERSPECTIVE & ACTIONABLE RECOMMENDATIONS")
    y -= 22

    # Narrative text
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(margin, y - 4, "CLINICAL EVALUATION SUMMARY (Dr. Sarah Chen, MD):")
    y -= 15

    summary_text = llm_rep.get("screening_summary") or diag_rep.get("screening", {}).get("prediction", "")
    c.setFont("Helvetica", 7.2)
    c.setFillColor(colors.HexColor("#334155"))
    # Wrap summary text nicely
    words = summary_text.split()
    line = ""
    for word in words:
        if c.stringWidth(line + " " + word, "Helvetica", 7.2) < (w - 2 * margin):
            line = (line + " " + word).strip()
        else:
            c.drawString(margin, y, line)
            y -= 10
            line = word
            if y < 140:
                break
    if line and y >= 140:
        c.drawString(margin, y, line)
        y -= 12

    # Recommendations
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(colors.HexColor("#0f172a"))
    c.drawString(margin, y - 2, "ACTIONABLE CLINICAL RECOMMENDATIONS & SURVEILLANCE PROTOCOL:")
    y -= 13

    recs = llm_rep.get("recommendations", []) or pred.get("recommendations", [])
    c.setFont("Helvetica", 7.2)
    c.setFillColor(colors.HexColor("#1e293b"))
    for rec in recs[:4]:
        rec_line = f"• {rec}"
        if c.stringWidth(rec_line, "Helvetica", 7.2) > (w - 2 * margin):
            rec_line = rec_line[:100] + "..."
        c.drawString(margin, y, rec_line)
        y -= 10
        if y < 65:
            break

    # 7. Page Footer
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.line(margin, 46, w - margin, 46)

    c.setFillColor(colors.HexColor("#64748b"))
    c.setFont("Helvetica", 6.8)
    c.drawString(margin, 34, "MEDSYNAPSE AI BENCHMARK EVALUATION DATASET • NOT A STANDALONE DIAGNOSIS • REQUIRES PHYSICIAN REVIEW")
    c.drawRightString(w - margin, 34, "PAGE 1 OF 1 • VERIFIED CLINICAL AUDIT")

    c.save()


# ---------------------------------------------------------------------------
# Text Report Formatter
# ---------------------------------------------------------------------------

def generate_clinical_report_text(
    case_meta: dict[str, Any],
    pred: dict[str, Any],
    diag_rep: dict[str, Any],
    llm_rep: dict[str, Any]
) -> str:
    lines = [
        "================================================================================",
        "MEDSYNAPSE CLINICAL DECISION SUPPORT PLATFORM - DIAGNOSTIC REPORT",
        "================================================================================",
        f"Case Identification : {case_meta['case_id']}",
        f"Clinical Module     : {case_meta.get('disease_name', 'Clinical Disease')}",
        f"Diagnostic Modality : {case_meta.get('modality', 'Standard Clinical Panel')}",
        f"Scenario Description: {case_meta.get('title', '')}",
        f"Attending Clinician : Dr. Sarah Chen, MD (Senior Attending Physician)",
        f"Report Timestamp    : {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f"System Purpose      : AI Platform Benchmark & Evaluation Dataset",
        "--------------------------------------------------------------------------------",
        "1. CLINICAL INPUT PARAMETERS & OBSERVATIONS",
        "--------------------------------------------------------------------------------",
    ]

    if not case_meta.get("is_image", False):
        inputs = case_meta.get("inputs", {})
        feature_units = case_meta.get("feature_units", {})
        for fname, fval in inputs.items():
            disp_name, unit, ref = feature_units.get(fname, (fname.replace("_", " ").title(), "", "Standard reference"))
            val_str = f"{fval} {unit}".strip()
            lines.append(f"  * {disp_name:<36}: {val_str:<18} [{ref}]")
    else:
        inputs = case_meta.get("inputs", {})
        for k, v in inputs.items():
            lines.append(f"  * {k.title():<36}: {v}")
        if "source_image" in case_meta:
            lines.append(f"  * Source Image Fixture              : {Path(case_meta['source_image']).name}")

    prob = float(pred.get("risk_probability", 0.0) or 0.0)
    conf_pct = pred.get("confidence_percentage") or pred.get("risk_percentage") or round(prob * 100, 1)

    lines.extend([
        "",
        "--------------------------------------------------------------------------------",
        "2. AI MODEL DIAGNOSTIC INFERENCE & RISK ASSESSMENT",
        "--------------------------------------------------------------------------------",
        f"  * Primary Diagnostic Finding : {pred.get('diagnosis') or pred.get('prediction')}",
        f"  * Assessed Risk Tier         : {pred.get('risk_tier', 'Evaluated')}",
        f"  * Calibrated Probability     : {prob:.4f} ({conf_pct}%)",
        f"  * Decision Boundary Cutoff   : 0.50 (Standard Decision Cutoff)",
        f"  * Ground-Truth Scenario Fit  : {case_meta.get('scenario')}",
    ])

    class_probs = pred.get("class_probabilities", {})
    if class_probs:
        lines.append("  * Posterior Probability Distribution:")
        for cls_name, p_val in class_probs.items():
            lines.append(f"      - {cls_name:<32}: {p_val*100:5.2f}%")

    exp = diag_rep.get("explainability", {})
    exp_method = exp.get("method", "Deterministic Attribution")
    lines.extend([
        "",
        "--------------------------------------------------------------------------------",
        "3. EXPLAINABLE AI (XAI) ATTRIBUTION",
        "--------------------------------------------------------------------------------",
        f"  * Explainability Architecture: {exp_method}",
    ])

    if "grad-cam" in exp_method.lower():
        stats = exp.get("attention_statistics", {})
        lines.extend([
            f"  * Saliency Target Class      : {exp.get('target_class', pred.get('diagnosis'))}",
            f"  * Backpropagated Layer       : {exp.get('target_layer', 'Final Convolutional Layer')}",
            f"  * Peak Attention Intensity   : {stats.get('max_attention', 1.0):.4f}",
            f"  * Heatmap Resolution Shape   : {exp.get('heatmap_shape', '[7, 7]')}",
        ])
    else:
        all_c = exp.get("all_contributions", [])
        top_pos = exp.get("top_positive_contributors", [c for c in all_c if float(c.get("shap_value", 0)) > 0])
        top_neg = [c for c in all_c if float(c.get("shap_value", 0)) < 0]
        lines.append("  * Primary Risk-Increasing Drivers (Positive SHAP φ):")
        for c in top_pos[:4]:
            lines.append(f"      - {c.get('feature'):<30}: φ = +{float(c.get('shap_value', 0)):.4f} (patient value: {c.get('patient_value')})")
        lines.append("  * Protective / Mitigating Factors (Negative SHAP φ):")
        for c in top_neg[:4]:
            lines.append(f"      - {c.get('feature'):<30}: φ = {float(c.get('shap_value', 0)):.4f} (patient value: {c.get('patient_value')})")

    lines.extend([
        "",
        "--------------------------------------------------------------------------------",
        "4. ATTENDING PHYSICIAN PERSPECTIVE & ACTIONABLE RECOMMENDATIONS",
        "--------------------------------------------------------------------------------",
        f"Screening Summary:",
        f"  {llm_rep.get('screening_summary', '')}",
        "",
        f"Physician Perspective Analysis:",
        f"  {llm_rep.get('physician_perspective_analysis', '')}",
        "",
        "Actionable Recommendations:",
    ])
    for idx, rec in enumerate(llm_rep.get("recommendations", []) or pred.get("recommendations", []), 1):
        lines.append(f"  {idx}. {rec}")

    lines.extend([
        "",
        "================================================================================",
        "SAFETY & COMPLIANCE NOTICE: This diagnostic evaluation report is generated for",
        "benchmarking and clinician decision support. It is not an autonomous medical",
        "diagnosis. All therapeutic strategies require licensed clinician confirmation.",
        "================================================================================",
        ""
    ])
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main Orchestration Loop
# ---------------------------------------------------------------------------

def run_evaluation_generator() -> None:
    print("=" * 80)
    print("MEDSYNAPSE CLINICAL BENCHMARK & EVALUATION DATASET GENERATOR")
    print(f"Target Directory: {DATASET_DIR}")
    print("=" * 80)

    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    model_service = ModelService.get_instance()
    report_service = ClinicalReportService(model_service, ROOT)

    total_cases = sum(len(mod["cases"]) for mod in DISEASE_MODULE_SPECS)
    print(f"Loaded {len(DISEASE_MODULE_SPECS)} clinical disease modules containing {total_cases} total evaluation cases.")
    print("-" * 80)

    summary_matrix = []
    processed_count = 0

    for mod_idx, mod in enumerate(DISEASE_MODULE_SPECS, 1):
        mod_dir = DATASET_DIR / mod["module_id"]
        mod_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n[{mod_idx}/9] PROCESSING MODULE: {mod['disease_name']} ({mod['module_id']})")
        print("-" * 60)

        for case in mod["cases"]:
            processed_count += 1
            case_folder = mod_dir / case["folder_name"]
            case_folder.mkdir(parents=True, exist_ok=True)

            print(f"  ({processed_count}/{total_cases}) Generating Case '{case['folder_name']}' [{case['case_id']}]...")

            img_bytes = None
            source_img_dest = None
            gradcam_dest = None

            # 1. Prepare image if vision case
            if mod["is_image"]:
                src_path = ROOT / case["source_image"]
                assert src_path.exists(), f"Source image missing: {src_path}"
                img_bytes = src_path.read_bytes()
                # Copy original source image into case directory
                ext = src_path.suffix
                source_img_dest = case_folder / f"source_image{ext}"
                shutil.copyfile(src_path, source_img_dest)

            # 2. Run Model Inference
            is_incomplete = case.get("is_incomplete", False)
            if is_incomplete:
                # Deliberate incomplete case (Breast FNA 10 of 30 features)
                pred = {
                    "disease": mod["disease_name"],
                    "prediction": "Incomplete Profile",
                    "diagnosis": "Review Required (Incomplete Feature Set)",
                    "has_disease": False,
                    "is_positive": False,
                    "risk_probability": 0.50,
                    "risk_percentage": 50.0,
                    "confidence_percentage": 50.0,
                    "risk_tier": "Review Required",
                    "validation_status": "incomplete_feature_contract",
                    "recommendations": [
                        "Incomplete morphometric panel: 10 of 30 WDBC features supplied.",
                        "Clinician review and completion of remaining 20 features required.",
                        "Do not infer missing features automatically."
                    ]
                }
            else:
                if mod["disease_key"] == "diabetes":
                    pred = model_service.predict_diabetes(case["inputs"])
                elif mod["disease_key"] == "heart":
                    pred = model_service.predict_heart(case["inputs"])
                elif mod["disease_key"] == "pneumonia":
                    pred = model_service.predict_xray(img_bytes)
                elif mod["disease_key"] in ("brain_tumor", "brain-tumor", "brain"):
                    pred = model_service.predict_brain_tumor(img_bytes)
                elif mod["disease_key"] == "breast":
                    pred = model_service.predict_breast_cancer(case["inputs"])
                elif mod["disease_key"] in ("kidney_stone", "kidney-stone", "kidney"):
                    pred = model_service.predict_kidney_stone(img_bytes)
                elif mod["disease_key"] in ("skin_cancer", "skin-cancer", "skin"):
                    pred = model_service.predict_skin_cancer(img_bytes)
                elif mod["disease_key"] == "liver":
                    pred = model_service.predict_liver(case["inputs"])
                elif mod["disease_key"] == "eye":
                    pred = model_service.predict_eye(img_bytes)
                else:
                    raise ValueError(f"Unknown disease: {mod['disease_key']}")

            # 3. Build Full Diagnostic Package & Explainability
            if is_incomplete:
                diag_rep = {
                    "report_id": f"eval-{case['case_id'].lower()}",
                    "screening": pred,
                    "explainability": {
                        "status": "deferred",
                        "method": "Deferred (Feature set incomplete)",
                        "all_contributions": [],
                        "top_positive_contributors": []
                    }
                }
            else:
                diag_rep = report_service.build_report(
                    disease_key=mod["disease_key"],
                    prediction=pred,
                    inputs=case.get("inputs", {}),
                    image_bytes=img_bytes
                )

            # Extract and save Grad-CAM overlay if present
            overlay_url = diag_rep.get("explainability", {}).get("overlay_data_url")
            if overlay_url and "," in overlay_url:
                try:
                    b64_str = overlay_url.split(",", 1)[1]
                    overlay_bytes = base64.b64decode(b64_str)
                    gradcam_dest = case_folder / "gradcam_overlay.png"
                    gradcam_dest.write_bytes(overlay_bytes)
                except Exception as exc:
                    print(f"    [Warning] Failed to save gradcam overlay: {exc}")

            # 4. Synthesize Clinical LLM Narrative
            if is_incomplete:
                llm_rep = {
                    "title": case["title"],
                    "screening_summary": f"Incomplete WDBC FNA feature submission for {case['case_id']}. Only 10 of 30 standard morphological attributes provided. Automated diagnosis suspended per patient safety protocol.",
                    "model_findings": "Feature vector incomplete. Inference deferred to protect patient safety.",
                    "explainability_summary": "Explainability computation deferred due to missing biometric parameters.",
                    "clinician_review": "Attending physician must review cytology slide and enter missing nuclear dimensions.",
                    "physician_perspective_analysis": "CLINICAL EVALUATION FROM ATTENDING PHYSICIAN'S POINT OF VIEW (Dr. Sarah Chen, MD):\nIncomplete morphometric profiles cannot be interpolated. Clinician completion required.",
                    "recommendations": pred["recommendations"]
                }
            else:
                llm_rep = report_service.synthesize_report_direct(
                    disease_key=mod["disease_key"],
                    prediction=pred,
                    inputs=case.get("inputs", {}),
                    clinical_report=diag_rep,
                    tweaked_decisions={
                        "hasTweaks": False,
                        "doctorInfo": {"name": "Dr. Sarah Chen, MD", "title": "Senior Attending Physician"}
                    }
                )

            # 5. Save TXT Report
            txt_content = generate_clinical_report_text(case, pred, diag_rep, llm_rep)
            txt_path = case_folder / "report.txt"
            txt_path.write_text(txt_content, encoding="utf-8")

            # 6. Save PDF Report
            pdf_path = case_folder / "report.pdf"
            draw_clinical_report_pdf(
                pdf_path=pdf_path,
                case_meta=case,
                pred=pred,
                diag_rep=diag_rep,
                llm_rep=llm_rep,
                image_thumb_path=source_img_dest,
                gradcam_thumb_path=gradcam_dest
            )

            # 7. Render PNG from PDF (High-Res 150 DPI)
            png_path = case_folder / "report.png"
            try:
                doc = pymupdf.open(pdf_path)
                pix = doc[0].get_pixmap(dpi=150)
                pix.save(png_path)
                doc.close()
            except Exception as exc:
                print(f"    [Warning] PyMuPDF PNG render error: {exc}")

            # 8. Save Structured JSON Evaluation Record
            eval_record = {
                "benchmark_metadata": {
                    "case_id": case["case_id"],
                    "module_id": mod["module_id"],
                    "disease_name": mod["disease_name"],
                    "disease_key": mod["disease_key"],
                    "modality": mod["modality"],
                    "is_image_based": mod["is_image"],
                    "scenario": case.get("scenario"),
                    "source_reference": case.get("source_ref") or case.get("source_image"),
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "evaluator": "MedSynapse Clinical AI Evaluation Pipeline"
                },
                "inputs": case.get("inputs", {}),
                "model_prediction": pred,
                "explainability": {
                    "method": diag_rep.get("explainability", {}).get("method"),
                    "status": diag_rep.get("explainability", {}).get("status", "available"),
                    "top_positive_contributors": diag_rep.get("explainability", {}).get("top_positive_contributors", []),
                    "attention_statistics": diag_rep.get("explainability", {}).get("attention_statistics"),
                    "target_class": diag_rep.get("explainability", {}).get("target_class"),
                    "has_gradcam_overlay": bool(gradcam_dest and gradcam_dest.exists())
                },
                "clinical_synthesis": {
                    "title": llm_rep.get("title"),
                    "screening_summary": llm_rep.get("screening_summary"),
                    "model_findings": llm_rep.get("model_findings"),
                    "explainability_summary": llm_rep.get("explainability_summary"),
                    "clinician_review": llm_rep.get("clinician_review"),
                    "physician_perspective_analysis": llm_rep.get("physician_perspective_analysis"),
                    "recommendations": llm_rep.get("recommendations", [])
                },
                "files": {
                    "report_pdf": "report.pdf",
                    "report_png": "report.png",
                    "report_txt": "report.txt",
                    "source_image": source_img_dest.name if source_img_dest else None,
                    "gradcam_overlay": gradcam_dest.name if gradcam_dest else None
                }
            }

            json_path = case_folder / "report_evaluation.json"
            json_path.write_text(json.dumps(eval_record, indent=2), encoding="utf-8")

            # 9. Register in Summary Matrix
            summary_matrix.append({
                "case_id": case["case_id"],
                "module": mod["disease_name"],
                "module_id": mod["module_id"],
                "folder": f"{mod['module_id']}/{case['folder_name']}",
                "modality": mod["modality"],
                "diagnosis": pred.get("diagnosis") or pred.get("prediction"),
                "risk_tier": pred.get("risk_tier", "Low Risk"),
                "risk_probability": pred.get("risk_probability", 0.0),
                "confidence_percentage": pred.get("confidence_percentage") or pred.get("risk_percentage"),
                "xai_method": diag_rep.get("explainability", {}).get("method", "N/A"),
                "has_gradcam": bool(gradcam_dest and gradcam_dest.exists())
            })

            print(f"    ✓ Generated: PDF, PNG, TXT, JSON (Diagnosis: {pred.get('diagnosis') or pred.get('prediction')} | {pred.get('risk_tier')})")

    # 10. Generate Summary Evaluation Matrix JSON
    matrix_path = DATASET_DIR / "summary_evaluation_matrix.json"
    matrix_path.write_text(json.dumps({
        "dataset_name": "MedSynapse Comprehensive Clinical Evaluation Dataset",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_modules": len(DISEASE_MODULE_SPECS),
        "total_cases": len(summary_matrix),
        "cases": summary_matrix
    }, indent=2), encoding="utf-8")
    print(f"\n✓ Generated Global Summary Matrix: {matrix_path}")

    # 11. Generate Markdown Evaluation Dossier
    generate_markdown_dossier(DATASET_DIR, summary_matrix)

    # 12. Generate README in dataset folder
    generate_dataset_readme(DATASET_DIR, summary_matrix)

    # 13. Ensure datasets/evaluation_dataset symlink or copy
    symlink_dir = ROOT / "datasets" / "evaluation_dataset"
    try:
        if symlink_dir.is_symlink() or symlink_dir.exists():
            if symlink_dir.is_symlink():
                symlink_dir.unlink()
            elif symlink_dir.is_dir():
                shutil.rmtree(symlink_dir)
        symlink_dir.symlink_to(DATASET_DIR.resolve())
        print(f"✓ Linked {symlink_dir} -> {DATASET_DIR}")
    except Exception as exc:
        print(f"  Note: Symlink skipped ({exc}); primary dataset is {DATASET_DIR}")

    print("\n" + "=" * 80)
    print(f"🎉 COMPLETED: Successfully generated {len(summary_matrix)} reports across all 9 disease modules!")
    print(f"Saved into folder: {DATASET_DIR}")
    print("=" * 80)


def generate_markdown_dossier(dataset_dir: Path, matrix: list[dict[str, Any]]) -> None:
    lines = [
        "# 🩺 MedSynapse Clinical Evaluation Benchmark Dossier",
        "",
        f"**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}  ",
        f"**Total Diseases Evaluated:** 9 Modules  ",
        f"**Total Standardized Cases:** {len(matrix)} Cases  ",
        f"**Target Directory:** `dataset/`",
        "",
        "---",
        "",
        "## 📊 Evaluation Summary Matrix Across All 9 Disease Modules",
        "",
        "| Case ID | Disease Module | Clinical Modality | Model Diagnosis / Finding | Risk Tier | Probability | XAI Method |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ]

    for item in matrix:
        prob_str = f"{item['risk_probability']:.4f} ({item['confidence_percentage']}%)"
        xai_str = item['xai_method']
        if item.get("has_gradcam"):
            xai_str += " (Overlay ✓)"
        lines.append(f"| **`{item['case_id']}`** | {item['module']} | {item['modality'][:30]} | `{item['diagnosis']}` | **{item['risk_tier']}** | {prob_str} | {xai_str} |")

    lines.extend([
        "",
        "---",
        "",
        "## 🔬 Evaluation Methodology & Benchmark Utility",
        "",
        "### 1️⃣ Document Extraction & OCR Pipeline Evaluation",
        "- **PDF & PNG Inputs**: Each case contains `report.pdf` and high-resolution `report.png` rendered from the clinical document.",
        "- **Evaluation Use**: Ingest either `report.pdf` or `report.png` into the MedSynapse Smart OCR parser (`/api/ocr/parse-report`) to verify parameter extraction accuracy against the reference `report.txt`.",
        "",
        "### 2️⃣ Machine Learning Inference & Decision Calibration",
        "- **Ground-Truth Calibration**: All cases utilize the pre-existing sample features and images from the MedSynapse repository with zero parameter drift.",
        "- **Decision Boundary Audit**: Verifies that threshold cutoffs (0.50) correctly partition acute high-risk cases versus healthy normal reference controls.",
        "",
        "### 3️⃣ Explainable AI (XAI) Attribution Auditing",
        "- **Tabular Models (M1, M2, M5, M8)**: Evaluates SHAP feature displacement ($\phi$) to confirm primary risk drivers (e.g. Fasting Glucose in Diabetes, Direct Bilirubin in Liver Disease).",
        "- **Vision Models (M3, M4, M6, M7, M9)**: Evaluates Grad-CAM convolutional saliency maps and visual overlay heatmaps to confirm receptive field focus on key anatomical lesions.",
        "",
        "### 4️⃣ LLM & Clinician Decision Support Synthesis",
        "- Each case contains structured clinical narrative synthesis signed by **Dr. Sarah Chen, MD (Senior Attending Physician)**, validating screening summaries, physician perspective analysis, and actionable follow-up guidelines.",
        ""
    ])

    (dataset_dir / "summary_evaluation_report.md").write_text("\n".join(lines), encoding="utf-8")


def generate_dataset_readme(dataset_dir: Path, matrix: list[dict[str, Any]]) -> None:
    readme_content = f"""# 📁 MedSynapse Comprehensive Clinical Evaluation Dataset

This dataset directory contains standardized clinical evaluation reports and diagnostic packages for all 9 clinical disease modules supported by MedSynapse.

All reports were generated using the **exact, predefined sampled reports, clinical test images, and biometric data points** already established in the MedSynapse codebase without modification.

---

## 📂 Directory Organization

```
dataset/
├── README.md                          <- This documentation file
├── summary_evaluation_matrix.json     <- Global machine-readable benchmark index
├── summary_evaluation_report.md       <- Full clinical evaluation matrix & findings
├── 01_diabetes_mellitus/              <- Module 1: Glycemic panels (5 cases)
├── 02_coronary_heart_disease/         <- Module 2: Cardiac CAD panels (3 cases)
├── 03_pneumonia_chest_xray/           <- Module 3: Chest radiography (3 cases)
├── 04_brain_tumor_mri/                <- Module 4: Cranial MRI scans (4 cases)
├── 05_breast_cancer_fna/              <- Module 5: WDBC FNA morphometry (5 cases)
├── 06_kidney_pathology_ct/            <- Module 6: Abdominal CT scans (4 cases)
├── 07_skin_cancer_dermoscopy/         <- Module 7: Dermoscopic imaging (7 cases)
├── 08_liver_disease_ilpd/             <- Module 8: Hepatic panels (5 cases)
└── 09_eye_disease_fundus/             <- Module 9: Retinal fundus photography (7 cases)
```

---

## 📄 Case Directory Structure

For each evaluated case, the following synchronized multi-format artifacts are provided:

| File Name | Format | Purpose |
| :--- | :--- | :--- |
| **`report.pdf`** | PDF Document | Official clinical diagnostic report with hospital header, biometric tables, model decision, XAI, and attending physician signature. |
| **`report.png`** | PNG Image (150 DPI) | High-resolution rasterized scan of `report.pdf`, ideal for Smart Report OCR evaluation. |
| **`report.txt`** | Plain Text | Standardized clinical transcript for text ingestion, regex matching, and ground-truth OCR scoring. |
| **`report_evaluation.json`** | JSON Data | Comprehensive machine-readable evaluation record containing raw inputs, predictions, class probabilities, SHAP/Grad-CAM metrics, and narrative text. |
| **`source_image.*`** | JPEG/PNG *(Vision only)* | Exact unmodified diagnostic medical image fixture. |
| **`gradcam_overlay.png`** | PNG *(Vision only)* | Generated Grad-CAM convolutional saliency overlay heatmap. |

---

## 🧪 System Evaluation Protocol

1. **OCR Evaluation**: Upload any `report.pdf` or `report.png` into the Smart Report OCR interface to verify that clinical parameters match `inputs` in `report_evaluation.json`.
2. **Inference Benchmarking**: Run `/api/predict/*` against the parameters in `inputs` to verify deterministic score reproduction.
3. **XAI Verification**: Confirm that SHAP feature rankings and Grad-CAM receptive fields align with documented pathological foci.
4. **Clinical Safety Review**: Verify that safety disclaimers, clinician override hooks, and follow-up surveillance intervals meet clinical compliance.
"""
    (dataset_dir / "README.md").write_text(readme_content, encoding="utf-8")


if __name__ == "__main__":
    run_evaluation_generator()
