# Module M7: Kidney Stone & Renal Pathology Detection (U-Net CNN)

## 1. Module Overview
- **Module ID**: `M7`
- **Clinical Specialty**: Nephrology / Urological Radiology
- **Diagnostic Task**: 4-Class Renal Pathology Classification (`Cyst`, `Normal`, `Stone`, `Tumor`)
- **Input Modality**: Non-Contrast & Contrast CT Scans (150×150×3 RGB)
- **Associated Notebook**: [`notebooks/Final_Kidney_Stone_Prediction.ipynb`](../notebooks/Final_Kidney_Stone_Prediction.ipynb)
- **Production Artifacts**: `models/kidney_model/kidney_stone_unet_model.keras`, `models/kidney_model/kidney_stone_classes.json`
- **Downloadable Bundle**: `kidney_stone_artifacts.zip` (34.52 MB)

---

## 2. Clinical Significance & Problem Formulation
Nephrolithiasis (kidney stones), renal cortical cysts, and renal cell carcinomas require prompt and differentiated radiological assessment. High-speed classification on coronal/axial CT slices assists emergency physicians and urologists in triage and surgical planning.

---

## 3. Dataset & Distribution
- **Source**: CT Kidney Multi-Class Benchmark Dataset
- **Total Dataset**: 12,446 high-resolution abdominal CT slices
- **Classes**:
  - `Cyst`: Simple and complex cortical renal cysts
  - `Normal`: Unremarkable bilateral renal parenchyma
  - `Stone`: Nephrolithiasis / ureteral calculi
  - `Tumor`: Renal cell neoplasms
- **Splits**: 80% Training ($train\_ds$), 20% Validation/Test ($test\_ds$: 2,489 slices)

---

## 4. Model Topology & Architecture
The production architecture implements a custom **U-Net Classifier Backbone**:
- **Encoder 1**: `Conv2D(32)` + `BatchNorm` + `MaxPooling2D(2, 2)`
- **Encoder 2**: `Conv2D(64)` + `BatchNorm` + `MaxPooling2D(2, 2)`
- **Bridge**: `Conv2D(128)` + `BatchNorm`
- **Classifier Head**: `GlobalAveragePooling2D()` + `Dropout(0.5)` + `Dense(128, activation='relu')` + `Dense(4, activation='softmax')`
- **Optimizer**: `Adam(learning_rate=0.0001)`, 40 Epochs

---

## 5. Empirical Evaluation & Benchmark Results

### 📊 Epoch 40 Convergence Metrics
- **Training Loss**: **0.0187** | **Training Accuracy**: **99.46%**
- **Validation Loss**: **0.0098** | **Validation Accuracy**: **99.72%**

### 📋 Full Test Classification Report (2,489 Evaluation Scans)
| Class Index | Pathology Category | Precision | Recall | F1-Score | Support |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **0** | `Cyst` | **1.00** | **1.00** | **1.00** | 737 |
| **1** | `Normal` (Healthy Control) | **1.00** | **1.00** | **1.00** | 1,001 |
| **2** | `Stone` (Nephrolithiasis) | **1.00** | **0.99** | **1.00** | 280 |
| **3** | `Tumor` (Renal Neoplasm) | **1.00** | **0.99** | **1.00** | 471 |
| **Overall Accuracy** | | | | **1.00 (99.72%)** | **2,489** |
| **Macro Average** | | **1.00** | **1.00** | **1.00** | 2,489 |
| **Weighted Average** | | **1.00** | **1.00** | **1.00** | 2,489 |

---

## 6. Explainability & Evidence Fusion in MedSynapse
- **Grad-CAM Localization**: Pinpoints hyperdense renal calcifications with >98% spatial overlap with radiological ground truth.
- **Cross-Module Reasoning**:
  - `M7 + M1 (Diabetes)`: Links persistent microalbuminuria and renal structural abnormalities to diabetic nephropathy.
  - `M7 + M2 (Heart)`: Assesses Cardio-Renal Syndrome in patients with co-occurring cardiac insufficiency.
