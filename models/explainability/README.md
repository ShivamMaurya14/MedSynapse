# Explainability reference backgrounds

SHAP needs a fixed, de-identified reference cohort. Do not construct it from a
single patient at prediction time.

Export these arrays during model training and keep their feature order exactly
aligned with the prediction pipeline:

- `diabetes_background_scaled_9.npy`: 50–100 stratified, de-identified diabetes
  training rows after the deployed legacy nine-feature scaler. Order: `Pregnancies`, `Glucose`,
  `BloodPressure`, `SkinThickness`, `Insulin`, `BMI`,
  `DiabetesPedigreeFunction`, `Age`, `BMI_Cat`.
- `diabetes_background_scaled_8.npy`: the same kind of cohort for the future
  DPF-free eight-feature diabetes artifact, omitting `DiabetesPedigreeFunction`.
- `breast_background_raw.npy`: 50–100 stratified, de-identified WDBC rows in
  the original 30-feature order from `BREAST_FEATURE_ORDER`, before scaling
  and PCA.

The API returns an explicit `explainability.status: unavailable` response until
these artifacts and the `shap` dependency are present. It never fabricates a
patient explanation.
