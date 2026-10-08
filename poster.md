# MedSynapse Poster Design Brief

This file contains all content and constraints required to generate a research
poster for the MedSynapse project. Attach this file, both WhatsApp reference
images, and `Untitled-2026-09-28-1748(1).excalidraw` when asking ChatGPT to
design the poster.

## 1. Required poster format

- **Size:** 1 m × 1 m (100 cm × 100 cm), square.
- **Event heading:** `Aavishkar — Maharashtra State Inter-University Research Convention`.
- **Category:** `Engineering and Technology`.
- **Level:** `UG`.
- **Code No.:** use `[INSERT OFFICIAL CODE NO.]`; do not invent one.
- **Language:** English.
- **Do not include:** student names, guide names, university/department names,
  faces, personal identifiers, fake accuracy values, or unverified medical claims.
- Use the first WhatsApp image as the formal layout reference: Aavishkar header,
  category/level/code strip, clear numbered content sections, diagrams and charts,
  large readable type, and organised columns.

## 2. Poster identity

**Project title**

> MedSynapse: AI-Powered Multi-Disease Clinical Screening from Medical Reports and Images

**Subtitle**

> From Report Upload to Explainable, Doctor-Reviewable AI Screening

**One-line value proposition**

> A unified clinical decision-support prototype that transforms reports and scans into structured, explainable screening evidence.

## 3. Visual style

- Formal, academic, print-ready medical technology poster.
- White background; dark navy section headers; soft green accents; black body text.
- Use blood red only for blood/diabetes and heart icons; muted teal for X-ray;
  soft peach for brain/MRI; no coloured body text.
- Avoid grey or dark panels, neon effects, gradients, glassmorphism, and clutter.
- Use clean vector-style icons: PDF report, OCR scan, database cylinder, local AI
  chip, blood drop, heart, chest X-ray, brain MRI, doctor approval, checkmark.
- Use clear hierarchy and text that is readable from at least one metre.

## 4. Verified architecture and poster pipeline

Show this as the main central flow diagram:

```text
Upload PDF / PNG clinical report or medical scan
                ↓
Document Intelligence
PyMuPDF for PDFs + Tesseract OCR for scanned reports/images
                ↓
Structured clinical feature extraction and validation
                ↓
Local Gemma model for structured diabetes-feature extraction
                ↓
Local SQLite feature store
feature evidence + extraction status + feature ID
                ↓
Confidence / disease-suitability scoring (JEV concept)
                ↓
Disease-specific ML / DL inference
                ↓
Risk tier + contributing factors + XAI / SHAP evidence
                ↓
Doctor review and approval
                ↓
AI-assisted final clinical screening report
```

The Excalidraw diagram expresses the intended architecture: report upload,
OCR, feature extraction, local Gemma, database, confidence/JEV scoring,
existing disease models, SHAP explanations, doctor approval, and final LLM
report generation.

## 5. Primary active screening modules

Show these as four visual cards with the corresponding medical icon:

| Module | Input | AI method | Output |
|---|---|---|---|
| Diabetes Mellitus | Glucose, insulin, BMI, blood pressure, age and related biomarkers | Scikit-learn ensemble with scaling and BMI categorisation | Screening risk tier and contributing factors |
| Coronary Heart Disease | 13 clinical biomarkers, ECG/exercise indicators and lipid data | Scaled tabular classifier | Cardiac risk screening output |
| Pneumonia Detection | Chest X-ray | CNN, standardised to 224 × 224 × 3 | Pneumonia screening output |
| Brain Tumor Classification | Cranial MRI | Xception transfer learning, standardised to 299 × 299 × 3 | Four-class MRI screening output |

## 6. Extensible research model library

The second WhatsApp image shows artifact bundles for diabetes, heart disease,
chest X-ray, brain tumor, breast cancer, liver disease, and kidney stone.

Show these in a smaller strip labelled:

> Extensible Research Model Library

Use: Diabetes • Heart Disease • Chest X-ray • Brain MRI • Breast Cancer • Liver Disease • Kidney Stone

Do **not** describe all of these as deployed or clinically validated in the
poster. Label them as *research modules / expandable model-artifact scope*.

## 7. Section-ready poster content

### 1. Problem Statement

Clinical reports and scans require manual review, while disease models often
remain isolated and provide outputs without a shared, explainable workflow.

### 2. Objectives

- Extract clinical features automatically from PDF and image reports.
- Determine which screening models are suitable for the available evidence.
- Combine tabular and image-based screening in one dashboard.
- Preserve structured feature evidence for traceability.
- Present interpretable model evidence for doctor review.

### 3. Methodology

1. Upload a medical report or scan.
2. Extract text with PyMuPDF/Tesseract and parse clinical parameters.
3. Use local Gemma for structured diabetes-feature extraction where configured.
4. Save structured feature evidence in a local SQLite feature store.
5. Route validated inputs to the relevant ML/DL screening model.
6. Generate risk tiers, contributing factors, explainability evidence, and a
   doctor-reviewable report.

### 4. Innovation and Uniqueness

- Local AI-assisted feature extraction rather than a cloud-only workflow.
- Structured feature persistence with an extraction identifier and status.
- Confidence-aware disease suitability concept before model selection.
- Explainability-aware report design using SHAP/XAI evidence.
- Doctor-in-the-loop review before using the final report.

### 5. System Outputs

- Extracted biomarkers and imaging inputs.
- Disease suitability / confidence signals.
- Risk tier and prediction probability.
- Contributing clinical indicators.
- Explainability evidence.
- Doctor-reviewable screening summary.

### 6. Responsible AI Note

> MedSynapse is a clinical screening and decision-support prototype. It does
> not replace diagnosis, clinical judgement, or licensed medical professionals.

### 7. Future Scope

- Add approved disease-specific model artifacts and validation studies.
- Extend the clinician dashboard and controlled patient-history workflow.
- Strengthen authentication, access control, privacy, and audit trails.
- Add guideline-grounded report generation.
- Expand the research model library after technical and clinical validation.

### 8. Conclusion

> MedSynapse unifies document intelligence, local AI, structured feature
> storage, multi-disease screening, explainability, and clinician review into
> one transparent decision-support workflow.

## 8. Copy-paste prompt for ChatGPT image/poster generation

```text
Create a high-resolution, print-ready, square 1 m × 1 m academic research
poster for the Aavishkar Maharashtra State Inter-University Research Convention.
Use the attached Aavishkar poster image as the layout and hierarchy reference,
the attached model-artifact image as the research-module scope reference, and
the attached Excalidraw diagram as the system-architecture reference.

Top header: “Aavishkar — Maharashtra State Inter-University Research Convention”
Category: Engineering and Technology | Level: UG | Code No.: [INSERT OFFICIAL CODE NO.]
Theme line: “Ideas for a Sustainable Tomorrow”

Title: “MedSynapse: AI-Powered Multi-Disease Clinical Screening from Medical
Reports and Images”
Subtitle: “From Report Upload to Explainable, Doctor-Reviewable AI Screening”

Use a formal white, navy, black, and soft-green medical-tech design. Use blood
red only for the diabetes/blood icon and heart icon, muted teal for chest X-ray,
and soft peach for brain MRI. Use black body text. Do not use grey/dark blocks,
neon colours, gradients, glassmorphism, faces, personal names, university names,
fake accuracy values, or unverifiable clinical claims.

Place a clear central pipeline diagram:
Upload PDF/PNG report or scan → PyMuPDF + Tesseract OCR → structured clinical
feature extraction → local Gemma structured feature extraction → local SQLite
feature store → confidence / JEV disease suitability scoring → disease-specific
ML/DL models → risk tier + SHAP/XAI evidence → doctor review and approval →
AI-assisted final screening report.

Show four main model cards:
1. Diabetes Mellitus — structured biomarkers — scaled ML ensemble.
2. Coronary Heart Disease — 13 clinical biomarkers — scaled classifier.
3. Pneumonia Detection — chest X-ray — CNN, 224 × 224 × 3.
4. Brain Tumor Classification — cranial MRI — Xception, 299 × 299 × 3.

Add a small “Extensible Research Model Library” strip: Breast Cancer, Liver
Disease, Kidney Stone, Eye Disease. Label these as research / expandable
modules, not deployed clinical products.

Use these numbered sections with concise, fully legible text:
1. Problem Statement: isolated disease models and manual report review create
fragmented, non-explainable workflows.
2. Objectives: automate feature extraction, select suitable screening models,
combine tabular and imaging inputs, preserve evidence, and support doctor review.
3. Methodology: OCR, validation, local Gemma, SQLite storage, model routing,
risk scoring, explainability, and review.
4. Innovation: local AI, structured evidence storage, confidence-aware routing,
XAI, and doctor-in-the-loop approval.
5. System Outputs: extracted biomarkers, suitability signals, risk tier,
contributing factors, explainability evidence, and screening report.
6. Responsible AI: “Clinical screening and decision-support prototype; does not
replace diagnosis, clinical judgement, or licensed medical professionals.”
7. Future Scope: approved model artifacts, clinical validation, privacy/access
controls, audit trails, guideline-grounded reports, and more research modules.
8. Conclusion: “One transparent workflow unifying OCR, local AI, structured
feature storage, multi-disease screening, explainability, and clinician review.”

Use a precise competition-poster composition with large readable headings,
compact bullets, clean spacing, vector icons, and no spelling errors.
```
