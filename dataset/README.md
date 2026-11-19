# 📁 MedSynapse Comprehensive Clinical Evaluation Dataset

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
