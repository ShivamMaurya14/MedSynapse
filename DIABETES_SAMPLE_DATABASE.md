# Diabetes Sample Feature Database

This development fixture bypasses report upload, OCR, and Gemma. It writes
manually defined synthetic diabetes features directly into a separate SQLite
database for testing the complete feature-store pipeline.

## Feature contract

The sample records use the DPF-free eight-feature database contract:

1. `Pregnancies`
2. `Glucose`
3. `BloodPressure`
4. `SkinThickness`
5. `Insulin`
6. `BMI`
7. `Age`
8. `BMI_Cat`

`BMI_Cat` is validated against `BMI` when the database is seeded. The seeder
then adds `DiabetesPedigreeFunction` as a deterministic synthetic placeholder
for the currently installed legacy nine-feature artifact.

The placeholder DPF is not clinically valid. DPF represents family-history
information and cannot be inferred from the other measurements. It exists only
to test software plumbing with synthetic records.

## Create or refresh the database

```bash
venv/bin/python scripts/seed_diabetes_sample_db.py
```

The command creates `data/diabetes_sample.db` and safely upserts these stable
synthetic IDs:

- `sample-diabetes-low-risk`
- `sample-diabetes-borderline`
- `sample-diabetes-high-risk`

It does not read or modify `data/medsynapse.db`.

## Use the sample database with the backend

```bash
MEDSYNAPSE_DATABASE_PATH=data/diabetes_sample.db \
MEDSYNAPSE_ALLOW_SYNTHETIC_DPF=1 \
venv/bin/uvicorn backend.main:app --reload
```

The database records are ready for feature-store testing and retain
`clinician_approval_status=pending`.

Review and approve a record before inference:

```bash
curl http://127.0.0.1:8000/api/feature-extractions/sample-diabetes-low-risk/review

curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"status":"approved","reviewed_by":"Synthetic Test Clinician","note":"Pipeline test only"}' \
  http://127.0.0.1:8000/api/feature-extractions/sample-diabetes-low-risk/review
```

## Test a seeded record

```bash
curl -X POST \
  http://127.0.0.1:8000/api/predict/diabetes/from-feature-store/sample-diabetes-low-risk
```

Without `MEDSYNAPSE_ALLOW_SYNTHETIC_DPF=1`, the endpoint continues to reject the
legacy DPF-based model. This keeps the approximation disabled by default.

## Enable temporary SHAP pipeline testing

```bash
venv/bin/python scripts/generate_diabetes_test_shap_background.py
```

This creates `models/explainability/diabetes_background_scaled_9.npy` from the
three synthetic sample profiles and adds a `.test-only.json` marker. Generated
explanations explicitly report that their reference background is synthetic.
If the optional `shap` package is unavailable, the nine-feature diabetes path
uses a dependency-free exact interventional Shapley fallback. Installing
`shap>=0.46.0` remains recommended for the permanent training-data workflow.

When the original training dataset is available, replace this array with
50–100 representative training rows transformed by the deployed scaler and
remove `diabetes_background_scaled_9.test-only.json`.

All fixture values are synthetic examples. They are not patient records and
must not be interpreted as diagnostic ground truth.
