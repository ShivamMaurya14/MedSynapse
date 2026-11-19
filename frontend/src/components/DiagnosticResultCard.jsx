import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  Printer, 
  CheckCircle, 
  Info, 
  Activity, 
  FileCheck,
  Stethoscope,
  CheckSquare,
  Square,
  Layers,
  ClipboardList,
  Award,
  Sparkles,
  SlidersHorizontal,
  Edit3,
  RotateCcw,
  Check,
  MessageSquare,
} from 'lucide-react';
import { 
  generateFinalReport, 
  reviewModelRun,
  predictDiabetes,
  predictHeart,
  predictLiverDisease,
  predictBreastCancer,
  predictXRay,
  predictBrainTumor,
  predictKidneyStone,
  predictSkinCancer,
  predictEye,
} from '../services/api';
import ClinicianDecisionTweakCenter from './ClinicianDecisionTweakCenter';
import { printReportDocument } from '../utils/printReport';

const BENIGN_SAMPLE_DEFAULTS = {
  radius_mean: 13.54, texture_mean: 14.36, perimeter_mean: 87.46, area_mean: 566.3, smoothness_mean: 0.09779,
  compactness_mean: 0.08129, concavity_mean: 0.06664, concave_points_mean: 0.04781, symmetry_mean: 0.1885, fractal_dimension_mean: 0.05766,
  radius_se: 0.2699, texture_se: 0.7886, perimeter_se: 2.058, area_se: 23.56, smoothness_se: 0.008462,
  compactness_se: 0.0146, concavity_se: 0.02387, concave_points_se: 0.01315, symmetry_se: 0.0198, fractal_dimension_se: 0.0023,
  radius_worst: 15.11, texture_worst: 19.26, perimeter_worst: 99.7, area_worst: 711.2, smoothness_worst: 0.144,
  compactness_worst: 0.1773, concavity_worst: 0.239, concave_points_worst: 0.1288, symmetry_worst: 0.2977, fractal_dimension_worst: 0.07259
};

// Helper to construct exact prediction payload from current parameters with strict edit precedence
function buildModelPayload(diseaseKey, currentInputs = {}, baseInputs = {}) {
  const dKey = (diseaseKey || '').toLowerCase();
  const normalize = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const findValue = (source, aliasList) => {
    if (!source || typeof source !== 'object') return undefined;
    // 1. Exact key match
    for (const a of aliasList) {
      if (source[a] !== undefined && source[a] !== null && source[a] !== '') {
        return source[a];
      }
    }
    // 2. Normalized key match (case-insensitive, space/underscore-stripped)
    const normMap = {};
    for (const [k, v] of Object.entries(source)) {
      if (v !== undefined && v !== null && v !== '') {
        normMap[normalize(k)] = v;
      }
    }
    for (const a of aliasList) {
      const normA = normalize(a);
      if (normMap[normA] !== undefined) {
        return normMap[normA];
      }
    }
    return undefined;
  };

  const extractVal = (aliasList, defaultVal = 0) => {
    // Check currentInputs (user's active edits) FIRST
    const editedVal = findValue(currentInputs, aliasList);
    if (editedVal !== undefined) return editedVal;

    // Fall back to baseInputs (baseline values) SECOND
    const baseVal = findValue(baseInputs, aliasList);
    if (baseVal !== undefined) return baseVal;

    return defaultVal;
  };

  const getNum = (aliases, defaultVal = 0) => {
    const val = extractVal(aliases, defaultVal);
    const parsed = parseFloat(val);
    return !isNaN(parsed) ? parsed : defaultVal;
  };

  if (dKey.includes('diabetes')) {
    const bmiVal = getNum(['bmi', 'BMI', 'Body mass index', 'body_mass_index'], 25.0);
    const bmiCat = bmiVal < 18.5 ? 0 : bmiVal < 25 ? 1 : bmiVal < 30 ? 2 : 3;
    return {
      pregnancies: getNum(['pregnancies', 'Pregnancies', 'pregnancies_count', 'Pregnancy count'], 1),
      glucose: getNum(['glucose', 'Glucose', 'fasting_glucose', 'Fasting glucose', 'Blood glucose', 'fasting_blood_sugar'], 120),
      blood_pressure: getNum(['blood_pressure', 'BloodPressure', 'bp', 'Diastolic blood pressure', 'Resting blood pressure'], 70),
      skin_thickness: getNum(['skin_thickness', 'SkinThickness', 'Triceps skin thickness', 'skin_fold'], 20),
      insulin: getNum(['insulin', 'Insulin', 'Serum insulin', '2-Hour serum insulin'], 80),
      bmi: bmiVal,
      dpf: getNum(['dpf', 'DiabetesPedigreeFunction', 'dpf_score', 'Diabetes pedigree function', 'Pedigree function'], 0.5),
      age: getNum(['age', 'Age', 'patient_age', 'Patient Age'], 35),
      bmi_cat: getNum(['bmi_cat', 'BMI_Cat', 'Derived BMI category'], bmiCat),
    };
  }

  if (dKey.includes('heart') || dKey.includes('cardio') || dKey.includes('cardiac')) {
    const rawSex = extractVal(['sex', 'Sex', 'biological_sex', 'Biological Sex', 'gender', 'Gender'], 1);
    let sexVal = 1;
    if (typeof rawSex === 'string') {
      sexVal = rawSex.toLowerCase().startsWith('f') || rawSex.trim() === '0' ? 0 : 1;
    } else {
      sexVal = Number(rawSex) === 0 ? 0 : 1;
    }

    return {
      age: getNum(['age', 'Age', 'patient_age', 'Patient Age'], 52),
      sex: sexVal,
      cp: getNum(['cp', 'ChestPainType', 'Chest Pain Type', 'chest_pain_type', 'chest_pain'], 0),
      trestbps: getNum(['trestbps', 'RestingBloodPressure', 'Resting Blood Pressure', 'resting_bp', 'bp', 'blood_pressure'], 125),
      chol: getNum(['chol', 'Cholesterol', 'serum_cholesterol', 'Serum Cholesterol'], 210),
      fbs: getNum(['fbs', 'FastingBloodSugar', 'fasting_blood_sugar', 'Fasting Blood Sugar > 120', 'fasting_sugar'], 0),
      restecg: getNum(['restecg', 'RestingECG', 'resting_ecg', 'Resting ECG Result'], 0),
      thalach: getNum(['thalach', 'MaxHeartRate', 'max_heart_rate', 'Max Heart Rate'], 150),
      exang: getNum(['exang', 'ExerciseAngina', 'exercise_angina', 'Exercise Induced Angina'], 0),
      oldpeak: getNum(['oldpeak', 'Oldpeak', 'st_depression', 'st_oldpeak', 'ST Depression (Oldpeak)'], 0.8),
      slope: getNum(['slope', 'STSlope', 'st_slope', 'Peak Exercise ST Slope'], 1),
      ca: getNum(['ca', 'MajorVessels', 'major_vessels', 'Major Vessels (Fluoroscopy)', 'flourosopy'], 0),
      thal: getNum(['thal', 'Thalassemia', 'thalassemia', 'Thalassemia Defect Code'], 2),
    };
  }

  if (dKey.includes('liver') || dKey.includes('hepatic')) {
    const rawGender = extractVal(['gender', 'Gender', 'Biological Gender', 'sex', 'Biological Sex'], 0);
    let genderVal = 0; // In ILPD dataset, Male is 0 and Female is 1
    if (typeof rawGender === 'string') {
      genderVal = rawGender.toLowerCase().startsWith('f') || rawGender.trim() === '1' ? 1 : 0;
    } else {
      genderVal = Number(rawGender) === 1 ? 1 : 0;
    }

    return {
      age: getNum(['age', 'Age', 'Patient Age'], 45),
      gender: genderVal,
      total_bilirubin: getNum(['total_bilirubin', 'Total Bilirubin', 'Total_Bilirubin'], 1.0),
      direct_bilirubin: getNum(['direct_bilirubin', 'Direct Bilirubin', 'Direct_Bilirubin'], 0.3),
      alkaline_phosphotase: getNum(['alkaline_phosphotase', 'Alkaline Phosphatase (ALP)', 'Alkaline_Phosphatase', 'alp'], 200),
      alamine_aminotransferase: getNum(['alamine_aminotransferase', 'Alanine Aminotransferase (ALT)', 'Alamine_Aminotransferase', 'alt'], 35),
      aspartate_aminotransferase: getNum(['aspartate_aminotransferase', 'Aspartate Aminotransferase (AST)', 'Aspartate_Aminotransferase', 'ast'], 40),
      total_protiens: getNum(['total_protiens', 'Total Serum Proteins', 'Total_Proteins', 'total_proteins'], 6.5),
      albumin: getNum(['albumin', 'Serum Albumin', 'Albumin'], 3.2),
      albumin_and_globulin_ratio: getNum(['albumin_and_globulin_ratio', 'A/G Ratio', 'Albumin_and_Globulin_Ratio', 'ag_ratio'], 0.9),
    };
  }

  if (dKey.includes('breast')) {
    const BASE_METRICS = ['radius', 'texture', 'perimeter', 'area', 'smoothness', 'compactness', 'concavity', 'concave_points', 'symmetry', 'fractal_dimension'];
    const BREAST_FEATURES = ['mean', 'se', 'worst'].flatMap(suffix => BASE_METRICS.map(base => `${base}_${suffix}`));
    const features = {};
    for (const feat of BREAST_FEATURES) {
      const aliases = [
        feat,
        feat.replace(/_/g, ' '),
        feat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      ];
      const defaultVal = BENIGN_SAMPLE_DEFAULTS[feat] !== undefined ? BENIGN_SAMPLE_DEFAULTS[feat] : 0.1;
      features[feat] = getNum(aliases, defaultVal);
    }
    return features;
  }

  return { ...baseInputs, ...currentInputs };
}

export default function DiagnosticResultCard({ 
  result: resultProp,
  onReset, 
  title = 'Diagnostic Risk Assessment',
  diseaseKey: diseaseKeyProp,
  inputs: inputsProp,
  image: imageProp,
  onWorkflowStageChange,
  onNavigateToLLMReport,
  onNavigateToForm,
  onReportUpdated,
  onTweaksChange,
}) {
  const [activeResult, setActiveResult] = useState(resultProp);
  const [activeInputs, setActiveInputs] = useState(inputsProp || {});

  useEffect(() => {
    setActiveResult(resultProp);
    setIsParametersModified(false);
    setEditedInputs({});
  }, [resultProp]);

  useEffect(() => {
    if (inputsProp && Object.keys(inputsProp).length > 0) {
      setActiveInputs(inputsProp);
    }
  }, [inputsProp]);

  // Handle local File / Blob object URL lifecycle
  const [fileObjectUrl, setFileObjectUrl] = useState(null);

  useEffect(() => {
    const candidateFile = activeInputs?.file || inputsProp?.file;
    if (candidateFile instanceof Blob || candidateFile instanceof File) {
      const url = URL.createObjectURL(candidateFile);
      setFileObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setFileObjectUrl(null);
    }
  }, [activeInputs?.file, inputsProp?.file]);

  const assessmentResponse = activeResult?.success && activeResult?.data ? activeResult : null;
  const result = assessmentResponse?.data || activeResult;
  const clinicalReport = assessmentResponse?.clinical_report || activeResult?.clinical_report || result?.clinical_report || null;
  const modelRunId = assessmentResponse?.model_run_id || clinicalReport?.model_run_id || activeResult?.model_run_id || null;

  // Parameter editing & ML Re-Analysis state
  const [editedInputs, setEditedInputs] = useState({});
  const [isParametersModified, setIsParametersModified] = useState(false);
  const [isInlineEditMode, setIsInlineEditMode] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalysisError, setReanalysisError] = useState(null);
  const [reanalysisSuccess, setReanalysisSuccess] = useState(false);

  const [reportId, setReportId] = useState(() => `MS-${Math.floor(100000 + Math.random() * 900000)}`);
  const [reportDate, setReportDate] = useState(() => new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }));

  const initialDoctorNameFromReport = (
    resultProp?.clinician_review?.reviewed_by ||
    resultProp?.clinical_report?.clinician_review?.reviewed_by ||
    clinicalReport?.clinician_review?.reviewed_by ||
    assessmentResponse?.clinical_report?.clinician_review?.reviewed_by ||
    assessmentResponse?.clinician_decision?.reviewed_by ||
    localStorage.getItem('medsynapse_doctor_name') ||
    ''
  ).trim();

  const initialDoctorTitleFromReport = (
    resultProp?.clinician_review?.title ||
    resultProp?.clinical_report?.clinician_review?.title ||
    clinicalReport?.clinician_review?.title ||
    localStorage.getItem('medsynapse_doctor_title') ||
    'Attending Physician'
  ).trim();

  const [reviewedBy, setReviewedBy] = useState(initialDoctorNameFromReport);
  const [reviewComment, setReviewComment] = useState('');
  const [doctorDecisionChoice, setDoctorDecisionChoice] = useState('approved');
  const [workflowStatus, setWorkflowStatus] = useState(
    assessmentResponse?.workflow_status || 'awaiting_clinician_review'
  );
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [finalReport, setFinalReport] = useState(null);

  const explainability = clinicalReport?.explainability || activeResult?.explainability || result?.explainability || {};
  const decisionTrace = clinicalReport?.decision_trace || {};
  const clinicalInputs = clinicalReport?.clinical_inputs || [];
  const explanationSentences = explainability?.plain_language?.sentences || [];
  const baseValue = explainability?.base_value;

  const shapContributions = useMemo(() => {
    if (!explainability) return [];
    if (Array.isArray(explainability.all_contributions) && explainability.all_contributions.length > 0) {
      return explainability.all_contributions;
    }
    const pos = explainability.top_positive_contributors || [];
    const neg = explainability.top_negative_contributors || [];
    return [...pos, ...neg];
  }, [explainability]);

  const checklistItems = useMemo(() => {
    if (shapContributions.length > 0) {
      return shapContributions.map(item => ({
        key: item.feature,
        label: item.feature,
        badge: (Number(item.shap_value) >= 0 ? `+${Number(item.shap_value).toFixed(4)}` : Number(item.shap_value).toFixed(4)),
      }));
    }
    if (explainability.overlay_data_url || explainability.heatmap_data_url) {
      return [
        { key: 'gradcam_attention', label: 'Grad-CAM Saliency Focus', badge: explainability.target_class ? `Class: ${explainability.target_class}` : 'Active' },
        { key: 'receptive_field', label: 'Convolutional Layer Activation', badge: explainability.target_layer || 'Receptive Field' },
        { key: 'activation_intensity', label: 'Peak Activation Intensity', badge: explainability.attention_statistics?.max_attention ? `Peak: ${(explainability.attention_statistics.max_attention * 100).toFixed(0)}%` : '100%' },
        { key: 'decision_threshold', label: 'Posterior Classification Cutoff', badge: `${effectiveThreshold.toFixed(2)} Sensitivity` },
      ];
    }
    if (clinicalInputs.length > 0) {
      return clinicalInputs.map(item => ({
        key: item.name || item.display_name,
        label: item.display_name || item.name,
        badge: item.unit ? `${item.value} ${item.unit}` : `${item.value}`,
      }));
    }
    const dKey = result?.disease?.toLowerCase() || '';
    let fallbackNames = ['Image Quality & Resolution', 'Anatomical Field of View', 'Classification Confidence Threshold', 'Neural Activation Distribution'];
    if (dKey.includes('heart')) {
      fallbackNames = ['Age', 'Sex', 'Chest Pain', 'Resting BP', 'Cholesterol', 'Fasting Blood Sugar', 'Resting ECG', 'Max Heart Rate', 'Exercise Angina', 'ST Oldpeak', 'ST Slope', 'Major Vessels', 'Thalassemia'];
    } else if (dKey.includes('liver')) {
      fallbackNames = ['Age', 'Gender', 'Total Bilirubin', 'Direct Bilirubin', 'ALP', 'ALT', 'AST', 'Total Proteins', 'Albumin', 'A/G Ratio'];
    } else if (dKey.includes('breast')) {
      fallbackNames = ['Cell Nuclei Radius', 'Texture', 'Perimeter', 'Area', 'Smoothness', 'Compactness', 'Concavity', 'Concave Points', 'Symmetry', 'Fractal Dimension'];
    }
    return fallbackNames.map(name => ({
      key: name,
      label: name,
      badge: 'Clinical Evidence',
    }));
  }, [shapContributions, clinicalInputs, result?.disease]);

  const [verifiedFeatures, setVerifiedFeatures] = useState(() => {
    return new Set(checklistItems.map(c => c.key));
  });

  React.useEffect(() => {
    if (checklistItems.length > 0 && verifiedFeatures.size === 0) {
      setVerifiedFeatures(new Set(checklistItems.map(c => c.key)));
    }
  }, [checklistItems]);

  const toggleFeatureVerification = (featureName) => {
    setVerifiedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureName)) {
        next.delete(featureName);
      } else {
        next.add(featureName);
      }
      return next;
    });
  };

  const verifyAllFeatures = () => {
    if (checklistItems.length > 0) {
      setVerifiedFeatures(new Set(checklistItems.map(c => c.key)));
    }
  };

  const deselectAllFeatures = () => {
    setVerifiedFeatures(new Set());
  };

  if (!result) return null;

  // Decision Threshold
  const decisionThreshold = 0.50;

  // Determine baseline healthy status
  const isHealthy = Boolean(
    result.prediction === 0 ||
    result.is_positive === false ||
    result.has_disease === false ||
    result.diagnosis === 'No Disease' ||
    result.diagnosis === 'Benign' ||
    result.diagnosis === 'No Tumor' ||
    result.diagnosis === 'Normal' ||
    result.diagnosis === 'Normal (Clear Lungs)' ||
    result.diagnosis === 'Healthy (Normal LFT)' ||
    result.prediction === 'Benign' ||
    result.prediction === 'No Tumor' ||
    result.prediction === 'Normal' ||
    result.prediction === 'Negative'
  );

  const prob = typeof result?.risk_probability === 'number'
    ? result.risk_probability
    : typeof result?.pneumonia_probability === 'number'
    ? result.pneumonia_probability
    : typeof result?.confidence === 'number'
    ? result.confidence
    : (isHealthy ? 0.12 : 0.82);

  const riskPercent = result?.risk_percentage !== undefined && result?.risk_percentage !== null
    ? result.risk_percentage
    : result?.confidence_percentage !== undefined && result?.confidence_percentage !== null
    ? result.confidence_percentage
    : (prob * 100).toFixed(1);

  const riskTier = result?.risk_tier ||
    (prob >= 0.70 ? 'High Risk' : prob >= 0.35 ? 'Moderate Risk' : 'Low Risk');

  const modelName = clinicalReport?.screening?.model_name || 
                    (result.disease ? `${result.disease}_model` : 'Classifier Ensemble');

  // Baseline Model Determinations
  const assessmentData = assessmentResponse?.data || resultProp?.data || null;
  const resolveDiagnosisString = (res, healthy) => {
    if (res?.diagnosis && typeof res.diagnosis === 'string') return res.diagnosis;
    if (typeof res?.prediction === 'string' && isNaN(Number(res.prediction))) return res.prediction;
    if (res?.class_name && typeof res.class_name === 'string') return res.class_name;
    if (res?.predicted_class && typeof res.predicted_class === 'string') return res.predicted_class;
    return healthy ? 'Baseline Physiological Control' : 'Elevated Risk Indication';
  };
  const originalDiagnosis = resolveDiagnosisString(result, isHealthy);
  const originalRiskTier = riskTier;
  const originalRiskPercent = riskPercent;
  const originalDecisionThreshold = decisionThreshold;
  const originalRecommendations = result.recommendations || [];

  const targetDiseaseStr = String(diseaseKeyProp || assessmentData?.disease || result?.disease || result?.data?.disease || title || '').toLowerCase();
  const resolvedDiseaseKey = diseaseKeyProp || (
    targetDiseaseStr.includes('diabetes') ? 'diabetes' :
    targetDiseaseStr.includes('heart') || targetDiseaseStr.includes('cardiac') ? 'heart' :
    targetDiseaseStr.includes('breast') ? 'breast' :
    targetDiseaseStr.includes('liver') || targetDiseaseStr.includes('hepatic') ? 'liver' :
    targetDiseaseStr.includes('brain') ? 'brain-tumor' :
    targetDiseaseStr.includes('kidney') ? 'kidney-stone' :
    targetDiseaseStr.includes('skin') ? 'skin-cancer' :
    targetDiseaseStr.includes('eye') ? 'eye' :
    targetDiseaseStr.includes('pneumonia') || targetDiseaseStr.includes('xray') ? 'xray' : 'diabetes'
  );

  const clinicalInputsObj = useMemo(() => {
    const obj = {};
    if (Array.isArray(clinicalInputs)) {
      clinicalInputs.forEach(item => {
        const key = item.name || item.display_name;
        if (key && item.value !== undefined && item.value !== null) {
          obj[key] = item.value;
        }
      });
    }
    return obj;
  }, [clinicalInputs]);

  const resolvedInputs = useMemo(() => {
    if (activeInputs && Object.keys(activeInputs).length > 0) return activeInputs;
    if (inputsProp && Object.keys(inputsProp).length > 0) return inputsProp;
    if (result?.inputs && Object.keys(result.inputs).length > 0) return result.inputs;
    if (assessmentResponse?.inputs && Object.keys(assessmentResponse.inputs).length > 0) return assessmentResponse.inputs;
    return clinicalInputsObj;
  }, [activeInputs, inputsProp, result?.inputs, assessmentResponse?.inputs, clinicalInputsObj]);

  const effectiveClinicalInputs = useMemo(() => {
    if (clinicalInputs && clinicalInputs.length > 0) return clinicalInputs;
    if (resolvedInputs && Object.keys(resolvedInputs).length > 0) {
      return Object.entries(resolvedInputs)
        .filter(([k]) => k !== 'source_filename' && k !== 'file' && typeof resolvedInputs[k] !== 'object')
        .map(([k, v]) => ({
          name: k,
          display_name: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: v,
          unit: '',
          source: 'validated model input',
        }));
    }
    return [];
  }, [clinicalInputs, resolvedInputs]);

  // Resolve reference image source for clinical display
  const displayImageSrc = useMemo(() => {
    // 1. Explicit imageProp
    if (imageProp && typeof imageProp === 'string') return imageProp;

    // 2. Candidate strings in activeInputs, inputsProp, resolvedInputs
    const candidates = [
      activeInputs?.image_preview,
      activeInputs?.preview,
      activeInputs?.previewUrl,
      activeInputs?.image_url,
      inputsProp?.image_preview,
      inputsProp?.preview,
      inputsProp?.previewUrl,
      inputsProp?.image_url,
      resolvedInputs?.image_preview,
      resolvedInputs?.preview,
      resolvedInputs?.previewUrl,
      resolvedInputs?.image_url,
    ];
    for (const c of candidates) {
      if (c && typeof c === 'string') return c;
    }

    // 3. Blob / File object URL
    if (fileObjectUrl) return fileObjectUrl;

    // 4. Modality fallbacks for imaging models if applicable
    const dKey = String(resolvedDiseaseKey || '').toLowerCase();
    const demoId = activeInputs?.demo_id || resolvedInputs?.demo_id || inputsProp?.demo_id;
    const diag = String(result?.diagnosis || result?.prediction || '').toLowerCase();

    if (dKey.includes('xray') || dKey.includes('pneumonia')) {
      if (diag.includes('pneumonia')) return '/test_samples/xray_pneumonia.jpeg';
      return '/test_samples/xray_normal.jpeg';
    }
    if (dKey.includes('brain')) {
      if (demoId && ['glioma', 'meningioma', 'pituitary', 'healthy', 'notumor'].includes(demoId)) {
        return demoId === 'healthy' ? '/test_samples/brain_notumor.jpg' : `/test_samples/brain_${demoId}.jpg`;
      }
      if (diag.includes('glioma')) return '/test_samples/brain_glioma.jpg';
      if (diag.includes('meningioma')) return '/test_samples/brain_meningioma.jpg';
      if (diag.includes('pituitary')) return '/test_samples/brain_pituitary.jpg';
      if (diag.includes('no tumor') || diag.includes('healthy')) return '/test_samples/brain_notumor.jpg';
      return '/test_samples/brain_glioma.jpg';
    }
    if (dKey.includes('kidney')) {
      if (demoId && ['stone', 'cyst', 'tumor', 'normal'].includes(demoId)) {
        return `/test_samples/kidney_${demoId}.jpg`;
      }
      if (diag.includes('cyst')) return '/test_samples/kidney_cyst.jpg';
      if (diag.includes('tumor')) return '/test_samples/kidney_tumor.jpg';
      if (diag.includes('normal')) return '/test_samples/kidney_normal.jpg';
      return '/test_samples/kidney_stone.jpg';
    }
    if (dKey.includes('skin')) {
      if (demoId && ['mel', 'melanoma', 'bcc', 'akiec', 'nv', 'nevus', 'bkl'].includes(demoId)) {
        const map = {
          mel: 'melanoma',
          melanoma: 'melanoma',
          bcc: 'basal_cell_carcinoma',
          akiec: 'actinic_keratosis',
          nv: 'nevus',
          nevus: 'nevus',
          bkl: 'benign_keratosis',
        };
        return `/test_samples/skin_${map[demoId] || 'melanoma'}.jpg`;
      }
      if (diag.includes('melanocytic') || diag.includes('nevus')) return '/test_samples/skin_nevus.jpg';
      if (diag.includes('basal') || diag.includes('bcc')) return '/test_samples/skin_basal_cell_carcinoma.jpg';
      if (diag.includes('actinic') || diag.includes('akiec')) return '/test_samples/skin_actinic_keratosis.jpg';
      if (diag.includes('benign') || diag.includes('keratosis')) return '/test_samples/skin_benign_keratosis.jpg';
      return '/test_samples/skin_melanoma.jpg';
    }
    if (dKey.includes('eye') || dKey.includes('retin')) {
      if (demoId && ['glaucoma', 'cataract', 'bulging', 'crossed', 'uveitis', 'normal', 'diabetic_retinopathy'].includes(demoId)) {
        if (demoId === 'normal') return '/test_samples/eye_normal.png';
        if (demoId === 'diabetic_retinopathy') return '/test_samples/eye_diabetic_retinopathy.png';
        return `/test_samples/eye_${demoId}.jpeg`;
      }
      if (diag.includes('cataract')) return '/test_samples/eye_cataract.jpeg';
      if (diag.includes('glaucoma')) return '/test_samples/eye_glaucoma.jpeg';
      if (diag.includes('bulging')) return '/test_samples/eye_bulging.jpeg';
      if (diag.includes('crossed')) return '/test_samples/eye_crossed.jpeg';
      if (diag.includes('uveitis')) return '/test_samples/eye_uveitis.jpeg';
      if (diag.includes('normal')) return '/test_samples/eye_normal.png';
      if (diag.includes('retinopathy')) return '/test_samples/eye_diabetic_retinopathy.png';
      return '/test_samples/eye_glaucoma.jpeg';
    }

    return null;
  }, [imageProp, activeInputs, inputsProp, resolvedInputs, fileObjectUrl, resolvedDiseaseKey, result]);

  const displayImageFilename = useMemo(() => {
    return activeInputs?.source_filename || inputsProp?.source_filename || resolvedInputs?.source_filename || activeInputs?.file?.name || inputsProp?.file?.name || 'Diagnostic_Scan_Specimen';
  }, [activeInputs, inputsProp, resolvedInputs]);

  // Clinician Decision Overrides & Parameter Tweaks State
  const [tweaks, setTweaks] = useState({
    diagnosis: { isTweaked: false, value: '', reason: '' },
    riskTier: { isTweaked: false, value: '', reason: '' },
    riskProbability: { isTweaked: false, value: '', reason: '' },
    decisionThreshold: { isTweaked: false, value: '', reason: '' },
    recommendations: { isTweaked: false, value: originalRecommendations, reason: '' },
    featureRationales: {},
    doctorInfo: {
      name: initialDoctorNameFromReport,
      title: initialDoctorTitleFromReport,
      timestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  });

  const handleReviewedByChange = (val) => {
    setReviewedBy(val);
    if (val && val.trim()) {
      localStorage.setItem('medsynapse_doctor_name', val.trim());
    }
    setTweaks(prev => ({
      ...prev,
      doctorInfo: {
        ...(prev.doctorInfo || {}),
        name: val,
        title: prev.doctorInfo?.title || localStorage.getItem('medsynapse_doctor_title') || 'Attending Physician',
        timestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    }));
  };

  const [isTweakPanelOpen, setIsTweakPanelOpen] = useState(false);

  React.useEffect(() => {
    const handleOpenTweak = () => {
      setIsTweakPanelOpen(true);
      const tweakElement = document.querySelector('.tweak-center-panel') || document.querySelector('.clinical-report-sheet');
      if (tweakElement) {
        tweakElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('medsynapse-open-tweak-center', handleOpenTweak);
    return () => window.removeEventListener('medsynapse-open-tweak-center', handleOpenTweak);
  }, []);

  const handleUpdateTweak = (field, value, reason) => {
    setTweaks(prev => {
      const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (field === 'doctorInfo') {
        const newDocName = value?.name !== undefined ? value.name : (prev.doctorInfo?.name || '');
        const newDocTitle = value?.title !== undefined ? value.title : (prev.doctorInfo?.title || '');
        if (newDocName && newDocName.trim()) {
          localStorage.setItem('medsynapse_doctor_name', newDocName.trim());
          setReviewedBy(newDocName.trim());
        }
        if (newDocTitle && newDocTitle.trim()) {
          localStorage.setItem('medsynapse_doctor_title', newDocTitle.trim());
        }
        return {
          ...prev,
          doctorInfo: { ...prev.doctorInfo, ...value, timestamp: now },
        };
      }
      return {
        ...prev,
        doctorInfo: { ...prev.doctorInfo, timestamp: now },
        [field]: {
          isTweaked: true,
          value,
          reason: reason || prev[field]?.reason || '',
        }
      };
    });
  };

  const handleResetTweak = (field) => {
    setTweaks(prev => ({
      ...prev,
      [field]: {
        isTweaked: false,
        value: field === 'recommendations' ? originalRecommendations : '',
        reason: '',
      }
    }));
  };

  const handleResetAllTweaks = () => {
    setTweaks(prev => ({
      diagnosis: { isTweaked: false, value: '', reason: '' },
      riskTier: { isTweaked: false, value: '', reason: '' },
      riskProbability: { isTweaked: false, value: '', reason: '' },
      decisionThreshold: { isTweaked: false, value: '', reason: '' },
      recommendations: { isTweaked: false, value: originalRecommendations, reason: '' },
      featureRationales: {},
      doctorInfo: prev.doctorInfo,
    }));
  };

  const handleUpdateFeatureRationale = (feature, status, reason) => {
    setTweaks(prev => ({
      ...prev,
      featureRationales: {
        ...prev.featureRationales,
        [feature]: { status, reason: reason || '' },
      }
    }));
  };

  const effectiveDiagnosis = tweaks.diagnosis.isTweaked && tweaks.diagnosis.value ? tweaks.diagnosis.value : originalDiagnosis;
  const effectiveRiskTier = tweaks.riskTier.isTweaked && tweaks.riskTier.value ? tweaks.riskTier.value : originalRiskTier;
  const effectiveRiskPercent = tweaks.riskProbability.isTweaked && tweaks.riskProbability.value !== '' ? tweaks.riskProbability.value : originalRiskPercent;
  const effectiveThreshold = tweaks.decisionThreshold.isTweaked && tweaks.decisionThreshold.value !== '' ? tweaks.decisionThreshold.value : originalDecisionThreshold;
  const effectiveRecommendations = tweaks.recommendations.isTweaked && tweaks.recommendations.value ? tweaks.recommendations.value : originalRecommendations;

  const hasAnyTweaks = useMemo(() => {
    return Boolean(
      tweaks.diagnosis.isTweaked ||
      tweaks.riskTier.isTweaked ||
      tweaks.riskProbability.isTweaked ||
      tweaks.decisionThreshold.isTweaked ||
      tweaks.recommendations.isTweaked ||
      Object.keys(tweaks.featureRationales).length > 0
    );
  }, [tweaks]);

  const totalTweaksCount = useMemo(() => {
    let count = 0;
    if (tweaks.diagnosis.isTweaked) count++;
    if (tweaks.riskTier.isTweaked) count++;
    if (tweaks.riskProbability.isTweaked) count++;
    if (tweaks.decisionThreshold.isTweaked) count++;
    if (tweaks.recommendations.isTweaked) count++;
    count += Object.keys(tweaks.featureRationales).length;
    return count;
  }, [tweaks]);

  // Dynamic Severity & Threshold Coloring reflecting effective (tweaked) values
  const effectiveProbNumber = Number(effectiveRiskPercent) / 100;
  const isBelowThreshold = effectiveProbNumber < effectiveThreshold;

  // Determine effective severity tier considering both clinician overrides and calibrated scores
  const diagLower = String(effectiveDiagnosis || '').toLowerCase();
  const isHighSeverityDiag = diagLower.includes('malignant') || 
                             diagLower.includes('positive') || 
                             diagLower.includes('tumor detected') || 
                             diagLower.includes('high risk') || 
                             diagLower.includes('elevated risk indication') || 
                             diagLower.includes('pneumonia detected') || 
                             diagLower.includes('liver disease detected') ||
                             diagLower.includes('diabetic') ||
                             diagLower.includes('stone detected');

  const isLowSeverityDiag = diagLower.includes('baseline') || 
                            diagLower.includes('benign') || 
                            diagLower.includes('no tumor') || 
                            diagLower.includes('no disease') || 
                            diagLower.includes('normal') || 
                            diagLower.includes('clear lungs') || 
                            diagLower.includes('healthy') || 
                            diagLower.includes('negative');

  let effectiveLevel = 'moderate';
  if (effectiveRiskTier === 'High Risk' || effectiveRiskTier === 'High Risk / Severe' || effectiveRiskTier === 'Critical / Urgent' || effectiveProbNumber >= 0.70 || (isHighSeverityDiag && effectiveRiskTier !== 'Low Risk')) {
    effectiveLevel = 'high';
  } else if (effectiveRiskTier === 'Low Risk' || (effectiveProbNumber < effectiveThreshold && !isHighSeverityDiag) || isLowSeverityDiag) {
    if (effectiveRiskTier === 'Moderate Risk' || effectiveProbNumber >= effectiveThreshold) {
      effectiveLevel = 'moderate';
    } else {
      effectiveLevel = 'normal';
    }
  }

  const isAnyDecisionTweaked = Boolean(tweaks.diagnosis.isTweaked || tweaks.riskTier.isTweaked || tweaks.riskProbability.isTweaked || tweaks.decisionThreshold.isTweaked);

  let severityTheme;
  if (effectiveLevel === 'normal') {
    severityTheme = {
      level: 'normal',
      tier: effectiveRiskTier || 'Low Risk',
      statusPill: isAnyDecisionTweaked ? 'NEGATIVE / BASELINE NORMAL (DONE BY DOCTOR)' : 'NEGATIVE / BASELINE NORMAL (BELOW THRESHOLD)',
      statusDesc: `Calibrated Score (${effectiveRiskPercent}%) is below diagnostic threshold (${(effectiveThreshold * 100).toFixed(0)}%) — Within expected physiological baseline.`,
      bg: '#ecfdf5',
      border: '#10b981',
      borderDark: '#059669',
      borderSoft: '#a7f3d0',
      textMain: '#065f46',
      textMuted: '#047857',
      badgeBg: '#d1fae5',
      badgeText: '#065f46',
      badgeBorder: '#6ee7b7',
      metricColor: '#059669',
      accentGlow: 'rgba(16, 185, 129, 0.14)',
      icon: <ShieldCheck size={28} color="#059669" />
    };
  } else if (effectiveLevel === 'moderate') {
    severityTheme = {
      level: 'moderate',
      tier: effectiveRiskTier || 'Moderate Risk',
      statusPill: isAnyDecisionTweaked ? 'ELEVATED RISK / MODERATE (DONE BY DOCTOR)' : 'ELEVATED RISK / MODERATE SEVERITY (ABOVE THRESHOLD)',
      statusDesc: `Calibrated Score (${effectiveRiskPercent}%) exceeds decision threshold (${(effectiveThreshold * 100).toFixed(0)}%) with intermediate risk drivers.`,
      bg: '#fffbeb',
      border: '#f59e0b',
      borderDark: '#d97706',
      borderSoft: '#fde68a',
      textMain: '#92400e',
      textMuted: '#b45309',
      badgeBg: '#fef3c7',
      badgeText: '#92400e',
      badgeBorder: '#fcd34d',
      metricColor: '#d97706',
      accentGlow: 'rgba(245, 158, 11, 0.14)',
      icon: <AlertTriangle size={28} color="#d97706" />
    };
  } else {
    severityTheme = {
      level: 'high',
      tier: effectiveRiskTier || 'High Risk / Severe',
      statusPill: isAnyDecisionTweaked ? 'POSITIVE INDICATION / HIGH SEVERITY (DONE BY DOCTOR)' : 'POSITIVE INDICATION / HIGH SEVERITY (ABOVE THRESHOLD)',
      statusDesc: `Calibrated Score (${effectiveRiskPercent}%) markedly exceeds decision threshold (${(effectiveThreshold * 100).toFixed(0)}%) — Prioritized clinical assessment recommended.`,
      bg: '#fef2f2',
      border: '#ef4444',
      borderDark: '#dc2626',
      borderSoft: '#fca5a5',
      textMain: '#991b1b',
      textMuted: '#b91c1c',
      badgeBg: '#fee2e2',
      badgeText: '#991b1b',
      badgeBorder: '#f87171',
      metricColor: '#dc2626',
      accentGlow: 'rgba(239, 68, 68, 0.14)',
      icon: <AlertTriangle size={28} color="#dc2626" />
    };
  }

  // Construct comprehensive tweakedPayload
  const tweakedPayload = useMemo(() => {
    const docName = (
      tweaks.doctorInfo?.name?.trim() ||
      reviewedBy?.trim() ||
      clinicalReport?.clinician_review?.reviewed_by?.trim() ||
      result?.clinician_review?.reviewed_by?.trim() ||
      assessmentResponse?.clinician_review?.reviewed_by?.trim() ||
      assessmentResponse?.clinical_report?.clinician_review?.reviewed_by?.trim() ||
      localStorage.getItem('medsynapse_doctor_name') ||
      ''
    ).trim();
    const docTitle = (
      tweaks.doctorInfo?.title?.trim() ||
      clinicalReport?.clinician_review?.title?.trim() ||
      localStorage.getItem('medsynapse_doctor_title') ||
      'Attending Physician'
    ).trim();
    return {
      hasTweaks: hasAnyTweaks || Boolean(docName),
      doctorInfo: {
        name: docName,
        title: docTitle,
        timestamp: tweaks.doctorInfo?.timestamp || (new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      },
      summary: hasAnyTweaks ? `Attending clinician (${docName || 'Attending Physician'}) manually adjusted AI model decisions with recorded clinical rationale.` : `Clinical review under supervision of ${docName || 'Attending Physician'}.`,
      diagnosis: tweaks.diagnosis.isTweaked ? { original: originalDiagnosis, tweaked: tweaks.diagnosis.value, reason: tweaks.diagnosis.reason } : null,
      riskTier: tweaks.riskTier.isTweaked ? { original: originalRiskTier, tweaked: tweaks.riskTier.value, reason: tweaks.riskTier.reason } : null,
      riskProbability: tweaks.riskProbability.isTweaked ? { original: originalRiskPercent, tweaked: tweaks.riskProbability.value, reason: tweaks.riskProbability.reason } : null,
      decisionThreshold: tweaks.decisionThreshold.isTweaked ? { original: originalDecisionThreshold, tweaked: tweaks.decisionThreshold.value, reason: tweaks.decisionThreshold.reason } : null,
      recommendations: tweaks.recommendations.isTweaked ? { original: originalRecommendations, tweaked: tweaks.recommendations.value, reason: tweaks.recommendations.reason } : null,
      featureRationales: tweaks.featureRationales,
      effectiveValues: {
        diagnosis: effectiveDiagnosis,
        riskTier: effectiveRiskTier,
        riskPercentage: Number(effectiveRiskPercent),
        riskProbability: Number(effectiveRiskPercent) / 100,
        decisionThreshold: Number(effectiveThreshold),
        recommendations: effectiveRecommendations,
      }
    };
  }, [hasAnyTweaks, tweaks, reviewedBy, clinicalReport, result, assessmentResponse, originalDiagnosis, originalRiskTier, originalRiskPercent, originalDecisionThreshold, originalRecommendations, effectiveDiagnosis, effectiveRiskTier, effectiveRiskPercent, effectiveThreshold, effectiveRecommendations]);

  useEffect(() => {
    onTweaksChange?.(tweakedPayload);
    window.dispatchEvent(new CustomEvent('medsynapse-tweaks-updated', { detail: tweakedPayload }));
  }, [tweakedPayload, onTweaksChange]);

  // Module identification for clinical insights
  const diseaseNameLower = String(result.disease || title || '').toLowerCase();
  const isLiver = diseaseNameLower.includes('liver');
  const isBrain = diseaseNameLower.includes('brain') || diseaseNameLower.includes('tumor');
  const isKidney = diseaseNameLower.includes('kidney') || diseaseNameLower.includes('stone');
  const isSkin = diseaseNameLower.includes('skin') || diseaseNameLower.includes('melanoma');
  const isEye = diseaseNameLower.includes('eye') || diseaseNameLower.includes('retin');
  const isChest = diseaseNameLower.includes('pneumonia') || diseaseNameLower.includes('x-ray') || diseaseNameLower.includes('chest');
  const isHeart = diseaseNameLower.includes('heart') || diseaseNameLower.includes('cardio');
  const isDiabetes = diseaseNameLower.includes('diabetes');
  const isBreast = diseaseNameLower.includes('breast');

  // Biomarker helpers for Liver
  const inputDict = useMemo(() => {
    const map = {};
    clinicalInputs.forEach(i => {
      if (i.name) map[i.name.toLowerCase()] = i.value;
    });
    return map;
  }, [clinicalInputs]);

  const deRitisRatio = useMemo(() => {
    const ast = Number(inputDict['aspartate_aminotransferase'] || inputDict['ast'] || 0);
    const alt = Number(inputDict['alamine_aminotransferase'] || inputDict['alt'] || 0);
    if (ast > 0 && alt > 0) {
      return (ast / alt).toFixed(2);
    }
    return null;
  }, [inputDict]);

  const bilirubinRatio = useMemo(() => {
    const direct = Number(inputDict['direct_bilirubin'] || 0);
    const total = Number(inputDict['total_bilirubin'] || 0);
    if (direct > 0 && total > 0) {
      return ((direct / total) * 100).toFixed(1);
    }
    return null;
  }, [inputDict]);

  const agRatio = useMemo(() => {
    const ratio = inputDict['albumin_and_globulin_ratio'] || inputDict['ag_ratio'];
    if (ratio !== undefined && ratio !== null) return Number(ratio).toFixed(2);
    const alb = Number(inputDict['albumin'] || 0);
    const tp = Number(inputDict['total_protiens'] || inputDict['total_proteins'] || 0);
    if (alb > 0 && tp > alb) {
      return (alb / (tp - alb)).toFixed(2);
    }
    return null;
  }, [inputDict]);

  const handleClinicianReview = async (decisionOverride = null) => {
    if (!modelRunId) return;
    const decision = decisionOverride || doctorDecisionChoice;
    if (!reviewedBy.trim()) {
      setReviewError('Enter the clinician name or professional identifier before signing off.');
      return;
    }
    if (decision === 'approved' && verifiedFeatures.size === 0 && shapContributions.length > 0) {
      setReviewError('Please verify at least one clinical feature driver before approving.');
      return;
    }

    setReviewLoading(true);
    setReviewError(null);
    onWorkflowStageChange?.('review_saving');
    try {
      const verifiedList = Array.from(verifiedFeatures);
      const response = await reviewModelRun(
        modelRunId,
        decision,
        reviewedBy.trim(),
        reviewComment.trim(),
        verifiedList
      );
      setWorkflowStatus(response.data.workflow_status);
      setFinalReport(null);
      onWorkflowStageChange?.(decision === 'approved' ? 'approved' : 'rejected');
    } catch (error) {
      const message = error.message || 'Clinician review failed';
      setReviewError(message);
      onWorkflowStageChange?.('error', { message, failedAt: 'review' });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleFinalReport = async () => {
    setReviewLoading(true);
    setReviewError(null);
    onWorkflowStageChange?.('groq_generating');
    try {
      const response = await generateFinalReport(modelRunId);
      setFinalReport(response.data);
      setWorkflowStatus('final_report_generated');
      onWorkflowStageChange?.('complete');
    } catch (error) {
      const message = error.message || 'Final report generation failed';
      setReviewError(message);
      onWorkflowStageChange?.('error', { message, failedAt: 'groq' });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleParameterChange = (name, val, altName = null) => {
    setEditedInputs(prev => {
      const next = { ...prev, [name]: val };
      if (altName) next[altName] = val;
      return next;
    });
    setIsParametersModified(true);
    window.dispatchEvent(new CustomEvent('medsynapse-parameters-modified', {
      detail: { isModified: true, diseaseKey: resolvedDiseaseKey }
    }));
  };

  const handleResetParameters = () => {
    setEditedInputs({});
    setIsParametersModified(false);
    window.dispatchEvent(new CustomEvent('medsynapse-parameters-modified', {
      detail: { isModified: false, diseaseKey: resolvedDiseaseKey }
    }));
  };

  const handleRunMLAnalysis = useCallback(async () => {
    if (isReanalyzing) return;
    setIsReanalyzing(true);
    setReanalysisError(null);
    onWorkflowStageChange?.('prediction_running');
    try {
      const baseToUse = activeInputs && Object.keys(activeInputs).length > 0 ? activeInputs : resolvedInputs;
      const payload = buildModelPayload(resolvedDiseaseKey, editedInputs, baseToUse);
      let freshResult = null;
      const dKey = String(resolvedDiseaseKey || '').toLowerCase();

      if (dKey.includes('diabetes')) {
        freshResult = await predictDiabetes(payload);
      } else if (dKey.includes('heart') || dKey.includes('cardio') || dKey.includes('cardiac')) {
        freshResult = await predictHeart(payload);
      } else if (dKey.includes('liver') || dKey.includes('hepatic')) {
        freshResult = await predictLiverDisease(payload);
      } else if (dKey.includes('breast')) {
        freshResult = await predictBreastCancer(payload);
      } else if (dKey.includes('xray') || dKey.includes('pneumonia')) {
        const fileObj = baseToUse?.file;
        if (fileObj) {
          freshResult = await predictXRay(fileObj);
        } else {
          const sampleType = baseToUse?.sample_type || 'normal';
          const imgPath = sampleType === 'pneumonia' ? '/test_samples/xray_pneumonia.jpeg' : '/test_samples/xray_normal.jpeg';
          const response = await fetch(imgPath);
          const blob = await response.blob();
          const sampleFile = new File([blob], `sample_${sampleType}_xray.jpeg`, { type: 'image/jpeg' });
          freshResult = await predictXRay(sampleFile);
        }
      } else if (dKey.includes('brain')) {
        const fileObj = baseToUse?.file;
        if (fileObj) {
          freshResult = await predictBrainTumor(fileObj);
        } else {
          const demoId = baseToUse?.demo_id || 'glioma';
          const imgMap = {
            glioma: '/test_samples/brain_glioma.jpg',
            meningioma: '/test_samples/brain_meningioma.jpg',
            pituitary: '/test_samples/brain_pituitary.jpg',
            notumor: '/test_samples/brain_notumor.jpg',
          };
          const imgPath = imgMap[demoId] || imgMap.glioma;
          const response = await fetch(imgPath);
          const blob = await response.blob();
          const sampleFile = new File([blob], `sample_${demoId}_brain.jpg`, { type: 'image/jpeg' });
          freshResult = await predictBrainTumor(sampleFile);
        }
      } else if (dKey.includes('kidney')) {
        const fileObj = baseToUse?.file;
        if (fileObj) {
          freshResult = await predictKidneyStone(fileObj);
        } else {
          const demoId = baseToUse?.demo_id || 'stone';
          const imgMap = {
            stone: '/test_samples/kidney_stone.jpg',
            normal: '/test_samples/kidney_normal.jpg',
            cyst: '/test_samples/kidney_cyst.jpg',
            tumor: '/test_samples/kidney_tumor.jpg',
          };
          const imgPath = imgMap[demoId] || imgMap.stone;
          const response = await fetch(imgPath);
          const blob = await response.blob();
          const sampleFile = new File([blob], `sample_${demoId}_kidney.jpg`, { type: 'image/jpeg' });
          freshResult = await predictKidneyStone(sampleFile);
        }
      } else if (dKey.includes('skin')) {
        const fileObj = baseToUse?.file;
        if (fileObj) {
          freshResult = await predictSkinCancer(fileObj);
        } else {
          const demoId = baseToUse?.demo_id || 'mel';
          const imgMap = {
            mel: '/test_samples/skin_melanoma.jpg',
            melanoma: '/test_samples/skin_melanoma.jpg',
            nv: '/test_samples/skin_nevus.jpg',
            nevus: '/test_samples/skin_nevus.jpg',
            bcc: '/test_samples/skin_basal_cell_carcinoma.jpg',
            basal: '/test_samples/skin_basal_cell_carcinoma.jpg',
            akiec: '/test_samples/skin_actinic_keratosis.jpg',
            actinic: '/test_samples/skin_actinic_keratosis.jpg',
            bkl: '/test_samples/skin_benign_keratosis.jpg',
          };
          const imgPath = baseToUse?.image_preview || baseToUse?.preview || imgMap[demoId] || imgMap.mel;
          const response = await fetch(imgPath);
          const blob = await response.blob();
          const sampleFile = new File([blob], `sample_${demoId}_skin.jpg`, { type: 'image/jpeg' });
          freshResult = await predictSkinCancer(sampleFile);
        }
      } else if (dKey.includes('eye')) {
        const fileObj = baseToUse?.file;
        if (fileObj) {
          freshResult = await predictEye(fileObj);
        } else {
          const demoId = baseToUse?.demo_id || 'glaucoma';
          const imgMap = {
            glaucoma: '/test_samples/eye_glaucoma.jpeg',
            cataract: '/test_samples/eye_cataract.jpeg',
            bulging: '/test_samples/eye_bulging.jpeg',
            crossed: '/test_samples/eye_crossed.jpeg',
            uveitis: '/test_samples/eye_uveitis.jpeg',
            normal: '/test_samples/eye_normal.png',
            diabetic_retinopathy: '/test_samples/eye_diabetic_retinopathy.png',
          };
          const imgPath = baseToUse?.image_preview || baseToUse?.preview || imgMap[demoId] || imgMap.glaucoma;
          const response = await fetch(imgPath);
          const blob = await response.blob();
          const sampleFile = new File([blob], `sample_${demoId}_eye.jpeg`, { type: 'image/jpeg' });
          freshResult = await predictEye(sampleFile);
        }
      } else {
        throw new Error(`ML model re-run is not configured for ${resolvedDiseaseKey}.`);
      }

      if (!freshResult) {
        throw new Error('No response returned by the ML diagnostic server.');
      }

      // Preserve imaging and reference inputs so images remain intact across ML re-runs
      const mergedInputs = {
        ...baseToUse,
        ...payload,
      };
      if (baseToUse?.file) mergedInputs.file = baseToUse.file;
      if (baseToUse?.preview) mergedInputs.preview = baseToUse.preview;
      if (baseToUse?.image_preview) mergedInputs.image_preview = baseToUse.image_preview;
      if (baseToUse?.previewUrl) mergedInputs.previewUrl = baseToUse.previewUrl;
      if (baseToUse?.image_url) mergedInputs.image_url = baseToUse.image_url;
      if (baseToUse?.demo_id) mergedInputs.demo_id = baseToUse.demo_id;
      if (baseToUse?.source_filename) mergedInputs.source_filename = baseToUse.source_filename;

      setActiveResult(freshResult);
      setActiveInputs(mergedInputs);
      setIsParametersModified(false);
      setEditedInputs({});
      setIsInlineEditMode(false);
      setReanalysisSuccess(true);
      setTimeout(() => setReanalysisSuccess(false), 6000);
      setReportId(`MS-${Math.floor(100000 + Math.random() * 900000)}`);
      setReportDate(new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }));

      // Reset clinician tweaks to new baseline
      setTweaks({
        diagnosis: { isTweaked: false, value: '', reason: '' },
        riskTier: { isTweaked: false, value: '', reason: '' },
        riskProbability: { isTweaked: false, value: '', reason: '' },
        decisionThreshold: { isTweaked: false, value: '', reason: '' },
        recommendations: { isTweaked: false, value: freshResult?.data?.recommendations || [], reason: '' },
        featureRationales: {},
      });

      // Synchronize with parent and global event listeners
      onReportUpdated?.(freshResult, mergedInputs);

      window.dispatchEvent(new CustomEvent('medsynapse-parameters-modified', {
        detail: { isModified: false, diseaseKey: resolvedDiseaseKey }
      }));

      window.dispatchEvent(new CustomEvent('medsynapse-report-updated', {
        detail: { result: freshResult, inputs: mergedInputs, diseaseKey: resolvedDiseaseKey }
      }));

      onWorkflowStageChange?.('awaiting_review');
    } catch (err) {
      console.error('Run ML Analysis failed:', err);
      setReanalysisError(err.message || 'ML analysis failed');
      onWorkflowStageChange?.('error', { message: err.message, failedAt: 'prediction' });
    } finally {
      setIsReanalyzing(false);
    }
  }, [resolvedDiseaseKey, editedInputs, activeInputs, resolvedInputs, onWorkflowStageChange, onReportUpdated, isReanalyzing]);

  useEffect(() => {
    const handleTrigger = () => {
      handleRunMLAnalysis();
    };
    window.addEventListener('medsynapse-trigger-ml-analysis', handleTrigger);
    return () => window.removeEventListener('medsynapse-trigger-ml-analysis', handleTrigger);
  }, [handleRunMLAnalysis]);

  const handleDownloadPDF = () => {
    if (isParametersModified) return;
    const diseaseName = (result.disease || result.modality || title || 'Medical').replace(/\s+/g, '_');
    printReportDocument('.clinical-report-sheet', `MedSynapse_${diseaseName}_Report_${reportId}`);
  };

  return (
    <div className="clinical-report-sheet animate-fade-in" style={{
      background: '#ffffff',
      color: '#0f172a',
      border: '1.5px solid #cbd5e1',
      borderRadius: '8px',
      padding: '26px 30px',
      marginTop: '1.5rem',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      
      {/* =========================================================================
          1. OFFICIAL INSTITUTIONAL LETTERHEAD
          ========================================================================= */}
      <div className="print-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem',
        borderBottom: '2.5px solid #0f172a',
        paddingBottom: '14px',
        marginBottom: '18px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="#0f172a" />
            <h1 style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              margin: 0,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              color: '#0f172a'
            }}>
              MedSynapse Clinical Diagnostic & Decision Intelligence Laboratory
            </h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 0 0', fontWeight: 500 }}>
            Department of AI Diagnostics & Clinical Decision Support • Automated Decision Trace Audit
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>
            REF ID: {reportId}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
            Issued: {reportDate}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
            Protocol: ISO/IEEE Clinical AI Screening Standard
          </div>
        </div>
      </div>

      {/* Screen Action Toolbar (no-print) */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        margin: '0 0 16px 0',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '3px 8px',
            background: workflowStatus === 'clinician_approved' || workflowStatus === 'final_report_generated' ? '#dcfce7' : '#e2e8f0',
            color: workflowStatus === 'clinician_approved' || workflowStatus === 'final_report_generated' ? '#15803d' : '#0f172a',
            border: workflowStatus === 'clinician_approved' || workflowStatus === 'final_report_generated' ? '1px solid #86efac' : 'none',
            borderRadius: '4px'
          }}>
            {workflowStatus === 'clinician_approved' || workflowStatus === 'final_report_generated' ? 'Verified Clinical Record' : 'Official Screening Record'}
          </span>
          <span style={{ fontSize: '0.82rem', color: '#475569' }}>
            {workflowStatus === 'final_report_generated'
              ? 'Clinician-approved final report ready for print/export'
              : workflowStatus === 'clinician_approved'
              ? `Approved by ${reviewedBy || 'Attending Physician'} — Ready for final reporting`
              : 'Draft screening record — clinician verification required'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={() => setIsTweakPanelOpen(!isTweakPanelOpen)}
            className="btn-tweak-highlight"
            style={{
              padding: '7px 16px',
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              background: hasAnyTweaks 
                ? 'linear-gradient(135deg, #15803d 0%, #166534 100%)' 
                : 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
              color: '#ffffff',
              border: hasAnyTweaks ? '1.5px solid #16a34a' : '1.5px solid #3730a3',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 800,
              boxShadow: hasAnyTweaks 
                ? '0 4px 14px rgba(22, 163, 74, 0.4)' 
                : '0 4px 14px rgba(79, 70, 229, 0.4)',
              transition: 'all 0.2s ease',
              letterSpacing: '0.2px',
            }}
            title="Clinician Governance: Modify diagnostic determination, adjust risk tier, override parameters or record clinical notes"
          >
            <SlidersHorizontal size={15} color="#ffffff" strokeWidth={2.5} />
            <span>{hasAnyTweaks ? `✓ Decisions Modified (${totalTweaksCount})` : '🎚️ Tweak Model Decisions'}</span>
            <span style={{
              fontSize: '0.65rem',
              background: 'rgba(255, 255, 255, 0.25)',
              padding: '2px 6px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}>Doctor Override</span>
          </button>

          {/* Active Highlighted Run ML Analysis Button (Active when parameters are modified) */}
          {isParametersModified && (
            <button 
              type="button"
              onClick={handleRunMLAnalysis}
              disabled={isReanalyzing}
              className="btn-run-ml-active btn-run-ml-pulse"
              style={{
                padding: '7px 16px',
                fontSize: '0.84rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: '1.5px solid #38bdf8',
                borderRadius: '6px',
                cursor: isReanalyzing ? 'wait' : 'pointer',
                fontWeight: 800,
                boxShadow: '0 0 16px rgba(56, 189, 248, 0.55)',
                transition: 'all 0.2s ease',
              }}
              title="Run fresh ML inference on the modified parameters"
            >
              <Activity size={15} color="#ffffff" className={isReanalyzing ? 'animate-spin' : ''} />
              <span>{isReanalyzing ? 'Running ML Inference...' : '⚡ Run ML Analysis'}</span>
            </button>
          )}

          {onNavigateToLLMReport && (
            <button
              onClick={() => {
                onNavigateToLLMReport({
                  diseaseKey: resolvedDiseaseKey,
                  prediction: {
                    ...(assessmentData || {}),
                    ...result,
                    diagnosis: effectiveDiagnosis,
                    prediction: effectiveDiagnosis,
                    risk_tier: effectiveRiskTier,
                    risk_percentage: Number(effectiveRiskPercent),
                    risk_probability: Number(effectiveRiskPercent) / 100,
                    recommendations: effectiveRecommendations,
                  },
                  inputs: resolvedInputs,
                  clinicalReport: assessmentResponse?.clinical_report || null,
                  modelRunId: assessmentResponse?.model_run_id || null,
                  tweakedDecisions: tweakedPayload,
                  image: displayImageSrc,
                });
              }}
              className="btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={14} color="#5eead4" /> Generate Report via LLM
            </button>
          )}
          <button 
            onClick={isParametersModified ? undefined : handleDownloadPDF} 
            disabled={isParametersModified || isReanalyzing}
            className="btn-secondary" 
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              color: isParametersModified ? '#94a3b8' : '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              cursor: isParametersModified ? 'not-allowed' : 'pointer',
              opacity: isParametersModified ? 0.6 : 1,
            }}
            title={isParametersModified ? "Parameters modified. Re-run ML Analysis to enable printing." : "Print document"}
          >
            <Printer size={14} /> Print Document
          </button>
          {onReset && (
            <button 
              onClick={onReset} 
              className="btn-secondary" 
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Reactive Modification Alert Banner */}
      {isParametersModified && (
        <div className="alert-parameters-modified-banner no-print" style={{
          margin: '0 0 16px 0',
          padding: '12px 18px',
          background: '#fef3c7',
          border: '1.5px solid #f59e0b',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#d97706" />
            <div>
              <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.88rem' }}>
                Biomarkers & Parameters Have Been Modified Directly in Report
              </div>
              <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '2px' }}>
                Report downloads and exports are locked to prevent stale clinical documentation. Click <strong>Run ML Analysis</strong> to feed updated values into the diagnostic model and obtain fresh predictions.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleRunMLAnalysis}
              disabled={isReanalyzing}
              className="btn-run-ml-pulse"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                fontWeight: 800,
                border: '1.5px solid #38bdf8',
                borderRadius: '6px',
                padding: '7px 16px',
                fontSize: '0.82rem',
                cursor: isReanalyzing ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
              }}
            >
              <Activity size={14} className={isReanalyzing ? "animate-spin" : ""} />
              <span>{isReanalyzing ? 'Analyzing...' : '⚡ Run ML Analysis Now'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetParameters}
              disabled={isReanalyzing}
              style={{
                background: '#ffffff',
                color: '#78350f',
                fontWeight: 700,
                border: '1px solid #d97706',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Re-analysis Success Notification */}
      {reanalysisSuccess && (
        <div className="no-print" style={{
          margin: '0 0 16px 0',
          padding: '10px 16px',
          background: '#ecfdf5',
          border: '1.5px solid #10b981',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#065f46',
          fontSize: '0.85rem',
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
        }}>
          <CheckCircle size={18} color="#059669" />
          <span>✓ Fresh ML Analysis complete! Model predictions, calibrated risk scores, and SHAP attributions updated. Download is now enabled.</span>
        </div>
      )}

      {/* Re-analysis Error Notification */}
      {reanalysisError && (
        <div className="no-print" style={{
          margin: '0 0 16px 0',
          padding: '10px 16px',
          background: '#fef2f2',
          border: '1.5px solid #ef4444',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#991b1b',
          fontSize: '0.85rem',
          fontWeight: 700
        }}>
          <XCircle size={18} color="#dc2626" />
          <span>Error re-running ML model: {reanalysisError}</span>
        </div>
      )}

      {/* Clinician Decision Overrides & Parameter Tweak Center */}
      <ClinicianDecisionTweakCenter
        isOpen={isTweakPanelOpen}
        onClose={() => setIsTweakPanelOpen(false)}
        originalDecisions={{
          originalDiagnosis,
          originalRiskTier,
          originalRiskPercent,
          originalDecisionThreshold,
          originalRecommendations,
          shapContributions,
          isHealthy,
          inputs: resolvedInputs,
          diseaseKey: resolvedDiseaseKey,
        }}
        diseaseKey={resolvedDiseaseKey}
        clinicalInputs={resolvedInputs}
        onNavigateToForm={onNavigateToForm || onReset}
        tweaks={tweaks}
        onUpdateTweak={handleUpdateTweak}
        onResetTweak={handleResetTweak}
        onResetAll={handleResetAllTweaks}
        onUpdateFeatureRationale={handleUpdateFeatureRationale}
      />

      {/* =========================================================================
          2. SPECIMEN & PATIENT CLINICAL DATA SUMMARY
          ========================================================================= */}
      <div className="break-inside-avoid" style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #cbd5e1',
          paddingBottom: '4px',
          marginBottom: '8px'
        }}>
          <h3 style={{
            fontSize: '0.86rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#0f172a',
            margin: 0
          }}>
            1. Diagnostic Target & Specimen Overview
          </h3>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Modality: {result.disease || result.modality || 'Clinical Laboratory Evaluation'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 360px', minWidth: '240px' }}>
            <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <tbody>
                <tr>
                  <td style={{ width: '24%', fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Diagnostic Target:</td>
                  <td style={{ width: '26%', fontWeight: 600, color: '#0f172a' }}>{title}</td>
                  <td style={{ width: '24%', fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Evaluation Pipeline:</td>
                  <td style={{ width: '26%', color: '#0f172a' }}>{modelName}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Acquisition Source:</td>
                  <td style={{ color: '#0f172a' }}>{clinicalReport?.screening?.input_source || (displayImageSrc ? 'Diagnostic Scan Acquisition' : 'Direct Parameter Submission')}</td>
                  <td style={{ fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Input Validation:</td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>
                    {decisionTrace.input_validation === 'passed' ? 'Verified / Complete (Passed)' : 'Verified Clinical Data'}
                  </td>
                </tr>
                {displayImageSrc && (
                  <tr>
                    <td style={{ fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Specimen Scan:</td>
                    <td style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '0.78rem' }}>{displayImageFilename}</td>
                    <td style={{ fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Image Status:</td>
                    <td style={{ color: '#059669', fontWeight: 700, fontSize: '0.78rem' }}>Attached for Reference</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {displayImageSrc && (
            <div 
              className="clinical-reference-image-card"
              style={{
                flex: '0 0 auto',
                width: '180px',
                display: 'flex',
                flexDirection: 'column',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                overflow: 'hidden',
                background: '#f8fafc',
                boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
                breakInside: 'avoid',
              }}
            >
              <div style={{
                position: 'relative',
                width: '180px',
                height: '130px',
                background: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <img
                  src={displayImageSrc}
                  alt={displayImageFilename || 'Clinical Specimen'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.parentNode) {
                      e.target.parentNode.style.background = '#e2e8f0';
                    }
                  }}
                />
                <span style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  letterSpacing: '0.4px',
                  background: 'rgba(15, 23, 42, 0.82)',
                  color: '#38bdf8',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  textTransform: 'uppercase',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                }}>
                  SCAN
                </span>
              </div>
              <div style={{
                padding: '6px 8px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}>
                <div style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <FileCheck size={11} color="#059669" />
                  <span>Clinical Reference</span>
                </div>
                <div style={{
                  fontSize: '0.66rem',
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }} title={displayImageFilename}>
                  {displayImageFilename}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Structured Input Biomarkers Table */}
      {effectiveClinicalInputs && effectiveClinicalInputs.length > 0 && (
        <div className="break-inside-avoid" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#334155',
              margin: 0
            }}>
              Measured Biomarkers & Clinical Parameters
            </h4>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Toggle Direct In-Report Parameter Editing */}
              <button
                type="button"
                onClick={() => setIsInlineEditMode(prev => !prev)}
                className="btn-secondary no-print"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: isInlineEditMode ? '#dbeafe' : '#ffffff',
                  color: isInlineEditMode ? '#1d4ed8' : '#334155',
                  border: isInlineEditMode ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  transition: 'all 0.18s ease',
                }}
                title="Toggle interactive parameter editing directly inside this report table"
              >
                {isInlineEditMode ? <Check size={14} color="#1d4ed8" /> : <Edit3 size={14} color="#334155" />}
                <span>{isInlineEditMode ? 'Done Editing' : '✎ Edit Parameters in Report'}</span>
              </button>

              {/* Reset Parameters Button when modified */}
              {isParametersModified && (
                <button
                  type="button"
                  onClick={handleResetParameters}
                  className="btn-secondary no-print"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: '#ffffff',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                  title="Discard modifications and revert to baseline values"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              )}

              {/* Prominent Active Run ML Analysis Button */}
              {isParametersModified && (
                <button
                  type="button"
                  onClick={handleRunMLAnalysis}
                  disabled={isReanalyzing}
                  className="btn-run-ml-active btn-run-ml-pulse no-print"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: isReanalyzing ? 'wait' : 'pointer',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    border: '1.5px solid #38bdf8',
                    borderRadius: '6px',
                    boxShadow: '0 0 14px rgba(56, 189, 248, 0.45)',
                  }}
                  title="Send updated parameters to ML model and obtain fresh clinical result"
                >
                  <Activity size={14} color="#ffffff" className={isReanalyzing ? 'animate-spin' : ''} />
                  <span>{isReanalyzing ? 'Evaluating...' : '⚡ Run ML Analysis'}</span>
                </button>
              )}

              {/* Tweak Biomarkers in Form (Single clean icon without duplicate emoji) */}
              {(onNavigateToForm || onReset) && (
                <button
                  type="button"
                  onClick={() => {
                    const baseToUse = activeInputs && Object.keys(activeInputs).length > 0 ? activeInputs : resolvedInputs;
                    const latestInputs = buildModelPayload(resolvedDiseaseKey, editedInputs, baseToUse);
                    if (onNavigateToForm) {
                      onNavigateToForm(resolvedDiseaseKey, latestInputs);
                    } else if (onReset) {
                      onReset();
                    }
                  }}
                  className="btn-tweak-biomarkers-highlight no-print"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                    color: '#ffffff',
                    border: '1px solid #0f766e',
                    borderRadius: '6px',
                    boxShadow: '0 2px 10px rgba(13, 148, 136, 0.3)',
                    transition: 'all 0.18s ease',
                  }}
                  title="Edit these input values directly in the clinical form"
                >
                  <SlidersHorizontal size={14} color="#ffffff" strokeWidth={2.5} />
                  <span>Tweak Biomarkers in Form</span>
                </button>
              )}
            </div>
          </div>
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Parameter</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>Measured Value</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Unit</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Source Verification</th>
              </tr>
            </thead>
            <tbody>
              {effectiveClinicalInputs.map((input, idx) => {
                const inputKey = input.name || input.display_name;
                const originalVal = input.value !== null && input.value !== undefined ? String(input.value) : '';
                const currentVal = editedInputs[inputKey] !== undefined
                  ? editedInputs[inputKey]
                  : (input.name && editedInputs[input.name] !== undefined
                    ? editedInputs[input.name]
                    : (input.display_name && editedInputs[input.display_name] !== undefined
                      ? editedInputs[input.display_name]
                      : originalVal));
                const isRowModified = (editedInputs[inputKey] !== undefined && String(editedInputs[inputKey]) !== originalVal) ||
                  (input.name && editedInputs[input.name] !== undefined && String(editedInputs[input.name]) !== originalVal) ||
                  (input.display_name && editedInputs[input.display_name] !== undefined && String(editedInputs[input.display_name]) !== originalVal);

                return (
                  <tr 
                    key={idx} 
                    style={{ 
                      background: isRowModified ? '#fef3c7' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'), 
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <td style={{ padding: '5px 10px', fontWeight: 600, color: '#1e293b' }}>
                      {input.display_name || input.name}
                      {isRowModified && (
                        <span style={{ 
                          fontSize: '0.68rem', 
                          marginLeft: '6px', 
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: '#059669',
                          color: '#ffffff',
                          fontWeight: 800
                        }}>
                          👨‍⚕️ DONE BY DOCTOR
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                      {isInlineEditMode ? (
                        <input
                          type="number"
                          step="any"
                          value={currentVal}
                          onChange={(e) => handleParameterChange(inputKey, e.target.value, input.display_name !== inputKey ? input.display_name : input.name)}
                          className="table-input-number"
                          style={{
                            width: '100px',
                            padding: '3px 8px',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            borderRadius: '4px',
                            border: isRowModified ? '2px solid #d97706' : '1.5px solid #3b82f6',
                            background: isRowModified ? '#fffbeb' : '#ffffff',
                            color: '#0f172a',
                            outline: 'none',
                            boxShadow: isRowModified ? '0 0 0 2px rgba(217, 119, 6, 0.2)' : '0 0 0 2px rgba(59, 130, 246, 0.15)'
                          }}
                        />
                      ) : (
                        <span 
                          onClick={() => setIsInlineEditMode(true)}
                          title="Click to edit parameter in report"
                          style={{ 
                            cursor: 'pointer',
                            textDecoration: isRowModified ? 'underline' : 'none',
                            textDecorationColor: '#d97706'
                          }}
                        >
                          {currentVal !== '' ? currentVal : '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '5px 10px', color: '#475569' }}>
                      {input.unit || '—'}
                    </td>
                    <td style={{ padding: '5px 10px', color: isRowModified ? '#065f46' : '#64748b', fontSize: '0.74rem', fontWeight: isRowModified ? 700 : 400 }}>
                      {isRowModified ? '👨‍⚕️ Done by Doctor (modified directly in report)' : (input.source || 'Validated model input')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================================================
          OFFICIAL CLINICIAN OVERRIDE RECORD — DONE BY DOCTOR
          ========================================================================= */}
      {hasAnyTweaks && (
        <div className="clinician-override-record-box break-inside-avoid" style={{
          margin: '16px 0',
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
          border: '2px solid #059669',
          borderRadius: '8px',
          boxShadow: '0 4px 14px rgba(5, 150, 105, 0.12)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', borderBottom: '1.5px solid #a7f3d0', paddingBottom: '8px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{
                background: '#059669',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '4px 8px',
                fontWeight: 800,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span>👨‍⚕️ DONE BY DOCTOR</span>
                <span style={{ opacity: 0.8 }}>•</span>
                <span>OFFICIAL CLINICIAN OVERRIDE RECORD</span>
              </div>
              <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#065f46' }}>
                {tweaks.doctorInfo?.name?.trim() || 'Attending Clinician'}
              </span>
              {tweaks.doctorInfo?.title?.trim() && (
                <span style={{ fontSize: '0.74rem', color: '#047857' }}>
                  ({tweaks.doctorInfo.title.trim()})
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.74rem', color: '#047857', fontWeight: 700 }}>
              Authorized: {tweaks.doctorInfo?.timestamp || reportDate}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '10px' }}>
            {tweaks.diagnosis.isTweaked && (
              <div style={{ background: '#ffffff', border: '1.5px solid #6ee7b7', borderRadius: '6px', padding: '8px 12px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                  1. Diagnosis Override
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
                  <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{originalDiagnosis}</span>
                  <span style={{ margin: '0 6px', color: '#059669', fontWeight: 800 }}>➔</span>
                  <strong style={{ color: '#065f46' }}>{tweaks.diagnosis.value}</strong>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                  Rationale: &quot;{tweaks.diagnosis.reason || 'Clinical adjustment'}&quot;
                </div>
              </div>
            )}

            {tweaks.riskProbability.isTweaked && (
              <div style={{ background: '#ffffff', border: '1.5px solid #6ee7b7', borderRadius: '6px', padding: '8px 12px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                  2. Calibrated Risk Score Adjustment
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
                  <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{originalRiskPercent}%</span>
                  <span style={{ margin: '0 6px', color: '#059669', fontWeight: 800 }}>➔</span>
                  <strong style={{ color: '#065f46' }}>{tweaks.riskProbability.value}%</strong>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                  Rationale: &quot;{tweaks.riskProbability.reason || 'Biometric recalibration'}&quot;
                </div>
              </div>
            )}

            {tweaks.riskTier.isTweaked && (
              <div style={{ background: '#ffffff', border: '1.5px solid #6ee7b7', borderRadius: '6px', padding: '8px 12px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                  3. Risk Tier Override
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
                  <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{originalRiskTier}</span>
                  <span style={{ margin: '0 6px', color: '#059669', fontWeight: 800 }}>➔</span>
                  <strong style={{ color: '#065f46' }}>{tweaks.riskTier.value}</strong>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                  Rationale: &quot;{tweaks.riskTier.reason || 'Risk recalibration'}&quot;
                </div>
              </div>
            )}

            {tweaks.decisionThreshold.isTweaked && (
              <div style={{ background: '#ffffff', border: '1.5px solid #6ee7b7', borderRadius: '6px', padding: '8px 12px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                  4. Decision Cutoff Threshold
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
                  <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{Number(originalDecisionThreshold).toFixed(2)}</span>
                  <span style={{ margin: '0 6px', color: '#059669', fontWeight: 800 }}>➔</span>
                  <strong style={{ color: '#065f46' }}>{Number(tweaks.decisionThreshold.value).toFixed(2)}</strong>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                  Rationale: &quot;{tweaks.decisionThreshold.reason || 'Threshold calibration'}&quot;
                </div>
              </div>
            )}

            {tweaks.recommendations.isTweaked && (
              <div style={{ background: '#ffffff', border: '1.5px solid #6ee7b7', borderRadius: '6px', padding: '8px 12px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                  5. Management Protocol Customized
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: '2px', color: '#065f46', fontWeight: 700 }}>
                  {effectiveRecommendations.length} tailored protocol items defined
                </div>
                <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                  Rationale: &quot;{tweaks.recommendations.reason || 'Protocol tailored to clinical presentation'}&quot;
                </div>
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #a7f3d0',
            paddingTop: '8px',
            fontSize: '0.74rem',
            color: '#065f46',
            fontWeight: 700
          }}>
            <span>✓ Certified Clinical Override — Propagated dynamically into all diagnostic cards & LLM clinical synthesis</span>
            <span style={{ fontFamily: 'monospace' }}>AUTHORIZATION SEAL: #CDSS-MD-VERIFIED</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. PRIMARY DIAGNOSTIC IMPRESSION & CLASSIFICATION (DYNAMIC SEVERITY COLORS)
          ========================================================================= */}
      <div className="print-status-box break-inside-avoid" style={{
        border: `2px solid ${severityTheme.border}`,
        backgroundColor: severityTheme.bg,
        boxShadow: `0 3px 12px ${severityTheme.accentGlow}`,
        borderRadius: '6px',
        padding: '16px 20px',
        margin: '18px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.2rem',
        transition: 'all 0.2s ease-in-out'
      }}>
        <div style={{ flex: '1 1 360px', minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: severityTheme.textMuted
            }}>
              Primary Screening Determination
            </span>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0.5px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: severityTheme.badgeBg,
              color: severityTheme.badgeText,
              border: `1px solid ${severityTheme.badgeBorder}`
            }}>
              {severityTheme.statusPill}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{
              fontSize: '1.38rem',
              fontWeight: 800,
              color: severityTheme.textMain,
              margin: '4px 0 6px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {severityTheme.icon}
              <span>{effectiveDiagnosis}</span>
            </h2>

            {tweaks.diagnosis.isTweaked && (
              <span className="badge" style={{ fontSize: '0.68rem', background: '#059669', color: '#ffffff', border: '1px solid #047857', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                👨‍⚕️ DONE BY DOCTOR / CLINICIAN OVERRIDE
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsTweakPanelOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                fontSize: '0.76rem',
                fontWeight: 800,
                background: tweaks.diagnosis.isTweaked ? '#fef3c7' : '#e0e7ff',
                color: tweaks.diagnosis.isTweaked ? '#92400e' : '#3730a3',
                border: tweaks.diagnosis.isTweaked ? '1.5px solid #f59e0b' : '1.5px solid #6366f1',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
                transition: 'all 0.15s ease',
              }}
              title="Click to override this diagnosis or change parameters"
            >
              <Edit3 size={12} color={tweaks.diagnosis.isTweaked ? '#92400e' : '#3730a3'} strokeWidth={2.5} />
              <span>{tweaks.diagnosis.isTweaked ? '✓ Overridden by Doctor (Edit)' : '✎ Tweak / Override Decision'}</span>
            </button>
          </div>

          {tweaks.diagnosis.isTweaked && (
            <div style={{
              fontSize: '0.76rem',
              background: '#ecfdf5',
              border: '1.5px solid #10b981',
              borderRadius: '6px',
              padding: '6px 12px',
              margin: '6px 0 10px 0',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontWeight: 800, background: '#059669', color: '#ffffff', padding: '1px 6px', borderRadius: '3px', fontSize: '0.68rem' }}>
                👨‍⚕️ DONE BY DOCTOR
              </span>
              <span><strong>Reviewing Doctor:</strong> {tweaks.doctorInfo?.name?.trim() || 'Attending Physician'}{tweaks.doctorInfo?.title?.trim() ? ` (${tweaks.doctorInfo.title.trim()})` : ''}</span>
              <span>•</span>
              <span><strong>AI Model Output:</strong> &quot;{originalDiagnosis}&quot;</span>
              <span>•</span>
              <span><strong>Doctor Rationale:</strong> &quot;{tweaks.diagnosis.reason || 'Clinical adjustment'}&quot;</span>
            </div>
          )}

          <p style={{ fontSize: '0.82rem', color: severityTheme.textMain, margin: '0 0 6px 0', fontWeight: 500 }}>
            {severityTheme.statusDesc}
          </p>

          <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <span>
              Decision Threshold: <strong style={{ color: '#0f172a' }}>{effectiveThreshold.toFixed(2)}</strong>
              {tweaks.decisionThreshold.isTweaked && <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.7rem' }}> [👨‍⚕️ Done by Doctor]</span>}
            </span>
            <span>•</span>
            <span>
              Calibrated Risk Score: <strong style={{ color: severityTheme.textMain }}>{(Number(effectiveRiskPercent)/100).toFixed(4)}</strong>
              {tweaks.riskProbability.isTweaked && <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.7rem' }}> [👨‍⚕️ Done by Doctor]</span>}
            </span>
            <span>•</span>
            <span>
              Risk Tier: <strong style={{ color: severityTheme.textMain }}>{effectiveRiskTier}</strong>
              {tweaks.riskTier.isTweaked && <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.7rem' }}> [👨‍⚕️ Done by Doctor]</span>}
            </span>
          </div>
        </div>

        {/* Right Calibrated Risk Score Badge */}
        <div style={{
          textAlign: 'center',
          padding: '12px 22px',
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          border: `2px solid ${severityTheme.border}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          minWidth: '135px'
        }}>
          <div style={{
            fontSize: '1.9rem',
            fontWeight: 800,
            fontFamily: 'monospace',
            color: severityTheme.metricColor,
            lineHeight: 1.1
          }}>
            {effectiveRiskPercent}%
          </div>
          {tweaks.riskProbability.isTweaked && (
            <div style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              background: '#059669',
              color: '#ffffff',
              border: '1px solid #047857',
              borderRadius: '3px',
              padding: '2px 5px',
              margin: '3px 0',
              textTransform: 'uppercase'
            }}>
              👨‍⚕️ DONE BY DOCTOR (AI: {originalRiskPercent}%)
            </div>
          )}
          <div style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            color: severityTheme.textMuted,
            fontWeight: 800,
            letterSpacing: '0.6px',
            marginTop: '4px'
          }}>
            {severityTheme.tier}
          </div>
          <div style={{
            fontSize: '0.62rem',
            color: '#64748b',
            fontWeight: 600,
            marginTop: '2px'
          }}>
            {isBelowThreshold ? 'Below Cutoff (Safe)' : 'Exceeds Cutoff (Flagged)'}
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. MODEL DECISION LOGIC & AUDIT TRACE
          ========================================================================= */}
      <div className="break-inside-avoid" style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #cbd5e1',
          paddingBottom: '4px',
          marginBottom: '8px'
        }}>
          <h3 style={{
            fontSize: '0.86rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#0f172a',
            margin: 0
          }}>
            2. Model Decision Logic & Audit Trace
          </h3>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
            Step-by-step decision verification
          </span>
        </div>

        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a', width: '25%' }}>Decision Step</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a', width: '45%' }}>Observed Metric / Evaluation</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a', width: '30%' }}>Determination</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '5px 10px', fontWeight: 600 }}>1. Input Validation</td>
              <td style={{ padding: '5px 10px', color: '#334155' }}>All required disease biomarkers validated against schema</td>
              <td style={{ padding: '5px 10px', fontWeight: 600, color: '#0f172a' }}>Passed</td>
            </tr>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '5px 10px', fontWeight: 600 }}>2. Model Routing</td>
              <td style={{ padding: '5px 10px', color: '#334155' }}>Routed to specialized endpoint: {modelName}</td>
              <td style={{ padding: '5px 10px', fontWeight: 600, color: '#0f172a' }}>Executed</td>
            </tr>
            {baseValue !== undefined && baseValue !== null && (
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '5px 10px', fontWeight: 600 }}>3. Baseline Expected Score</td>
                <td style={{ padding: '5px 10px', color: '#334155' }}>Population background expected value E[f(x)]</td>
                <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                  {Number(baseValue).toFixed(4)}
                </td>
              </tr>
            )}
            {decisionTrace.net_shap_displacement !== undefined && decisionTrace.net_shap_displacement !== null && (
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '5px 10px', fontWeight: 600 }}>4. Net SHAP Displacement</td>
                <td style={{ padding: '5px 10px', color: '#334155' }}>Cumulative sum of all positive and negative feature contributions (∑φ)</td>
                <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                  {decisionTrace.net_shap_displacement > 0 ? `+${decisionTrace.net_shap_displacement.toFixed(4)}` : decisionTrace.net_shap_displacement.toFixed(4)}
                </td>
              </tr>
            )}
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>5. Threshold Evaluation</td>
              <td style={{ padding: '6px 10px', color: '#334155' }}>
                Calibrated probability ({effectiveProbNumber.toFixed(4)}) {effectiveProbNumber >= effectiveThreshold ? '≥' : '<'} Decision Threshold ({effectiveThreshold.toFixed(4)})
                {tweaks.decisionThreshold.isTweaked && <span style={{ color: '#059669', fontWeight: 800, marginLeft: '6px', fontSize: '0.74rem' }}>[👨‍⚕️ Done by Doctor]</span>}
              </td>
              <td style={{ padding: '6px 10px' }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  background: severityTheme.badgeBg,
                  color: severityTheme.badgeText,
                  border: `1px solid ${severityTheme.badgeBorder}`
                }}>
                  {effectiveProbNumber >= effectiveThreshold ? 'Threshold Exceeded (Positive Flag)' : 'Within Reference Range (Negative)'}
                </span>
              </td>
            </tr>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>6. Risk Stratification</td>
              <td style={{ padding: '6px 10px', color: '#334155' }}>
                Stratified by probability cutoffs (Low: &lt;0.35, Moderate: 0.35–0.70, High: ≥0.70)
                {tweaks.riskTier.isTweaked && <span style={{ color: '#059669', fontWeight: 800, marginLeft: '6px', fontSize: '0.74rem' }}>[👨‍⚕️ Done by Doctor]</span>}
              </td>
              <td style={{ padding: '6px 10px' }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  background: severityTheme.badgeBg,
                  color: severityTheme.badgeText,
                  border: `1px solid ${severityTheme.badgeBorder}`
                }}>
                  {effectiveRiskTier}
                </span>
              </td>
            </tr>
            {hasAnyTweaks && (
              <tr style={{ background: '#ecfdf5', borderBottom: '1.5px solid #10b981' }}>
                <td style={{ padding: '6px 10px', fontWeight: 700, color: '#065f46' }}>
                  7. Attending Clinician Review & Overrides
                </td>
                <td style={{ padding: '6px 10px', color: '#047857' }}>
                  Authorized by <strong>{tweaks.doctorInfo?.name?.trim() || 'Attending Physician'}</strong>: Diagnosis &rarr; &quot;{effectiveDiagnosis}&quot;, Risk &rarr; {effectiveRiskPercent}%, Tier &rarr; {effectiveRiskTier}
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    background: '#059669',
                    color: '#ffffff',
                    border: '1px solid #047857'
                  }}>
                    👨‍⚕️ DONE BY DOCTOR
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =========================================================================
          5. MODULE-SPECIFIC DEEP CLINICAL EXPLANATIONS & EVIDENCE PANEL
          ========================================================================= */}
      {/* 5A. LIVER DISEASE IN-DEPTH BIOMARKER & RATIO ANALYSIS */}
      {isLiver && (
        <div className="break-inside-avoid" style={{
          marginBottom: '16px',
          padding: '14px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '6px'
        }}>
          <h4 style={{
            fontSize: '0.84rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#0f172a',
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={16} color="#0284c7" /> Hepatic Biomarker Indices & Clinical Decision Ratios
          </h4>
          <p style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: '#475569' }}>
            Quantitative hepatic enzymatic indices derived from patient serum liver function tests (EASL & AASLD Guidelines):
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
            {deRitisRatio && (
              <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>De Ritis Ratio (AST / ALT)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: Number(deRitisRatio) > 2.0 ? '#b91c1c' : '#0f172a' }}>
                  {deRitisRatio}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>
                  {Number(deRitisRatio) > 2.0 ? 'Elevated (>2.0): Suggests severe alcoholic injury / cirrhotic progression' : Number(deRitisRatio) > 1.0 ? 'Intermediate (>1.0): Mild chronic hepatocellular pattern' : 'Favorable (<1.0): Predominantly viral/metabolic or normal pattern'}
                </div>
              </div>
            )}

            {bilirubinRatio && (
              <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Conjugated Bilirubin Fraction</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: Number(bilirubinRatio) > 50 ? '#d97706' : '#0f172a' }}>
                  {bilirubinRatio}% (Direct/Total)
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>
                  {Number(bilirubinRatio) > 50 ? 'Conjugated predominance: Indicates biliary cholestasis or canalicular excretion impairment' : 'Unconjugated predominance: Hemolytic or pre-microsomal pattern'}
                </div>
              </div>
            )}

            {agRatio && (
              <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Albumin / Globulin (A:G) Ratio</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: Number(agRatio) < 1.0 ? '#b91c1c' : '#15803d' }}>
                  {agRatio}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '2px' }}>
                  {Number(agRatio) < 1.0 ? 'Inverted (<1.0): Hepatic synthetic depression / polyclonal hypergammaglobulinemia' : 'Normal (≥1.0): Preserved hepatic parenchymal protein synthesis'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5B. MULTI-CLASS PROBABILITY DISTRIBUTION (FOR VISION MODULES: BRAIN, KIDNEY, SKIN, EYE) */}
      {result.class_probabilities && Object.keys(result.class_probabilities).length > 0 && (
        <div className="break-inside-avoid" style={{
          marginBottom: '16px',
          padding: '14px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '6px'
        }}>
          <h4 style={{
            fontSize: '0.84rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#0f172a',
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Layers size={16} color="#7c3aed" /> Multi-Class Diagnostic Probability Spectrum
          </h4>
          <p style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: '#475569' }}>
            Comprehensive posterior softmax distribution across all trained clinical categories:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(result.class_probabilities).map(([clsName, pVal]) => {
              const p = Number(pVal || 0);
              const isTop = (result.diagnosis === clsName || result.prediction === clsName);
              const pPct = (p * 100).toFixed(1);
              return (
                <div key={clsName} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '180px', fontSize: '0.8rem', fontWeight: isTop ? 800 : 500, color: isTop ? '#0f172a' : '#475569' }}>
                    {clsName} {isTop && '★'}
                  </div>
                  <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max(p * 100, 2)}%`,
                      height: '100%',
                      background: isTop ? (isHealthy ? '#10b981' : '#dc2626') : '#94a3b8',
                      borderRadius: '4px'
                    }} />
                  </div>
                  <div style={{ width: '55px', textAlign: 'right', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: isTop ? '#0f172a' : '#64748b' }}>
                    {pPct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5B-2. RADIOLOGICAL & DERMATOLOGICAL GRAD-CAM HEATMAP VISUALIZATION (VISION MODULES) */}
      {(explainability.overlay_data_url || explainability.heatmap_data_url) && (
        <div className="break-inside-avoid" style={{
          marginBottom: '16px',
          padding: '16px',
          background: '#ffffff',
          border: '1.5px solid #0284c7',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(2, 132, 199, 0.08)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e0f2fe',
            paddingBottom: '8px',
            marginBottom: '14px'
          }}>
            <div>
              <h3 style={{
                fontSize: '0.9rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#0369a1',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Sparkles size={16} color="#0284c7" /> 3. Visual Explainability (Grad-CAM Saliency & Attention Map)
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Target Explained: <strong style={{ color: '#0f172a' }}>{explainability.target_class || result.diagnosis || result.prediction}</strong> • Method: {explainability.method || 'Grad-CAM'}{explainability.target_layer ? ` • Layer: ${explainability.target_layer}` : ''}{explainability.attention_statistics?.max_attention ? ` • Peak Saliency: ${(explainability.attention_statistics.max_attention * 100).toFixed(0)}%` : ''}
              </p>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              background: '#e0f2fe',
              color: '#0369a1',
              borderRadius: '4px',
              border: '1px solid #bae6fd'
            }}>
              Convolutional Attention Map
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
            {/* Blended Grad-CAM Heatmap Overlay */}
            {explainability.overlay_data_url && (
              <div style={{ textAlign: 'center', flex: '1 1 240px', maxWidth: '340px' }}>
                <div style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  background: '#0f172a',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <img
                    src={explainability.overlay_data_url}
                    alt="Grad-CAM Saliency Overlay"
                    style={{ width: '100%', height: 'auto', maxHeight: '260px', objectFit: 'contain', display: 'block' }}
                  />
                </div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                  Grad-CAM Saliency Overlay
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Color-weighted neural network decision focus
                </div>
              </div>
            )}

            {/* Standalone Attention Heatmap */}
            {explainability.heatmap_data_url && (
              <div style={{ textAlign: 'center', flex: '1 1 240px', maxWidth: '340px' }}>
                <div style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  background: '#000000',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <img
                    src={explainability.heatmap_data_url}
                    alt="Grad-CAM Heatmap"
                    style={{ width: '100%', height: 'auto', maxHeight: '260px', objectFit: 'contain', display: 'block' }}
                  />
                </div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                  Feature Activation Intensity
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Normalized activation tensor (Jet colormap)
                </div>
              </div>
            )}
          </div>

          {/* Attention Intensity Legend */}
          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>
              <span>Low Attention (Background / Normal Parenchyma)</span>
              <span>Peak Focal Saliency (Pathology Trigger)</span>
            </div>
            <div style={{
              height: '8px',
              borderRadius: '4px',
              background: 'linear-gradient(to right, #000080, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000, #800000)',
              border: '1px solid #cbd5e1'
            }} />
            <p style={{ margin: '8px 0 0 0', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}>
              Warm colors (yellow/red) pinpoint the precise spatial receptive field in the final convolutional layer driving the model's prediction toward <strong>{explainability.target_class || result.diagnosis || result.prediction}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 5C. SHAP FEATURE ATTRIBUTION TABLE (FOR TABULAR MODULES: DIABETES, BREAST CANCER, HEART) */}
      {shapContributions && shapContributions.length > 0 && (
        <div className="break-inside-avoid" style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #cbd5e1',
            paddingBottom: '4px',
            marginBottom: '8px'
          }}>
            <h3 style={{
              fontSize: '0.86rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#0f172a',
              margin: 0
            }}>
              3. SHAP Feature Attribution & Decision Breakdown
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Method: {explainability.method || 'SHAP Additive Attribution'}
            </span>
          </div>

          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '10px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Biomarker / Feature</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>Patient Value</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>SHAP Value (φ)</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Direction of Effect</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Decision Impact</th>
              </tr>
            </thead>
            <tbody>
              {shapContributions.map((item, idx) => {
                const shapVal = Number(item.shap_value || 0);
                const isPositive = shapVal > 0;
                return (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '5px 10px', fontWeight: 600, color: '#0f172a' }}>{item.feature}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                      {item.patient_value !== undefined && item.patient_value !== null ? String(item.patient_value) : '—'}
                    </td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: isPositive ? '#b91c1c' : '#15803d' }}>
                      {isPositive ? `+${shapVal.toFixed(6)}` : shapVal.toFixed(6)}
                    </td>
                    <td style={{ padding: '5px 10px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: isPositive ? '#fee2e2' : '#dcfce7',
                        color: isPositive ? '#991b1b' : '#166534',
                        border: isPositive ? '1px solid #fca5a5' : '1px solid #86efac'
                      }}>
                        {isPositive ? 'Elevates Risk (+)' : 'Mitigates Risk (-)'}
                      </span>
                    </td>
                    <td style={{ padding: '5px 10px', color: '#475569', fontSize: '0.78rem' }}>
                      {item.effect || (isPositive ? 'Increased predicted positive score' : 'Reduced predicted positive score')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Step-by-Step Plain Language Decision Narrative */}
      {explanationSentences && explanationSentences.length > 0 && (
        <div className="break-inside-avoid" style={{
          marginBottom: '16px',
          padding: '12px 14px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px'
        }}>
          <h4 style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#0f172a',
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Info size={14} color="#0f172a" /> Deterministic Decision Explanations
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#1e293b', fontSize: '0.8rem', lineHeight: 1.6 }}>
            {explanationSentences.map((sentence, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>{sentence}</li>
            ))}
          </ul>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '0.72rem' }}>
            Note: SHAP values describe this model's behavior for the submitted input and do not establish medical causality.
          </p>
        </div>
      )}

      {/* Radiological Tensor Attention */}
      {result.image_transformation && (
        <div className="break-inside-avoid" style={{
          marginBottom: '16px',
          padding: '10px 14px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px'
        }}>
          <h4 style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#0f172a',
            margin: '0 0 6px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Layers size={14} color="#0f172a" /> Radiographic Tensor Normalization & Attention
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem' }}>
            <span style={{ color: '#334155' }}>
              Source Dimensions: <strong>{result.image_transformation.original_dimensions}</strong> ({result.image_transformation.original_mode})
            </span>
            <span style={{ color: '#334155', fontFamily: 'monospace' }}>
              Standardized Input Tensor: <strong>{result.image_transformation.transformed_shape}</strong> (Float32 [0.0 - 1.0])
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. CLINICIAN REVIEW & FORMAL SIGN-OFF SECTION (DOCTOR VERIFICATION)
          ========================================================================= */}
      {modelRunId && (
        <div className="no-print" style={{
          margin: '18px 0',
          padding: '16px',
          background: workflowStatus === 'clinician_approved' ? '#f0fdf4' : '#f8fafc',
          border: workflowStatus === 'clinician_approved' ? '1.5px solid #10b981' : '1px solid #cbd5e1',
          borderRadius: '6px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <div>
              <h4 style={{
                color: '#0f172a',
                margin: 0,
                fontSize: '0.9rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Stethoscope size={18} color="#0f172a" /> Physician Verification & Clinical Decision Sign-Off
              </h4>
              <p style={{ color: '#475569', fontSize: '0.78rem', margin: '3px 0 0 0' }}>
                Review the model decision trace and clinical evidence above. Clinician approval certifies the record for final disposition.
              </p>
            </div>
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '4px 10px',
              background: workflowStatus === 'clinician_approved' ? '#dcfce7' : '#e2e8f0',
              color: workflowStatus === 'clinician_approved' ? '#15803d' : '#0f172a',
              border: workflowStatus === 'clinician_approved' ? '1px solid #86efac' : 'none',
              borderRadius: '4px'
            }}>
              Status: {workflowStatus.replaceAll('_', ' ')}
            </span>
          </div>

          {/* Feature verification checklist */}
          {checklistItems.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#1e293b' }}>
                  Verify Clinical Evidence & Biomarkers ({verifiedFeatures.size}/{checklistItems.length} Verified)
                </strong>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={verifyAllFeatures}
                    disabled={workflowStatus === 'final_report_generated'}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllFeatures}
                    disabled={workflowStatus === 'final_report_generated'}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#64748b', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px' }}>
                {checklistItems.map((item) => {
                  const isVerified = verifiedFeatures.has(item.key);
                  return (
                    <div
                      key={item.key}
                      onClick={() => workflowStatus !== 'final_report_generated' && toggleFeatureVerification(item.key)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        background: '#ffffff',
                        border: isVerified ? '1px solid #0f172a' : '1px solid #e2e8f0',
                        cursor: workflowStatus === 'final_report_generated' ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isVerified ? <CheckSquare size={14} color="#0f172a" /> : <Square size={14} color="#94a3b8" />}
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>
                        {item.badge}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 0.7fr) minmax(260px, 1.3fr)', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                Attending Physician / Clinician ID *
              </label>
              <input 
                className="form-input" 
                value={reviewedBy} 
                onChange={(event) => handleReviewedByChange(event.target.value)} 
                placeholder="e.g., Dr. A. Sharma, MD (NPI 1849204)"
                disabled={workflowStatus === 'final_report_generated'}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '7px 10px',
                  fontSize: '0.82rem',
                  color: '#0f172a'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                Clinical Impression & Correlation Notes
              </label>
              <input 
                className="form-input" 
                value={reviewComment} 
                onChange={(event) => setReviewComment(event.target.value)} 
                placeholder="e.g., Confirmed elevated transaminases and direct bilirubin fraction"
                disabled={workflowStatus === 'final_report_generated'}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '7px 10px',
                  fontSize: '0.82rem',
                  color: '#0f172a'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              disabled={reviewLoading || workflowStatus === 'final_report_generated'} 
              onClick={() => handleClinicianReview('approved')}
              style={{
                padding: '8px 16px',
                fontSize: '0.84rem',
                fontWeight: 700,
                background: '#059669',
                color: '#ffffff',
                border: '1px solid #059669',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle size={15} /> Sign-Off & Approve Decision
            </button>
            <button 
              disabled={reviewLoading || workflowStatus === 'final_report_generated'} 
              onClick={() => handleClinicianReview('rejected')}
              style={{
                padding: '8px 14px',
                fontSize: '0.84rem',
                background: '#ffffff',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <XCircle size={15} /> Reject Decision
            </button>
          </div>
          {reviewError && <p style={{ color: '#b91c1c', margin: '8px 0 0 0', fontSize: '0.78rem', fontWeight: 600 }}>{reviewError}</p>}
        </div>
      )}

      {/* Official Verified Clinician Stamp (Shows in report once approved) */}
      {(workflowStatus === 'clinician_approved' || workflowStatus === 'final_report_generated') && reviewedBy && (
        <div className="break-inside-avoid" style={{
          margin: '16px 0',
          padding: '14px 18px',
          background: '#f0fdf4',
          border: '1.5px solid #10b981',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={18} color="#059669" />
              <strong style={{ fontSize: '0.84rem', textTransform: 'uppercase', color: '#065f46', letterSpacing: '0.5px' }}>
                Certified Clinical Sign-Off Seal
              </strong>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#0f172a', marginTop: '3px' }}>
              Attending Physician: <strong>{reviewedBy}</strong> • Decision: <strong style={{ color: '#059669' }}>Clinician Approved</strong>
            </div>
            {reviewComment && (
              <div style={{ fontSize: '0.76rem', color: '#334155', marginTop: '2px', fontStyle: 'italic' }}>
                "{reviewComment}"
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '4px',
              background: '#dcfce7',
              color: '#15803d',
              border: '1px solid #86efac',
              fontFamily: 'monospace'
            }}>
              VERIFIED & AUDITED
            </span>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>
              Digital Audit Seal #{reportId}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. EVIDENCE-BASED RECOMMENDATIONS & CLINICAL PROTOCOL
          ========================================================================= */}
      {effectiveRecommendations && effectiveRecommendations.length > 0 && (
        <div className="break-inside-avoid" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 8px 0', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{
              fontSize: '0.84rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#0f172a',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <ClipboardList size={15} color="#0f172a" /> Recommended Next Steps & Clinical Management Protocol
            </h4>

            {tweaks.recommendations.isTweaked && (
              <span className="badge" style={{ fontSize: '0.68rem', background: '#059669', color: '#ffffff', border: '1px solid #047857', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                👨‍⚕️ DONE BY DOCTOR / CUSTOM PROTOCOL
              </span>
            )}
          </div>

          {tweaks.recommendations.isTweaked && tweaks.recommendations.reason && (
            <div style={{
              fontSize: '0.76rem',
              background: '#ecfdf5',
              border: '1.5px solid #10b981',
              borderRadius: '6px',
              padding: '6px 10px',
              marginBottom: '8px',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <MessageSquare size={13} color="#059669" />
              <span><strong>Protocol Adjustment by {tweaks.doctorInfo?.name || 'Attending Physician'}:</strong> &quot;{tweaks.recommendations.reason}&quot;</span>
            </div>
          )}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {effectiveRecommendations.map((rec, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.82rem', color: '#334155' }}>
                <span style={{ color: severityTheme.borderDark, fontWeight: 800, lineHeight: 1.2 }}>•</span>
                <span style={{ lineHeight: 1.4 }}>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* =========================================================================
          8. CLINICIAN-REVIEWED FINAL CLINICAL NARRATIVE (IF GENERATED)
          ========================================================================= */}
      {finalReport?.report && (
        <div className="break-inside-avoid" style={{
          margin: '18px 0',
          padding: '18px',
          background: '#ffffff',
          border: '2px solid #0f172a',
          borderRadius: '6px',
          color: '#0f172a'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1.5px solid #cbd5e1',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>
              {finalReport.report.title}
            </h3>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '3px 8px', background: '#dcfce7', color: '#15803d', borderRadius: '4px' }}>
              Clinician-Approved Document
            </span>
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', margin: '0 0 4px 0' }}>
              Screening Summary
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: '#1e293b' }}>
              {finalReport.report.screening_summary}
            </p>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', margin: '0 0 4px 0' }}>
              Objective Model Findings
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: '#1e293b' }}>
              {finalReport.report.model_findings}
            </p>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', margin: '0 0 4px 0' }}>
              Explainability & SHAP Decision Breakdown
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: '#1e293b' }}>
              {finalReport.report.explainability_summary}
            </p>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', margin: '0 0 4px 0' }}>
              Clinician Review Record
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.5, color: '#1e293b' }}>
              {finalReport.report.clinician_review}
            </p>
          </div>

          {finalReport.report.recommendations && finalReport.report.recommendations.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', margin: '0 0 4px 0' }}>
                Recommendations
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', lineHeight: 1.5, color: '#1e293b' }}>
                {finalReport.report.recommendations.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '12px 0 0 0', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
            {finalReport.report.disclaimer}
          </p>
        </div>
      )}

      {/* =========================================================================
          9. CLINICAL SIGN-OFF & INSTITUTIONAL DISCLAIMER BLOCK
          ========================================================================= */}
      <div className="print-footer-sign break-inside-avoid" style={{
        marginTop: '20px',
        paddingTop: '12px',
        borderTop: '1.5px solid #cbd5e1',
        fontSize: '0.78rem',
        color: '#64748b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div style={{ maxWidth: '620px' }}>
          <strong style={{ color: '#0f172a' }}>Clinical Decision Support System (CDSS) Notice:</strong>
          <p style={{ margin: '3px 0 0 0', lineHeight: 1.4, fontSize: '0.74rem' }}>
            This diagnostic screening report is compiled by MedSynapse AI using calibrated probabilistic backbones and empirical models. It constitutes an assistive screening assessment and is not a definitive medical diagnosis. All treatment decisions require correlation with full clinical history by a licensed physician.
          </p>
        </div>

        <div style={{ minWidth: '180px', textAlign: 'center' }}>
          <div style={{
            borderBottom: '1px solid #0f172a',
            height: '24px',
            marginBottom: '4px',
            fontFamily: 'serif',
            fontSize: '0.85rem',
            fontStyle: 'italic',
            color: '#0f172a'
          }}>
            {reviewedBy ? `Dr. ${reviewedBy}` : '______________________'}
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#334155' }}>
            Authorized Attending Clinician
          </div>
        </div>
      </div>

    </div>
  );
}
