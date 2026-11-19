# Module M2: Coronary Heart Disease Prediction (Random Forest)

## 1. Module Overview
- **Module ID**: `M2`
- **Clinical Specialty**: Cardiology
- **Diagnostic Task**: Binary Classification (Presence vs. Absence of Heart Disease)
- **Input Modality**: Tabular Cardiovascular Parameters (13 clinical indicators)
- **Associated Notebook**: [`notebooks/Final_Heart_Disease_Prediction.ipynb`](../notebooks/Final_Heart_Disease_Prediction.ipynb)
- **Production Artifacts**: `models/heart_model/heart_model.pkl`, `models/heart_model/heart_scaler.pkl`
- **Downloadable Bundle**: `heart_artifacts.zip`

---

## 2. Clinical Significance & Problem Formulation
Coronary artery disease (CAD) remains the leading cause of global mortality. Early non-invasive risk assessment using resting electrocardiography, hemodynamic parameters, and exercise stress biomarkers allows clinicians to initiate preventative therapies before major adverse cardiac events (MACE) occur.

---

## 3. Dataset & Clinical Parameters
- **Source**: Cleveland Heart Disease Database (`datasets/heart.csv`)
- **Cohort Size**: 303 patient records
- **Target Variable**: `target` (0 = No Disease, 1 = Presence of Heart Disease)
- **Clinical Indicators**:
  1. `age`: Patient age (years)
  2. `sex`: Biological sex (1 = male, 0 = female)
  3. `cp`: Chest pain type (typical angina, atypical angina, non-anginal, asymptomatic)
  4. `trestbps`: Resting blood pressure (mm Hg on admission)
  5. `chol`: Serum cholesterol (mg/dL)
  6. `fbs`: Fasting blood sugar > 120 mg/dL (1 = true, 0 = false)
  7. `restecg`: Resting electrocardiographic results (0 = normal, 1 = ST-T wave abnormality, 2 = LVH)
  8. `thalach`: Maximum heart rate achieved during exercise stress testing
  9. `exang`: Exercise-induced angina (1 = yes, 0 = no)
  10. `oldpeak`: ST depression induced by exercise relative to rest
  11. `slope`: Slope of the peak exercise ST segment
  12. `ca`: Number of major vessels (0–3) colored by fluoroscopy
  13. `thal`: Thalassemia scintigraphy (normal, fixed defect, reversible defect)

---

## 4. Model Architecture & Hyperparameters
- **Classifier**: Random Forest (`RandomForestClassifier`)
- **Configuration**:
  - `n_estimators`: 100 decision trees
  - `criterion`: Gini impurity
  - `random_state`: 42
  - Feature normalization via `StandardScaler()`

---

## 5. Empirical Evaluation & Benchmark Results

### 📊 Performance Summary
- **Training Accuracy**: **100.0%**
- **Test Accuracy**: **85.25%**

### 📋 Classification Report (Test Set: 61 Samples)
| Class | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: |
| **0 (No Disease)** | 0.86 | 0.83 | 0.84 | 29 |
| **1 (Heart Disease)** | 0.85 | 0.88 | 0.86 | 32 |
| **Macro Average** | 0.85 | 0.85 | 0.85 | 61 |
| **Weighted Average** | 0.85 | 0.85 | 0.85 | 61 |

### 🔲 Confusion Matrix
```
                  Predicted No Disease    Predicted Heart Disease
Actual No Disease          24                        5
Actual Heart Disease        4                       28
```

---

## 6. Explainability & Evidence Fusion in MedSynapse
- **TreeSHAP Attributions**: Primary risk drivers identified as `cp` (chest pain category), `thalach` (max heart rate), `oldpeak` (ST depression), and `ca` (fluoroscopy vessels).
- **Cross-Module Reasoning**:
  - `M2 + M1 (Diabetes)`: Cardiovascular risk is modulated upward in the presence of metabolic dysfunction.
  - `M2 + M7 (Kidney)`: Evaluates Cardio-Renal Metabolic Syndrome (CRMS) when renal and cardiac strain markers co-occur.
