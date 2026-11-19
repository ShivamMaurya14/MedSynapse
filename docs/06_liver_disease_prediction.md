# Module M6: Hepatic Disease Classification (Multi-Model LFT Benchmark)

## 1. Module Overview
- **Module ID**: `M6`
- **Clinical Specialty**: Hepatology / Gastroenterology
- **Diagnostic Task**: Binary Classification (Liver Disease vs. Healthy Control)
- **Input Modality**: Tabular Liver Function Tests (LFT: 10 parameters)
- **Associated Notebook**: [`notebooks/Final_Liver_Disease_Prediction.ipynb`](../notebooks/Final_Liver_Disease_Prediction.ipynb)
- **Production Artifacts**: `models/liver_model.pkl`, `models/liver_rf_model.pkl`, `models/liver_scaler.pkl`
- **Downloadable Bundle**: `liver_disease_artifacts.zip`

---

## 2. Clinical Significance & Problem Formulation
Liver diseases often progress silently from non-alcoholic fatty liver disease (NAFLD) or chronic hepatitis to cirrhosis without overt clinical symptoms. Multi-analyte LFT panels provide a non-invasive screening window to detect hepatocellular and cholestatic injury early.

---

## 3. Dataset & Biomarkers
- **Source**: Indian Liver Patient Dataset (ILPD: `datasets/liver.csv`)
- **Cohort Size**: 583 clinical records (416 liver patients, 167 controls)
- **Parameters (10 Indicators)**:
  1. `Age`: Patient age
  2. `Gender`: Biological sex
  3. `Total_Bilirubin`: Total serum bilirubin (mg/dL)
  4. `Direct_Bilirubin`: Conjugated direct bilirubin (mg/dL)
  5. `Alkaline_Phosphotase`: Serum ALP (IU/L)
  6. `Alamine_Aminotransferase`: ALT / SGPT (IU/L)
  7. `Aspartate_Aminotransferase`: AST / SGOT (IU/L)
  8. `Total_Protiens`: Total serum protein (g/dL)
  9. `Albumin`: Serum albumin (g/dL)
  10. `Albumin_and_Globulin_Ratio`: A/G Ratio

---

## 4. Empirical Evaluation & 7-Model Benchmark Results

### 📊 Model Performance Comparison on Test Set (170 Samples)
| Model Algorithm | Accuracy | Sensitivity (Recall) | Specificity | AUROC | Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Random Forest (`RandomForestClassifier`)** | **72.10%** | **0.78** | **0.65** | **0.76** | 🏆 **Primary Model** |
| **Logistic Regression (`LogisticRegression`)** | **71.80%** | 0.77 | 0.63 | 0.75 | Baseline Linear |
| **Gradient Boosting (`GradientBoostingClassifier`)** | **70.60%** | 0.76 | 0.61 | 0.74 | Ensemble Tree |
| **Support Vector Classifier (`SVC`)** | **70.60%** | 0.75 | 0.60 | 0.73 | Radial Basis Function |
| **K-Nearest Neighbors (`KNeighborsClassifier`)** | **68.20%** | 0.73 | 0.58 | 0.70 | Instance-Based |
| **XGBoost (`XGBClassifier`)** | **67.60%** | 0.71 | 0.59 | 0.71 | Gradient Boosted Trees |
| **Decision Tree (`DecisionTreeClassifier`)** | **64.70%** | 0.69 | 0.55 | 0.66 | Single Tree |

---

## 5. Explainability & Evidence Fusion in MedSynapse
- **Biomarker Sensitivity**: SHAP identifies `Alkaline_Phosphotase` (cholestatic marker), `Total_Bilirubin`, and `Alamine_Aminotransferase` (ALT) as the highest predictive indicators of hepatic impairment.
