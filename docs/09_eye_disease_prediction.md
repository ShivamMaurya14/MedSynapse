# Module M9: Retinal Fundus Multi-Disease Detection (PyTorch ResNet-18)

## 1. Module Overview
- **Module ID**: `M9`
- **Clinical Specialty**: Ophthalmology / Retinal Health
- **Diagnostic Task**: Multi-Class Retinal Pathology Classification (`cataract`, `diabetic_retinopathy`, `glaucoma`, `normal` / `bulging_eyes`, `uveitis`, `crossed_eyes`)
- **Input Modality**: Digital Color Retinal Fundus Photography (224×224×3 RGB)
- **Framework**: **PyTorch 2.0+ & Torchvision**
- **Associated Notebook**: [`notebooks/Final_Eye_Disease_Prediction.ipynb`](../notebooks/Final_Eye_Disease_Prediction.ipynb)
- **Production Artifacts**: `eye_disease_model.pth` (state_dict), `eye_disease_full_model.pt`, `classes.json`, `Eye Disease-class_dict.csv`
- **Downloadable Bundle**: `eye_disease_artifacts.zip` (125.48 MB)

---

## 2. Clinical Significance & Problem Formulation
Diabetic retinopathy, glaucoma, and cataracts are leading causes of preventable visual impairment worldwide. Automated fundus screening enables early referral before irreversible neurosensory vision loss or optic nerve damage progresses.

---

## 3. Dataset & Distribution
- **Source**: Kaggle Eye Diseases Classification Benchmark Dataset / Multi-Class Fundus Datasets
- **Total Images**: 4,200+ verified digital fundus photographs
- **Supported Classes**:
  1. `cataract`: Lens opacity preventing clear fundus visualization
  2. `diabetic_retinopathy`: Retinal microaneurysms, hemorrhages, hard exudates
  3. `glaucoma`: Optic disc cupping and neuroretinal rim thinning
  4. `normal`: Healthy retinal vasculature and optic disc morphology
  *(Auto-discovers and accommodates 4-class or 5-class ophthalmic datasets dynamically)*
- **Data Augmentation**: Random horizontal/vertical flip, dynamic min-max normalization, resized to 224×224.

---

## 4. Model Architecture & Training Strategy
- **Backbone**: PyTorch ResNet-18 (`torchvision.models.resnet18(pretrained=True)`)
- **Classifier Head**:
  ```python
  nn.Sequential(
      nn.Linear(512, 128),
      nn.ReLU(),
      nn.Dropout(0.2),
      nn.Linear(128, NUM_CLASSES)
  )
  ```
- **Optimizer & Loss**:
  - `AdamW` with differential learning rates: `3e-5` for backbone, `8e-4` for classification head.
  - `CrossEntropyLoss` with PyTorch multi-class accuracy metrics.

---

## 5. Empirical Evaluation & Benchmark Results

### 📊 Performance Summary
- **Training Accuracy**: **96.50%**
- **Validation Accuracy**: **93.80%**
- **Test Accuracy**: **93.75%** (Macro F1: ~0.94)
- **Macro Precision**: **0.95**
- **Macro Recall**: **0.94**
- **Macro F1-Score**: **0.94**

---

## 6. Explainability & Evidence Fusion in MedSynapse
- **Grad-CAM Saliency**: Isolates the optic nerve head for glaucoma cupping and perimacular microvascular lesions for diabetic retinopathy.
- **Cross-Module Reasoning**:
  - `M9 + M1 (Diabetes)`: Co-occurring glycemic instability triggers the agentic LLM to correlate systemic HbA1c elevation with observed microaneurysm severity in fundus scans.
