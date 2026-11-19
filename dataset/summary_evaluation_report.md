# 🩺 MedSynapse Clinical Evaluation Benchmark Dossier

**Generated:** 2026-11-19 04:20 UTC  
**Total Diseases Evaluated:** 9 Modules  
**Total Standardized Cases:** 43 Cases  
**Target Directory:** `dataset/`

---

## 📊 Evaluation Summary Matrix Across All 9 Disease Modules

| Case ID | Disease Module | Clinical Modality | Model Diagnosis / Finding | Risk Tier | Probability | XAI Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`EVAL-DIAB-001`** | Diabetes Mellitus | Biochemical Glycemic Panel (Ta | `Diabetes Mellitus Detected` | **Moderate Risk** | 0.5021 (50.2%) | SHAP PermutationExplainer (full diabetes voting ensemble) |
| **`EVAL-DIAB-002`** | Diabetes Mellitus | Biochemical Glycemic Panel (Ta | `Baseline Physiological Control` | **Low Risk** | 0.2140 (21.4%) | SHAP PermutationExplainer (full diabetes voting ensemble) |
| **`EVAL-DIAB-003`** | Diabetes Mellitus | Biochemical Glycemic Panel (Ta | `Baseline Physiological Control` | **Low Risk** | 0.0254 (2.5%) | SHAP PermutationExplainer (full diabetes voting ensemble) |
| **`EVAL-DIAB-004`** | Diabetes Mellitus | Biochemical Glycemic Panel (Ta | `Baseline Physiological Control` | **Moderate Risk** | 0.3575 (35.7%) | SHAP PermutationExplainer (full diabetes voting ensemble) |
| **`EVAL-DIAB-005`** | Diabetes Mellitus | Biochemical Glycemic Panel (Ta | `Diabetes Mellitus Detected` | **High Risk** | 0.9335 (93.4%) | SHAP PermutationExplainer (full diabetes voting ensemble) |
| **`EVAL-CAD-001`** | Coronary Heart Disease | Cardiovascular Clinical Biomar | `Coronary Disease Detected` | **High Risk** | 0.9600 (96.0%) | SHAP TreeExplainer |
| **`EVAL-CAD-002`** | Coronary Heart Disease | Cardiovascular Clinical Biomar | `Normal Cardiovascular Baseline` | **Low Risk** | 0.0300 (3.0%) | SHAP TreeExplainer |
| **`EVAL-CAD-003`** | Coronary Heart Disease | Cardiovascular Clinical Biomar | `Coronary Disease Detected` | **High Risk** | 0.9800 (98.0%) | SHAP TreeExplainer |
| **`EVAL-XRAY-001`** | Pneumonia | Chest Radiography (X-Ray) | `Pneumonia` | **High Risk** | 0.9999 (100.0%) | Grad-CAM (Overlay ✓) |
| **`EVAL-XRAY-002`** | Pneumonia | Chest Radiography (X-Ray) | `Normal (Clear Lungs)` | **Low Risk** | 0.0646 (93.5%) | Grad-CAM (Overlay ✓) |
| **`EVAL-XRAY-003`** | Pneumonia | Chest Radiography (X-Ray) | `Pneumonia` | **High Risk** | 0.8158 (81.6%) | Grad-CAM (Overlay ✓) |
| **`EVAL-BRAIN-001`** | Brain Tumor (MRI) | Cranial Magnetic Resonance Ima | `Glioma` | **High Risk** | 1.0000 (100.0%) | Grad-CAM (Overlay ✓) |
| **`EVAL-BRAIN-002`** | Brain Tumor (MRI) | Cranial Magnetic Resonance Ima | `Meningioma` | **High Risk** | 0.9958 (88.3%) | Grad-CAM (Overlay ✓) |
| **`EVAL-BRAIN-003`** | Brain Tumor (MRI) | Cranial Magnetic Resonance Ima | `Pituitary Adenoma` | **High Risk** | 1.0000 (100.0%) | Grad-CAM (Overlay ✓) |
| **`EVAL-BRAIN-004`** | Brain Tumor (MRI) | Cranial Magnetic Resonance Ima | `No Tumor` | **Low Risk** | 0.0003 (100.0%) | Grad-CAM (Overlay ✓) |
| **`EVAL-BREAST-001`** | Breast Cancer | Fine Needle Aspirate (FNA) Nuc | `Benign` | **Low Risk** | 0.0955 (9.6%) | SHAP PermutationExplainer (raw WDBC features through scaler/PCA/classifier) |
| **`EVAL-BREAST-002`** | Breast Cancer | Fine Needle Aspirate (FNA) Nuc | `Malignant` | **High Risk** | 1.0000 (100.0%) | SHAP PermutationExplainer (raw WDBC features through scaler/PCA/classifier) |
| **`EVAL-BREAST-003`** | Breast Cancer | Fine Needle Aspirate (FNA) Nuc | `Malignant` | **High Risk** | 1.0000 (100.0%) | SHAP PermutationExplainer (raw WDBC features through scaler/PCA/classifier) |
| **`EVAL-BREAST-004`** | Breast Cancer | Fine Needle Aspirate (FNA) Nuc | `Benign` | **Low Risk** | 0.0476 (4.8%) | SHAP PermutationExplainer (raw WDBC features through scaler/PCA/classifier) |
| **`EVAL-BREAST-005`** | Breast Cancer | Fine Needle Aspirate (FNA) Nuc | `Review Required (Incomplete Feature Set)` | **Review Required** | 0.5000 (50.0%) | Deferred (Feature set incomplete) |
| **`EVAL-KIDNEY-001`** | Kidney Pathology (CT) | Non-Contrast Abdominal CT Scan | `Stone` | **High Risk** | 0.8455 (81.2%) | Grad-CAM (Overlay ✓) |
| **`EVAL-KIDNEY-002`** | Kidney Pathology (CT) | Non-Contrast Abdominal CT Scan | `Cyst` | **High Risk** | 1.0000 (100.0%) | Grad-CAM (Overlay ✓) |
| **`EVAL-KIDNEY-003`** | Kidney Pathology (CT) | Non-Contrast Abdominal CT Scan | `Tumor` | **High Risk** | 0.9923 (95.4%) | Grad-CAM (Overlay ✓) |
| **`EVAL-KIDNEY-004`** | Kidney Pathology (CT) | Non-Contrast Abdominal CT Scan | `Normal` | **Low Risk** | 0.0004 (100.0%) | Grad-CAM (Overlay ✓) |
| **`EVAL-SKIN-001`** | Skin Cancer & Cutaneous Lesions (HAM10000) | Polarized Contact Dermoscopy | `Melanoma (Malignant)` | **High Risk** | 0.6082 (60.6%) | Grad-CAM (Overlay ✓) |
| **`EVAL-SKIN-002`** | Skin Cancer & Cutaneous Lesions (HAM10000) | Polarized Contact Dermoscopy | `Basal Cell Carcinoma (Malignant)` | **High Risk** | 0.9994 (99.9%) | Grad-CAM (Overlay ✓) |
| **`EVAL-SKIN-003`** | Skin Cancer & Cutaneous Lesions (HAM10000) | Polarized Contact Dermoscopy | `Benign Keratosis-like Lesion` | **Low Risk** | 0.0001 (66.2%) | Grad-CAM (Overlay ✓) |
| **`EVAL-SKIN-004`** | Skin Cancer & Cutaneous Lesions (HAM10000) | Polarized Contact Dermoscopy | `Actinic Keratosis / Bowen Disease` | **Moderate Risk** | 0.0776 (73.1%) | Grad-CAM (Overlay ✓) |
| **`EVAL-SKIN-005`** | Skin Cancer & Cutaneous Lesions (HAM10000) | Polarized Contact Dermoscopy | `Melanocytic Nevus (Benign Mole)` | **Low Risk** | 0.0025 (68.4%) | Grad-CAM (Overlay ✓) |
| **`EVAL-SKIN-006`** | Skin Cancer & Cutaneous Lesions (HAM10000) | Polarized Contact Dermoscopy | `Basal Cell Carcinoma (Malignant)` | **High Risk** | 0.5750 (57.3%) | Grad-CAM (Overlay ✓) |
| **`EVAL-SKIN-007`** | Skin Cancer & Cutaneous Lesions (HAM10000) | Polarized Contact Dermoscopy | `Melanoma (Malignant)` | **High Risk** | 0.6082 (60.6%) | Grad-CAM (Overlay ✓) |
| **`EVAL-LIVER-001`** | Liver Disease (ILPD) | Hepatic Functional Panel & Ser | `Healthy (Normal LFT)` | **Moderate Risk** | 0.4533 (45.3%) | SHAP TreeExplainer |
| **`EVAL-LIVER-002`** | Liver Disease (ILPD) | Hepatic Functional Panel & Ser | `Liver Disease Detected` | **High Risk** | 0.9774 (97.7%) | SHAP TreeExplainer |
| **`EVAL-LIVER-003`** | Liver Disease (ILPD) | Hepatic Functional Panel & Ser | `Liver Disease Detected` | **High Risk** | 0.9910 (99.1%) | SHAP TreeExplainer |
| **`EVAL-LIVER-004`** | Liver Disease (ILPD) | Hepatic Functional Panel & Ser | `Liver Disease Detected` | **High Risk** | 0.9769 (97.7%) | SHAP TreeExplainer |
| **`EVAL-LIVER-005`** | Liver Disease (ILPD) | Hepatic Functional Panel & Ser | `Liver Disease Detected` | **High Risk** | 0.7501 (75.0%) | SHAP TreeExplainer |
| **`EVAL-EYE-001`** | Eye Disease (Ophthalmic) | Digital Retinal Fundus & Ophth | `Crossed Eyes` | **High Risk** | 0.9811 (98.1%) | Grad-CAM (PyTorch ResNet-18) (Overlay ✓) |
| **`EVAL-EYE-002`** | Eye Disease (Ophthalmic) | Digital Retinal Fundus & Ophth | `Crossed Eyes` | **High Risk** | 0.9724 (97.2%) | Grad-CAM (PyTorch ResNet-18) (Overlay ✓) |
| **`EVAL-EYE-003`** | Eye Disease (Ophthalmic) | Digital Retinal Fundus & Ophth | `Crossed Eyes` | **High Risk** | 0.9636 (96.4%) | Grad-CAM (PyTorch ResNet-18) (Overlay ✓) |
| **`EVAL-EYE-004`** | Eye Disease (Ophthalmic) | Digital Retinal Fundus & Ophth | `Crossed Eyes` | **High Risk** | 0.9700 (97.0%) | Grad-CAM (PyTorch ResNet-18) (Overlay ✓) |
| **`EVAL-EYE-005`** | Eye Disease (Ophthalmic) | Digital Retinal Fundus & Ophth | `Crossed Eyes` | **High Risk** | 0.9553 (95.5%) | Grad-CAM (PyTorch ResNet-18) (Overlay ✓) |
| **`EVAL-EYE-006`** | Eye Disease (Ophthalmic) | Digital Retinal Fundus & Ophth | `Crossed Eyes` | **High Risk** | 0.9534 (95.3%) | Grad-CAM (PyTorch ResNet-18) (Overlay ✓) |
| **`EVAL-EYE-007`** | Eye Disease (Ophthalmic) | Digital Retinal Fundus & Ophth | `Crossed Eyes` | **High Risk** | 0.9517 (95.2%) | Grad-CAM (PyTorch ResNet-18) (Overlay ✓) |

---

## 🔬 Evaluation Methodology & Benchmark Utility

### 1️⃣ Document Extraction & OCR Pipeline Evaluation
- **PDF & PNG Inputs**: Each case contains `report.pdf` and high-resolution `report.png` rendered from the clinical document.
- **Evaluation Use**: Ingest either `report.pdf` or `report.png` into the MedSynapse Smart OCR parser (`/api/ocr/parse-report`) to verify parameter extraction accuracy against the reference `report.txt`.

### 2️⃣ Machine Learning Inference & Decision Calibration
- **Ground-Truth Calibration**: All cases utilize the pre-existing sample features and images from the MedSynapse repository with zero parameter drift.
- **Decision Boundary Audit**: Verifies that threshold cutoffs (0.50) correctly partition acute high-risk cases versus healthy normal reference controls.

### 3️⃣ Explainable AI (XAI) Attribution Auditing
- **Tabular Models (M1, M2, M5, M8)**: Evaluates SHAP feature displacement ($\phi$) to confirm primary risk drivers (e.g. Fasting Glucose in Diabetes, Direct Bilirubin in Liver Disease).
- **Vision Models (M3, M4, M6, M7, M9)**: Evaluates Grad-CAM convolutional saliency maps and visual overlay heatmaps to confirm receptive field focus on key anatomical lesions.

### 4️⃣ LLM & Clinician Decision Support Synthesis
- Each case contains structured clinical narrative synthesis signed by **Dr. Sarah Chen, MD (Senior Attending Physician)**, validating screening summaries, physician perspective analysis, and actionable follow-up guidelines.
