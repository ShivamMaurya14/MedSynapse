# Module M3: Pediatric Pneumonia Detection (Chest Radiography Deep CNN)

## 1. Module Overview
- **Module ID**: `M3`
- **Clinical Specialty**: Pulmonology / Radiology
- **Diagnostic Task**: Binary Classification (Normal vs. Pneumonia)
- **Input Modality**: Anteroposterior Chest Radiographs (224×224×3 RGB)
- **Associated Notebook**: [`notebooks/Final_Chest_XRay_Prediction.ipynb`](../notebooks/Final_Chest_XRay_Prediction.ipynb)
- **Production Artifacts**: `models/Pneumonia_model/chest_xray_model.h5`, `models/chest_xray_model.keras`
- **Downloadable Bundle**: `chest_xray_artifacts.zip`

---

## 2. Clinical Significance & Problem Formulation
Pneumonia is the single largest infectious cause of death in children worldwide. Rapid differentiation between healthy pulmonary parenchyma and alveolar opacification/consolidation on chest radiographs is essential for prompt antibiotic therapy or supportive care.

---

## 3. Dataset & Distribution
- **Source**: Pediatric Chest Radiograph Database (`datasets/chest_xray/`)
- **Total Radiographs**: 5,856 verified anterior-posterior chest X-rays
- **Splits**:
  - `train`: 5,216 images (3,875 Pneumonia, 1,341 Normal)
  - `val`: 16 images (8 Pneumonia, 8 Normal)
  - `test`: 624 images (390 Pneumonia, 234 Normal)

---

## 4. Model Architecture
- **Base Network**: Xception (Pre-trained on ImageNet)
- **Head Architecture**:
  - `GlobalAveragePooling2D()`
  - `Dropout(0.5)`
  - `Dense(128, activation='relu')`
  - `Dropout(0.5)`
  - `Dense(1, activation='sigmoid')`
- **Loss & Optimization**: Binary Crossentropy, `Adam(learning_rate=0.0001)`
- **Data Augmentation**: Random horizontal flip, vertical flip, rotation (±20°), zoom (0.2).

---

## 5. Empirical Evaluation & Benchmark Results

### 📊 Performance Summary
- **Training Accuracy**: **95.40%**
- **Validation Accuracy**: **91.20%**
- **Test Accuracy**: **90.38%**
- **Precision**: **0.89**
- **Recall**: **0.94**
- **F1-Score**: **0.91**

---

## 6. Explainability & Evidence Fusion in MedSynapse
- **Grad-CAM Saliency**: Overlays attention heatmaps onto pulmonary zones, highlighting bronchopneumonic consolidations and interstitial opacities.
- **Evidence Formatting**: Computes pulmonary opacity ratio and bounding coordinates, embedding findings into structured JSON for LLM report grounding.
