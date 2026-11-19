# 📚 MedSynapse Diagnostic Modules: Empirical Results & Implementation Documentation

This directory contains comprehensive technical, clinical, and empirical benchmark documentation for all nine machine learning and deep learning diagnostic backbones unified under the **MedSynapse** multi-disease clinical decision-support system.

---

## 🏆 Master Empirical Performance Matrix

All models have been evaluated on held-out clinical test cohorts and benchmarked against standard clinical evaluation metrics:

| Module ID | Diagnostic Domain | Clinical Target | Input Modality | Best Architecture | Test Accuracy | Precision | Recall | F1-Score | Production Artifact Bundle |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **M1** | **Metabolic** | Diabetes Mellitus | Tabular (8 Biomarkers) | Soft-Voting Ensemble (RF + GB + ET + LR) | **74.68%** | 0.75 | 0.75 | **0.74** | `models/diabetes_artifacts.zip` |
| **M2** | **Cardiology** | Coronary Heart Disease | Tabular (13 Biomarkers) | Random Forest Classifier (100 Trees) | **98.54%** | 0.99 | 0.99 | **0.99** | `models/heart_artifacts.zip` |
| **M3** | **Pulmonology** | Pneumonia (Pediatric) | Chest X-Ray (299×299×3) | Xception Deep Transfer Learning | **83.01%** | 0.84 | 0.83 | **0.83** | `models/chest_xray_artifacts.zip` |
| **M4** | **Neuro-Oncology** | Brain Tumor (4-Class) | Cranial MRI (299×299×3) | Xception Deep Transfer Network | **95.25%** | 0.96 | 0.95 | **0.95** | `models/brain_tumor_artifacts.zip` |
| **M5** | **Oncology** | Breast Cancer (WDBC) | FNA Biopsy (30 Features) | PCA + Tuned Logistic Regression / Ensemble | **96.49%** | 0.97 | 0.96 | **0.96** | `models/breast_cancer_artifacts.zip` |
| **M6** | **Hepatology** | Liver Disease (ILPD) | Tabular LFT (10 Parameters) | Random Forest & Gradient Boosting | **79.49%** | 0.80 | 0.79 | **0.79** | `models/liver_disease_artifacts.zip` |
| **M7** | **Nephrology** | Kidney Pathology (4-Class) | CT Scan (150×150×3) | MobileNetV2 & EfficientNetB0 | **99.25%** | 0.99 | 0.99 | **0.99** | `models/kidney_stone_artifacts.zip` |
| **M8** | **Dermatology** | Skin Cancer (7-Class HAM10000) | Dermoscopy (28×28×3) | Deep 4-Block Hierarchical CNN | **97.98%** | 0.98 | 0.98 | **0.98** | `models/skin_cancer_artifacts.zip` |
| **M9** | **Ophthalmology** | Eye Diseases (Multi-Class) | Retinal Fundus (224×224×3) | PyTorch ResNet-18 Deep Transfer Learning | **90.78%** | 0.91 | 0.91 | **0.91** | `models/eye_disease_artifacts.zip` |

---

## 📑 Diagnostic Module Documentation Index

- **Module M1 (Metabolic)**: [`01_diabetes_prediction.md`](01_diabetes_prediction.md) — Soft-voting glycemic prediction with median zero-imputation and StandardScaler normalization.
- **Module M2 (Cardiology)**: [`02_heart_disease_prediction.md`](02_heart_disease_prediction.md) — Cleveland cardiovascular risk classification and biomarker sensitivity.
- **Module M3 (Pulmonology)**: [`03_chest_xray_pneumonia_prediction.md`](03_chest_xray_pneumonia_prediction.md) — Pulmonary radiography classification with Xception deep transfer learning.
- **Module M4 (Neuro-Oncology)**: [`04_brain_tumor_prediction.md`](04_brain_tumor_prediction.md) — Multi-class intracranial neoplasm MRI classification (Glioma, Meningioma, Pituitary, Normal).
- **Module M5 (Oncology)**: [`05_breast_cancer_prediction.md`](05_breast_cancer_prediction.md) — FNA biopsy malignancy classification with PCA dimensionality reduction.
- **Module M6 (Hepatology)**: [`06_liver_disease_prediction.md`](06_liver_disease_prediction.md) — Multi-model liver function test (LFT) benchmark and ensemble routing.
- **Module M7 (Nephrology)**: [`07_kidney_stone_prediction.md`](07_kidney_stone_prediction.md) — High-resolution renal CT imaging classifier for cyst, stone, and tumor detection.
- **Module M8 (Dermatology)**: [`08_skin_cancer_prediction.md`](08_skin_cancer_prediction.md) — 7-class dermatoscopy classification on HAM10000 with 4-block CNN achieving 97.98% accuracy.
- **Module M9 (Ophthalmology)**: [`09_eye_disease_prediction.md`](09_eye_disease_prediction.md) — PyTorch Retinal fundus multi-class diagnostic network (Cataract, Retinopathy, Glaucoma, Normal).

---

## 🔬 Explainability (XAI) & Evidence Fusion in MedSynapse

All 9 backbones feed structured attributions directly into the MedSynapse diagnostic pipeline and LLM orchestrator to guarantee high-transparency clinical decision support:

### 📋 Explainability Engines Across All 9 Disease Modules

| Modality | Module ID | Clinical Domain | Model Architecture | Explainability Method | Target Layer / Features | Clinical XAI Output Generated |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tabular** | **M1** | Diabetes Mellitus | Voting Classifier Ensemble | FastTreeSHAP / TreeSHAP | 9 Clinical Biomarkers | SHAP $\phi$ attribution table, baseline expected value $E[f(x)]$, positive/negative risk drivers, plain-language deterministic sentences |
| **Tabular** | **M2** | Coronary Heart Disease | Random Forest (100 Trees) | TreeSHAP | Cleveland 13 Biomarkers | Inverted positive class index ($1$), individual biomarker $\phi$ displacements, risk elevation ranking |
| **Vision** | **M3** | Pediatric Pneumonia | Functional Keras CNN | Grad-CAM Convolutional Saliency Map | Last Conv2D (`7×7` Receptive Field) | Spatial heatmap array, pure NumPy Jet colormapping, overlaid base64 PNG data URL, attention intensity scale |
| **Vision** | **M4** | Cranial Brain Tumor | Sequential Xception Transfer | Grad-CAM Saliency Hook | `block14_sepconv2_act` (`10×10` Feature Map) | Saliency overlay isolating intracranial neoplasm masses across 4 classes (Glioma, Meningioma, Pituitary, Normal) |
| **Tabular** | **M5** | Breast Cancer Malignancy | WDBC PCA + Logistic Regression | Permutation / Monte Carlo SHAP | 30 FNA Nuclear Morphometrics | Marginal game-theoretic attributions across all 30 features (`perimeter_worst`, `concavity_worst` top malignant drivers) |
| **Tabular** | **M6** | Hepatic Liver Disease | Random Forest (ILPD) | TreeSHAP | 10 Serum LFT Parameters | De Ritis ratio ($AST/ALT$), A:G ratio, Direct Bilirubin ratio, enzyme $\phi$ attributions |
| **Vision** | **M7** | Kidney Pathology | Functional EfficientNet | Grad-CAM on `top_conv` | `top_conv` (`5×5` Receptive Field) | Spatial receptive field highlighting nephrolithiasis calcifications, cysts, and tumors across 4 CT classes |
| **Vision** | **M8** | Cutaneous Skin Cancer | Sequential Conv2D HAM10000 | Dynamic Sequential Grad-CAM | `conv2d_7` Conv Layer | Multiclass convolutional activation across 7 dermatologic lesion classes (Melanoma, Basal Cell, Nevus, etc.) |
| **Vision** | **M9** | Retinal Eye Disease | PyTorch ResNet-18 Transfer | PyTorch Forward Gradient Hook | `base.layer4` (ResNet-18) | Forward gradient activation across 5 ocular diagnostic classes (Bulging Eyes, Cataract, Crossed Eyes, Glaucoma, Uveitis) |

### 🔍 Architectural Pipeline & Code Organization
1. **Explainability Core Service** ([`explainability_service.py`](../backend/services/explainability_service.py)):
   - **Tabular SHAP**: Calculates Shapley values ($\phi$), cohort expected baseline $E[f(x)]$, positive/negative risk contributors, and plain-language deterministic summary sentences.
   - **Deep Vision Grad-CAM**: Subsets Functional, Sequential (Xception & 4-block CNN), and PyTorch computation graphs, projects normalized gradients onto feature activations, maps through pure NumPy Jet colormaps, and performs alpha-blending ($0.45 \times \text{heatmap} + 0.55 \times \text{original}$).
2. **Clinical Report Synthesis Engine** ([`clinical_report_service.py`](../backend/services/clinical_report_service.py)):
   - Generates guideline-grounded narrative syntheses incorporating focal ratio metrics, receptive field dimensions, and primary biomarker contributors.
3. **Optimized LLM Transport** ([`groq_report_service.py`](../backend/services/groq_report_service.py)):
   - Recursively decouples heavy image data URLs from Groq prompt payloads to prevent HTTP 413 token overflow, dropping token consumption from ~37k to <3k tokens.
4. **Clinician-Facing Front-End Components**:
   - **Diagnostic Result Card** ([`DiagnosticResultCard.jsx`](../frontend/src/components/DiagnosticResultCard.jsx)): Section 3 dynamically switches between interactive SHAP waterfall/attributions and side-by-side Grad-CAM heatmap overlays.
   - **Clinical LLM Report View** ([`LLMReportView.jsx`](../frontend/src/components/LLMReportView.jsx)): Embeds visual activation thumbnails, contributing biomarker badges, and printable multi-page report views.
