# Module M5: Breast Cancer Malignancy Prediction (PCA + Logistic Regression)

## 1. Module Overview
- **Module ID**: `M5`
- **Clinical Specialty**: Surgical Oncology / Cytopathology
- **Diagnostic Task**: Binary Classification (Malignant vs. Benign)
- **Input Modality**: Fine Needle Aspiration (FNA) Nuclear Morphometric Biomarkers (30 features)
- **Associated Notebook**: [`notebooks/Final_Breast_Cancer_Prediction.ipynb`](../notebooks/Final_Breast_Cancer_Prediction.ipynb)
- **Production Artifacts**: `breast_cancer_model.pkl`, `breast_cancer_scaler.pkl`, `breast_cancer_pca.pkl`
- **Downloadable Bundle**: `breast_cancer_artifacts.zip`

---

## 2. Clinical Significance & Problem Formulation
Accurate cytological evaluation of fine needle aspirates of breast masses provides definitive guidance on surgical intervention versus watchful waiting. Minimizing false negatives (predicting benign when malignant) is paramount in oncological screening.

---

## 3. Dataset & Morphometric Features
- **Source**: Wisconsin Diagnostic Breast Cancer (WDBC) Database (`datasets/Breast_cancer_dataset.csv`)
- **Cohort Size**: 569 biopsied breast lesions (357 Benign, 212 Malignant)
- **Features**: 30 continuous nuclear characteristics computed from digitized FNA images:
  - Radius, Texture, Perimeter, Area, Smoothness, Compactness, Concavity, Concave Points, Symmetry, Fractal Dimension (Mean, Standard Error, Worst).

---

## 4. Dimensionality Reduction & Modeling Pipeline
1. **Standardization**: `StandardScaler()` centering and unit variance scaling.
2. **Principal Component Analysis (PCA)**: Retained 10 principal components capturing **95% of cumulative explained variance** (reducing dimensionality from 30 to 10).
3. **Hyperparameter Tuning**: 5-Fold Stratified Cross-Validation (`GridSearchCV`).

---

## 5. Empirical Evaluation & Comparative Benchmark

### 📊 Model Comparison on WDBC Test Cohort (171 Samples)
| Model Architecture | Cross-Validation Score | Test Accuracy | False Negatives (FN) | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Logistic Regression (Tuned)** | **99.24%** | **95.91%** | **3** | 🏆 **Selected Production Model** ($C=1.0, L_2$) |
| **Linear SVM** | 98.42% | 95.91% | 6 | High boundary margin |
| **Voting Ensemble** | 98.60% | 95.91% | 4 | Meta-aggregation (KNN + LR + SVM + DT) |
| **K-Nearest Neighbors (KNN)** | 97.20% | 94.74% | 7 | $k=3$ |
| **Decision Tree Classifier** | 93.15% | 90.64% | 9 | Prone to minor variance overfitting |

### 🔲 Confusion Matrix (Selected Logistic Regression)
```
                  Predicted Benign    Predicted Malignant
Actual Benign           103                    4
Actual Malignant          3                   61
```
*(High sensitivity: 95.3% recall on malignant cases).*

---

## 6. Explainability & Evidence Fusion in MedSynapse
- **PCA Component Attributions**: Unpacks principal component eigenvectors back into clinical morphometry: *Worst Concave Points* and *Perimeter Worst* contribute >45% of variance toward malignant stratification.
