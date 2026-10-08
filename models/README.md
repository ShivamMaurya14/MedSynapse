# Model artifact slots

The application already exposes the following future image-model slots:

- `eye_disease.keras` → `POST /api/predict/eye`
- `breast_cancer.keras` → `POST /api/predict/breast-cancer`

Place trained Keras artifacts with these exact filenames in this directory. The
integration accepts binary sigmoid outputs or multiclass outputs. Until an
artifact is present, the endpoint returns HTTP 503 with an explicit missing
artifact message; no prediction is fabricated.

The current frontend labels are provisional defaults. Update the class mapping
in `backend/services/model_service.py` to match the labels used during training.
