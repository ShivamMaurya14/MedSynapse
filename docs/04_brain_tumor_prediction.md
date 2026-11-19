# Module M4: Cranial Brain Tumor Classification (Xception Deep CNN)

## 1. Module Overview
- **Module ID**: `M4`
- **Clinical Specialty**: Neuro-Oncology / Neuroradiology
- **Diagnostic Task**: 4-Class Intracranial Neoplasm Classification (`glioma`, `meningioma`, `notumor`, `pituitary`)
- **Input Modality**: Cranial Axial/Coronal/Sagittal MRI Scans (299×299×3 RGB)
- **Associated Notebook**: [`notebooks/Final_Brain_Tumor_Prediction.ipynb`](../notebooks/Final_Brain_Tumor_Prediction.ipynb)
- **Production Artifacts**: `brain_tumor_model.keras`, `brain_tumor_model.h5`, `classes.json`
- **Downloadable Bundle**: `brain_tumor_artifacts.zip` (443.59 MB)

---

## 2. Clinical Significance & Problem Formulation
Intracranial tumors exhibit marked histological diversity and varying prognostic trajectories. Differential diagnosis between extra-axial lesions (meningiomas, pituitary adenomas) and intra-axial infiltrative malignancies (gliomas) is vital for neurosurgical planning and radiotherapy protocols.

---

## 3. Dataset & Class Balance
- **Source**: Kaggle Multi-Class Cranial MRI Brain Tumor Database (`masoudnickparvar/brain-tumor-mri-dataset`)
- **Total Scans**: 7,200 high-resolution cranial MRI images
- **Splits**:
  - `Training`: 5,600 scans (1,400 Glioma, 1,400 Meningioma, 1,400 Pituitary, 1,400 No Tumor)
  - `Validation`: 800 scans (200 per class)
  - `Testing`: 800 scans (200 per class)

---

## 4. Model Architecture & Topology
- **Backbone**: Xception Deep Transfer Learning Network (ImageNet pre-trained, `pooling='max'`, 21,124,268 parameters)
- **Classifier Head**:
  - `Flatten()`
  - `Dropout(0.30)`
  - `Dense(128, activation='relu')`
  - `Dropout(0.25)`
  - `Dense(4, activation='softmax')`
- **Optimization**: `Adamax(learning_rate=0.001)`, Categorical Crossentropy

---

## 5. Empirical Evaluation & Benchmark Results

### 📊 Performance Summary (Kaggle GPU Execution)
- **Training Accuracy**: **99.75%** (Loss: 0.0076)
- **Validation Accuracy**: **95.00%** (Loss: 0.3239)
- **Test Accuracy**: **95.25%** (Loss: 0.2583)
- **Macro Precision**: **0.96**
- **Macro Recall**: **0.95**
- **Macro F1-Score**: **0.95**

### 📋 Per-Class Test Performance (800 Test Images)
| Class Index | Pathology Category | Precision | Recall | F1-Score | Support |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **0** | `glioma` | 0.99 | 0.84 | **0.91** | 200 |
| **1** | `meningioma` | 0.93 | 0.99 | **0.96** | 200 |
| **2** | `notumor` (Healthy Control) | 0.91 | 1.00 | **0.95** | 200 |
| **3** | `pituitary` | 0.98 | 0.97 | **0.98** | 200 |
| **Overall** | **Macro Average** | **0.96** | **0.95** | **0.95** | **800** |

---

## 6. Explainability & Evidence Fusion in MedSynapse
- **Grad-CAM Attention**: Accurately localizes the sellar/suprasellar region for pituitary adenomas, dural attachments for meningiomas, and infiltrative parenchymal hyperintensities for gliomas.
- **Cross-Module Reasoning**:
  - `M4 (Brain Tumor) + Clinical Symptoms`: Neurological deficit triage and headache correlation in multi-modal intake.
