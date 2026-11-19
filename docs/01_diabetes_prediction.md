# Module M1: Diabetes Mellitus Prediction (Soft-Voting Ensemble)

## 1. Module Overview
- **Module ID**: `M1`
- **Clinical Specialty**: Endocrinology / Metabolic Health
- **Diagnostic Task**: Binary Classification (Diabetic vs. Non-Diabetic)
- **Input Modality**: Tabular Clinical Biomarkers (8 metrics)
- **Associated Notebook**: [`notebooks/Final_Diabetes_Prediction.ipynb`](../notebooks/Final_Diabetes_Prediction.ipynb)
- **Production Artifacts**: `models/Diabetes_model/diabetes_model.pkl`, `models/Diabetes_model/diabetes_scaler.pkl`
- **Downloadable Bundle**: `diabetes_artifacts.zip`

---

## 2. Clinical Significance & Problem Formulation
Diabetes mellitus is a chronic metabolic disorder characterized by persistent hyperglycemia resulting from defects in insulin secretion, insulin action, or both. Early identification of prediabetic and high-risk diabetic individuals is critical to prevent microvascular and macrovascular complications, including diabetic nephropathy, retinopathy, neuropathy, and coronary artery disease.

---

## 3. Dataset & Clinical Biomarkers
- **Source**: Pima Indians Diabetes Database (`datasets/diabetes.csv`)
- **Total Cohort**: 768 patient records
- **Features (8 Clinical Indicators)**:
  1. `Pregnancies`: Gravidity count
  2. `Glucose`: 2-Hour post-load oral glucose tolerance test (mg/dL)
  3. `BloodPressure`: Diastolic blood pressure (mm Hg)
  4. `SkinThickness`: Triceps skin fold thickness (mm)
  5. `Insulin`: 2-Hour serum insulin (μU/ml)
  6. `BMI`: Body mass index ($kg/m^2$)
  7. `DiabetesPedigreeFunction`: Genetic risk score based on family history
  8. `Age`: Patient age (years)

---

## 4. Preprocessing & Feature Engineering
1. **Zero-Value Correction**: Converted physiological zero measurements (`Glucose`, `BloodPressure`, `SkinThickness`, `Insulin`, `BMI`) to `np.nan`.
2. **KNN Imputation**: Replaced naive median imputation with a 5-neighbor $k$-NN imputer (`KNNImputer(n_neighbors=5)`).
3. **Outlier Winsorization**: Capped extreme values in skewed features (`Insulin`, `DiabetesPedigreeFunction`) to $[Q_1 - 1.5 	imes IQR, Q_3 + 1.5 	imes IQR]$.
4. **Clinical Feature Engineering**: Created ordinal categorical BMI binning (`BMI_Cat`: Underweight, Normal, Overweight, Obese).
5. **Standardization**: Applied `StandardScaler()` across all feature dimensions.

---

## 5. Model Architecture & Ensemble Topology
A **Soft-Voting Meta-Classifier (`VotingClassifier`)** aggregating predicted class probabilities across three diverse model families:
1. **Random Forest**: `n_estimators=20`, `max_depth=20`, `min_samples_split=5`, `min_samples_leaf=1`
2. **Gradient Boosting**: `n_estimators=100`, `learning_rate=0.1`, `max_depth=3`
3. **Logistic Regression**: `solver='liblinear'`, L2 penalty

---

## 6. Empirical Evaluation & Benchmark Results

### 📊 Performance Summary
- **Training Accuracy**: **92.35%**
- **Test Accuracy**: **74.68% (~75%)**

### 📋 Classification Report (Test Set: 154 Samples)
| Class | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: |
| **0 (Non-Diabetic)** | 0.79 | 0.83 | 0.81 | 100 |
| **1 (Diabetic)** | 0.65 | 0.59 | 0.62 | 54 |
| **Macro Average** | 0.72 | 0.71 | 0.72 | 154 |
| **Weighted Average** | 0.74 | 0.75 | 0.74 | 154 |

### 🔲 Confusion Matrix
```
                  Predicted Non-Diabetic    Predicted Diabetic
Actual Non-Diabetic        83                       17
Actual Diabetic            22                       32
```

---

## 7. Explainability & Evidence Fusion in MedSynapse
- **Kernel/Tree SHAP**: Identifies `Glucose` (primary driver), `BMI`, and `Age` as the highest contributing risk indicators.
- **DiCE Counterfactuals**: Computes minimum biomarker intervention needed to transition risk from high to low (e.g. *"Reduce fasting glucose by 24 mg/dL and BMI by 3.2"*).
- **Cross-Module Reasoning**:
  - `M1 + M7 (Nephrology)`: Flags diabetic nephropathy risk when glycemic indicators co-occur with renal CT abnormalities.
  - `M1 + M9 (Ophthalmology)`: Flags diabetic retinopathy risk when elevated HbA1c/glucose co-occurs with fundus retinal microaneurysms.
