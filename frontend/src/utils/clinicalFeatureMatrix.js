/**
 * Clinical Feature Metadata, Reference Ranges & Audit Matrix Helpers
 * Used across MedSynapse for extracting, auditing, and comparing ML features
 * against physician modifications and clinical reference ranges.
 */

export const CLINICAL_FEATURE_DICTIONARY = {
  // Diabetes (PIMA / Clinical Biometrics)
  glucose: {
    displayName: 'Fasting Plasma Glucose',
    category: 'Biochemical / Glycemic',
    unit: 'mg/dL',
    refRange: '70 – 99 mg/dL',
    lowThresh: 70,
    highThresh: 99,
    description: 'Primary biomarker for diabetes screening and hepatic insulin sensitivity.',
  },
  insulin: {
    displayName: 'Fasting Serum Insulin',
    category: 'Endocrine / Pancreatic',
    unit: 'μU/mL',
    refRange: '2.6 – 24.9 μU/mL',
    lowThresh: 2.6,
    highThresh: 24.9,
    description: 'Circulating fasting insulin level; indicates compensatory beta-cell response.',
  },
  bmi: {
    displayName: 'Body Mass Index (BMI)',
    category: 'Anthropometric',
    unit: 'kg/m²',
    refRange: '18.5 – 24.9 kg/m²',
    lowThresh: 18.5,
    highThresh: 24.9,
    description: 'Weight-to-height index; surrogate for general adiposity and peripheral insulin resistance.',
  },
  blood_pressure: {
    displayName: 'Diastolic Blood Pressure',
    category: 'Cardiovascular Hemodynamics',
    unit: 'mm Hg',
    refRange: '60 – 80 mm Hg',
    lowThresh: 60,
    highThresh: 80,
    description: 'Resting diastolic arterial pressure measured by sphygmomanometer.',
  },
  skin_thickness: {
    displayName: 'Triceps Skinfold Thickness',
    category: 'Anthropometric',
    unit: 'mm',
    refRange: '10 – 25 mm',
    lowThresh: 10,
    highThresh: 25,
    description: 'Peripheral subcutaneous fat estimate measured over the triceps brachii muscle.',
  },
  dpf: {
    displayName: 'Diabetes Pedigree Function',
    category: 'Genetic / Hereditary',
    unit: 'score',
    refRange: '0.08 – 0.80',
    lowThresh: 0.08,
    highThresh: 0.80,
    description: 'Genetic score scoring diabetes mellitus history across biological relatives.',
  },
  age: {
    displayName: 'Chronological Age',
    category: 'Demographic',
    unit: 'years',
    refRange: 'Adult (18 – 85)',
    description: 'Patient age in completed calendar years.',
  },
  pregnancies: {
    displayName: 'Obstetric Gravidity (Pregnancies)',
    category: 'Obstetric History',
    unit: 'count',
    refRange: '0 – 15',
    description: 'Number of times pregnant; captures gestational metabolic stress.',
  },
  bmi_cat: {
    displayName: 'BMI Categorical Stratum',
    category: 'Anthropometric Classification',
    unit: 'tier (0-3)',
    refRange: '1 (Normal Weight)',
    description: 'Stratification: 0=Underweight, 1=Normal, 2=Overweight, 3=Obese.',
  },

  // Heart Disease (Cleveland / Hungarian CAD)
  cp: {
    displayName: 'Chest Pain Presentation Type',
    category: 'Symptomatic / Clinical Presentation',
    unit: 'class (0–3)',
    refRange: '0 = Typical, 1 = Atypical, 2 = Non-Anginal, 3 = Asymptomatic',
    description: 'Chest discomfort characteristics categorized according to ACC/AHA guidelines.',
  },
  trestbps: {
    displayName: 'Resting Systolic Blood Pressure',
    category: 'Cardiovascular Hemodynamics',
    unit: 'mm Hg',
    refRange: '90 – 120 mm Hg',
    lowThresh: 90,
    highThresh: 120,
    description: 'Resting systolic arterial pressure upon hospital admission.',
  },
  chol: {
    displayName: 'Total Serum Cholesterol',
    category: 'Lipid Biomarker',
    unit: 'mg/dL',
    refRange: '125 – 200 mg/dL',
    lowThresh: 125,
    highThresh: 200,
    description: 'Total circulating fasting serum cholesterol level.',
  },
  fbs: {
    displayName: 'Fasting Blood Sugar > 120 mg/dL',
    category: 'Glycemic Biomarker',
    unit: 'boolean',
    refRange: '0 = Normal (≤ 120), 1 = Elevated (> 120)',
    description: 'Indicates abnormal fasting blood glucose above 120 mg/dL.',
  },
  restecg: {
    displayName: 'Resting Electrocardiogram (ECG)',
    category: 'Electrophysiological',
    unit: 'pattern (0–2)',
    refRange: '0 = Normal, 1 = ST-T wave wave abnormality, 2 = LVH',
    description: 'Resting 12-lead electrocardiographic waveform analysis.',
  },
  thalach: {
    displayName: 'Maximum Heart Rate Achieved',
    category: 'Exercise Stress Response',
    unit: 'bpm',
    refRange: '120 – 180 bpm',
    description: 'Peak heart rate observed during Bruce protocol exercise treadmill stress test.',
  },
  exang: {
    displayName: 'Exercise Induced Angina',
    category: 'Exercise Stress Response',
    unit: 'boolean',
    refRange: '0 = Negative, 1 = Positive Angina',
    description: 'Ischemic chest discomfort triggered directly during physical exertion.',
  },
  oldpeak: {
    displayName: 'ST Depression Induced by Exercise',
    category: 'Electrocardiographic Ischemia',
    unit: 'mm',
    refRange: '0.0 – 1.0 mm',
    lowThresh: 0,
    highThresh: 1.0,
    description: 'ST-segment depression relative to baseline resting ECG during exercise.',
  },
  slope: {
    displayName: 'Peak Exercise ST Segment Slope',
    category: 'Electrocardiographic Ischemia',
    unit: 'grade (0–2)',
    refRange: '0 = Upsloping, 1 = Flat, 2 = Downsloping',
    description: 'Trajectory orientation of the ST segment at peak cardiac workload.',
  },
  ca: {
    displayName: 'Major Coronary Vessels (Fluoroscopy)',
    category: 'Coronary Angiography',
    unit: 'count (0–3)',
    refRange: '0 Vessels Stenosed',
    description: 'Number of major epicardial coronary vessels showing significant fluoroscopic calcification.',
  },
  thal: {
    displayName: 'Thallium Myocardial Perfusion Scintigraphy',
    category: 'Nuclear Cardiology',
    unit: 'defect code (1–3)',
    refRange: '1 = Normal, 2 = Fixed Defect, 3 = Reversible Defect',
    description: 'Thallium-201 nuclear stress scintigraphy evaluation of myocardial perfusion.',
  },
  sex: {
    displayName: 'Biological Sex',
    category: 'Demographic',
    unit: 'binary',
    refRange: '0 = Female, 1 = Male',
    description: 'Assigned biological sex at birth for epidemiological risk weighting.',
  },

  // Liver Disease (Indian Liver Patient Dataset - ILPD)
  total_bilirubin: {
    displayName: 'Total Serum Bilirubin',
    category: 'Hepatic / Biliary',
    unit: 'mg/dL',
    refRange: '0.2 – 1.2 mg/dL',
    lowThresh: 0.2,
    highThresh: 1.2,
    description: 'Total conjugated and unconjugated bile pigment breakdown products.',
  },
  direct_bilirubin: {
    displayName: 'Direct (Conjugated) Bilirubin',
    category: 'Hepatic / Biliary',
    unit: 'mg/dL',
    refRange: '0.0 – 0.3 mg/dL',
    lowThresh: 0.0,
    highThresh: 0.3,
    description: 'Water-soluble bilirubin processed and conjugated by hepatocytes.',
  },
  alkaline_phosphotase: {
    displayName: 'Alkaline Phosphatase (ALP)',
    category: 'Enzymatic / Cholestatic',
    unit: 'IU/L',
    refRange: '44 – 147 IU/L',
    lowThresh: 44,
    highThresh: 147,
    description: 'Enzyme associated with biliary tract epithelium and osteoblastic activity.',
  },
  alamine_aminotransferase: {
    displayName: 'Alanine Aminotransferase (ALT/SGPT)',
    category: 'Enzymatic / Hepatocellular',
    unit: 'IU/L',
    refRange: '7 – 56 IU/L',
    lowThresh: 7,
    highThresh: 56,
    description: 'Intracellular hepatocellular enzyme; sensitive indicator of acute parenchymal injury.',
  },
  aspartate_aminotransferase: {
    displayName: 'Aspartate Aminotransferase (AST/SGOT)',
    category: 'Enzymatic / Hepatocellular',
    unit: 'IU/L',
    refRange: '10 – 40 IU/L',
    lowThresh: 10,
    highThresh: 40,
    description: 'Mitochondrial and cytoplasmic enzyme found in hepatocytes and cardiac myocytes.',
  },
  total_protiens: {
    displayName: 'Total Serum Proteins',
    category: 'Hepatic Synthetic Function',
    unit: 'g/dL',
    refRange: '6.0 – 8.3 g/dL',
    lowThresh: 6.0,
    highThresh: 8.3,
    description: 'Composite measurement of circulating albumin and globulin fractions.',
  },
  albumin: {
    displayName: 'Serum Albumin',
    category: 'Hepatic Synthetic Function',
    unit: 'g/dL',
    refRange: '3.5 – 5.5 g/dL',
    lowThresh: 3.5,
    highThresh: 5.5,
    description: 'Major plasma protein exclusively synthesized by hepatocytes; reflects long-term liver function.',
  },
  albumin_and_globulin_ratio: {
    displayName: 'Albumin-to-Globulin (A/G) Ratio',
    category: 'Hepatic Synthetic Balance',
    unit: 'ratio',
    refRange: '1.0 – 2.5',
    lowThresh: 1.0,
    highThresh: 2.5,
    description: 'Ratio of serum albumin to total globulin fraction.',
  },
  ag_ratio: {
    displayName: 'Albumin-to-Globulin (A/G) Ratio',
    category: 'Hepatic Synthetic Balance',
    unit: 'ratio',
    refRange: '1.0 – 2.5',
    lowThresh: 1.0,
    highThresh: 2.5,
    description: 'Ratio of serum albumin to total globulin fraction.',
  },
  gender: {
    displayName: 'Biological Gender',
    category: 'Demographic',
    unit: 'category',
    refRange: 'Male / Female',
    description: 'Biological gender of patient.',
  },
};

/**
 * Normalizes input key to human friendly name and clinical metadata
 */
export function getClinicalFeatureMeta(rawKey) {
  if (!rawKey) return { displayName: 'Unknown Parameter', unit: '—', refRange: '—', category: 'General' };
  const cleanKey = String(rawKey).toLowerCase().replace(/[\s-]+/g, '_');
  
  if (CLINICAL_FEATURE_DICTIONARY[cleanKey]) {
    return CLINICAL_FEATURE_DICTIONARY[cleanKey];
  }

  // Breast Cancer FNA parameters (e.g. radius_mean, texture_worst)
  if (cleanKey.includes('radius') || cleanKey.includes('texture') || cleanKey.includes('perimeter') ||
      cleanKey.includes('area') || cleanKey.includes('smoothness') || cleanKey.includes('compactness') ||
      cleanKey.includes('concavity') || cleanKey.includes('concave') || cleanKey.includes('symmetry') ||
      cleanKey.includes('fractal')) {
    const formatted = rawKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return {
      displayName: `${formatted} (FNA Cell Nucleus)`,
      category: 'Cytopathology Morphometry',
      unit: cleanKey.includes('area') ? 'μm²' : cleanKey.includes('radius') || cleanKey.includes('perimeter') ? 'μm' : 'index',
      refRange: 'Nuclear contour standard',
      description: 'Digitized fine needle aspirate nuclear contour geometric measurement.',
    };
  }

  // Fallback humanizer
  const words = rawKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    displayName: words,
    category: 'Clinical Biometric',
    unit: 'units',
    refRange: 'Standard physiological',
    description: `Clinical input parameter for diagnostic assessment.`,
  };
}

/**
 * Assesses whether a numerical value is normal, elevated, or low based on clinical thresholds
 */
export function evaluateBiometricStatus(key, value) {
  const meta = getClinicalFeatureMeta(key);
  if (typeof value !== 'number' || isNaN(value)) {
    return { status: 'Normal', label: 'Recorded', color: '#0f172a', bg: '#f1f5f9' };
  }
  if (meta.highThresh !== undefined && value > meta.highThresh) {
    return { status: 'Elevated', label: 'Elevated ↗', color: '#b91c1c', bg: '#fee2e2' };
  }
  if (meta.lowThresh !== undefined && value < meta.lowThresh) {
    return { status: 'Low', label: 'Low ↘', color: '#b45309', bg: '#fef3c7' };
  }
  return { status: 'Normal', label: 'Normal Range ✓', color: '#15803d', bg: '#dcfce7' };
}

/**
 * Assembles the complete patient feature matrix combining:
 * 1. Original extracted ML inputs
 * 2. Current / doctor-tweaked inputs
 * 3. Clinician rationales
 * 4. SHAP feature impact scores
 */
export function buildPatientFeatureMatrix({
  originalInputs = {},
  currentInputs = {},
  inputReasons = {},
  shapContributions = [],
}) {
  const allKeys = Array.from(new Set([
    ...Object.keys(originalInputs || {}),
    ...Object.keys(currentInputs || {}),
  ])).filter(k => {
    // Filter out image files or binary data representations
    const v = currentInputs[k] !== undefined ? currentInputs[k] : originalInputs[k];
    if (v instanceof Blob || v instanceof File) return false;
    if (typeof v === 'string' && (v.startsWith('data:image/') || v.length > 300)) return false;
    if (['file', 'preview', 'image', 'image_url', 'image_preview', 'previewUrl'].includes(k)) return false;
    return true;
  });

  // Map SHAP lookup by clean feature name
  const shapMap = {};
  (shapContributions || []).forEach(item => {
    if (!item) return;
    const feat = String(item.feature || '').toLowerCase().replace(/[\s_-]+/g, '');
    shapMap[feat] = {
      shapValue: typeof item.shap_value === 'number' ? item.shap_value : parseFloat(item.shap_value || 0),
      effect: item.effect || '',
      patientValue: item.patient_value,
    };
  });

  return allKeys.map(key => {
    const meta = getClinicalFeatureMeta(key);
    const origVal = originalInputs[key];
    const currVal = currentInputs[key] !== undefined ? currentInputs[key] : origVal;
    const isTweaked = origVal !== undefined && String(currVal) !== String(origVal);
    const reason = inputReasons[key] || (isTweaked ? 'Physician clinical parameter override' : null);

    // Look for matching SHAP
    const cleanK = key.toLowerCase().replace(/[\s_-]+/g, '');
    const shapData = shapMap[cleanK] || shapMap[key.toLowerCase()] || null;
    const statusEval = evaluateBiometricStatus(key, typeof currVal === 'number' ? currVal : parseFloat(currVal));

    return {
      key,
      displayName: meta.displayName,
      category: meta.category,
      unit: meta.unit,
      refRange: meta.refRange,
      description: meta.description,
      originalValue: origVal !== undefined ? origVal : '—',
      currentValue: currVal !== undefined ? currVal : '—',
      isTweaked,
      doctorReason: reason,
      shapValue: shapData ? shapData.shapValue : null,
      shapEffect: shapData ? shapData.effect : null,
      status: statusEval,
    };
  });
}
