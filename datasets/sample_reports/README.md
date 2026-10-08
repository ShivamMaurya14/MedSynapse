# 🧪 MedSynapse Test Reports & Sample Data Folder

This folder contains diverse dummy clinical reports and diagnostic scan files across multiple formats (**PDF**, **PNG**, **TXT**) to help you test, edit, and experiment with the MedSynapse OCR and AI prediction pipeline.

---

## 📂 Available Test Reports

| File Name | Format | Clinical Scenario | Target Module | Key Biomarkers / Values |
| :--- | :--- | :--- | :--- | :--- |
| **`01_diabetic_high_risk_panel`** | `.pdf`, `.png`, `.txt` | **High Risk Type 2 Diabetes** | 🩸 Diabetes | Glucose: `168 mg/dL`, Insulin: `42.5 μU/mL`, BMI: `33.4`, BP: `142/90` |
| **`02_cardiac_high_risk_panel`** | `.pdf`, `.png`, `.txt` | **High Risk Coronary Artery Disease** | ❤️ Heart Disease | Cholesterol: `275 mg/dL`, BP: `152/94`, Max HR: `122`, ST Dep: `2.6 mm` |
| **`03_healthy_annual_wellness`** | `.pdf`, `.png`, `.txt` | **Healthy Baseline / Executive Checkup** | 🩸 Diabetes / ❤️ Heart | Glucose: `84 mg/dL`, BP: `116/74`, Cholesterol: `165 mg/dL`, BMI: `21.4` |
| **`04_prediabetic_borderline_report`** | `.pdf`, `.png`, `.txt` | **Prediabetic / Borderline Risk** | 🩸 Diabetes | Glucose: `114 mg/dL`, BP: `128/82`, Cholesterol: `218 mg/dL`, BMI: `27.6` |
| **`05_sample_chest_xray.png`** | `.png` | **Chest Radiograph (X-Ray)** | 🩻 Pneumonia | Synthetic lung field radiograph scan |
| **`06_sample_brain_mri.png`** | `.png` | **Cranial MRI Scan** | 🧠 Brain Tumor | Synthetic axial brain MRI slice |

---

## 🛠️ How to Test & Experiment

### 1️⃣ Testing Document OCR in the Web Application
1. Start the app: `python run_app.py`
2. Navigate to the **"Smart Report OCR"** tab in your browser (`http://localhost:8080`).
3. Drag and drop any `.pdf` or `.png` file from this folder into the upload zone (e.g. `01_diabetic_high_risk_panel.pdf`).
4. Click **"Scan & Extract Clinical Parameters"**.
5. Observe the extracted biomarkers, confidence meters, and click **"Apply to Predictor"** to run instant ML predictions.

### 2️⃣ Manually Editing & Modifying Reports
- **Edit the `.txt` files directly**: You can change values like Glucose (`168 mg/dL` ➔ `95 mg/dL`), Cholesterol (`275 mg/dL` ➔ `180 mg/dL`), or Blood Pressure (`142/90` ➔ `120/80`).
- Paste the modified text directly into the **"Document Text / OCR Output"** box in the app to test how changing values affects prediction outcomes!

### 3️⃣ Testing Medical Scans
- Upload `05_sample_chest_xray.png` in the **Pneumonia X-Ray** tab.
- Upload `06_sample_brain_mri.png` in the **Brain Tumor MRI** tab.
