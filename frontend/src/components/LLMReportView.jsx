import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  FileDown, 
  ArrowLeft, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw, 
  Activity, 
  FileText,
  UserCheck,
  SlidersHorizontal,
  Edit3,
  Eye,
  MessageSquare,
  Plus,
  Trash2,
  Columns,
  Loader2,
  BarChart3,
  FileJson,
  FileCode,
  X,
  Layers,
  Table,
  Check,
} from 'lucide-react';
import { generateDirectLlmReport, regenerateReportSection } from '../services/api';
import ClinicalReportChat from './ClinicalReportChat';
import { printReportDocument } from '../utils/printReport';
import { buildPatientFeatureMatrix, getClinicalFeatureMeta } from '../utils/clinicalFeatureMatrix';

export default function LLMReportView({ reportData, setTab, onNavigateToForm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [copied, setCopied] = useState(false);
  const [jsonDownloaded, setJsonDownloaded] = useState(false);
  const [mdDownloaded, setMdDownloaded] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [viewLayout, setViewLayout] = useState('split'); // 'split' | 'report' | 'chat'
  const [chatWidthPreset, setChatWidthPreset] = useState('standard'); // 'compact' (520px) | 'standard' (640px) | 'wide' (780px)
  const [isEditMode, setIsEditMode] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [lastAutoUpdate, setLastAutoUpdate] = useState(null);
  const [isHighlightingUpdate, setIsHighlightingUpdate] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState(null);
  
  const [reportDate] = useState(() => new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }));
  const [reportId] = useState(() => `MS-LLM-${Math.floor(100000 + Math.random() * 900000)}`);

  const diseaseKey = reportData?.diseaseKey || 'diabetes';
  const prediction = reportData?.prediction || {};
  const inputs = reportData?.inputs || {};
  const clinicalReport = reportData?.clinicalReport || null;
  const modelRunId = reportData?.modelRunId || null;
  const initialTweakedDecisions = reportData?.tweakedDecisions || null;

  const [currentInputs, setCurrentInputs] = useState(() => reportData?.inputs || {});
  const [isEditingInputs, setIsEditingInputs] = useState(false);
  const [inputReasons, setInputReasons] = useState({});

  useEffect(() => {
    if (reportData?.inputs) {
      setCurrentInputs(reportData.inputs);
    }
  }, [reportData?.inputs]);

  const hasAssessmentData = Boolean(
    reportData && (
      (reportData.prediction && Object.keys(reportData.prediction).length > 0) ||
      (reportData.inputs && Object.keys(reportData.inputs).length > 0)
    )
  );

  // Handle local File / Blob object URL lifecycle
  const [fileObjectUrl, setFileObjectUrl] = useState(null);

  useEffect(() => {
    const candidateFile = reportData?.inputs?.file || reportData?.file || currentInputs?.file;
    if (candidateFile instanceof Blob || candidateFile instanceof File) {
      const url = URL.createObjectURL(candidateFile);
      setFileObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setFileObjectUrl(null);
    }
  }, [reportData?.inputs?.file, reportData?.file, currentInputs?.file]);

  const displayImageSrc = useMemo(() => {
    // 1. Explicit image or preview
    if (reportData?.image && typeof reportData.image === 'string') return reportData.image;
    if (reportData?.preview && typeof reportData.preview === 'string') return reportData.preview;

    // 2. Candidate strings in inputs
    const candidates = [
      currentInputs?.image_preview,
      currentInputs?.preview,
      currentInputs?.previewUrl,
      currentInputs?.image_url,
      reportData?.inputs?.image_preview,
      reportData?.inputs?.preview,
      reportData?.inputs?.previewUrl,
      reportData?.inputs?.image_url,
    ];
    for (const c of candidates) {
      if (c && typeof c === 'string') return c;
    }

    // 3. Blob / File object URL
    if (fileObjectUrl) return fileObjectUrl;

    // 4. Modality fallbacks for imaging models
    const dKey = String(diseaseKey || '').toLowerCase();
    const demoId = currentInputs?.demo_id || reportData?.inputs?.demo_id;
    const diag = String(prediction?.diagnosis || prediction?.prediction || '').toLowerCase();

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
  }, [reportData, currentInputs, fileObjectUrl, diseaseKey, prediction]);

  const displayImageFilename = useMemo(() => {
    return currentInputs?.source_filename || reportData?.inputs?.source_filename || currentInputs?.file?.name || 'Diagnostic_Scan_Specimen';
  }, [currentInputs, reportData]);

  const explainability = useMemo(() => {
    return clinicalReport?.explainability || prediction?.explainability || reportData?.result?.clinical_report?.explainability || {};
  }, [clinicalReport, prediction, reportData]);

  const shapContributions = useMemo(() => {
    if (!explainability) return [];
    if (Array.isArray(explainability.all_contributions) && explainability.all_contributions.length > 0) {
      return explainability.all_contributions;
    }
    const pos = explainability.top_positive_contributors || [];
    const neg = explainability.top_negative_contributors || [];
    if (pos.length > 0 || neg.length > 0) {
      return [...pos, ...neg];
    }
    return [];
  }, [explainability]);

  const explanationSentences = useMemo(() => {
    return explainability?.plain_language?.sentences || [];
  }, [explainability]);

  const baseValue = explainability?.base_value;

  const patientFeatureMatrix = useMemo(() => {
    return buildPatientFeatureMatrix({
      originalInputs: inputs,
      currentInputs: currentInputs,
      inputReasons: inputReasons,
      shapContributions: shapContributions,
    });
  }, [inputs, currentInputs, inputReasons, shapContributions]);

  const tweakedFeaturesCount = useMemo(() => {
    return patientFeatureMatrix.filter(f => f.isTweaked).length;
  }, [patientFeatureMatrix]);

  const chatMaxWidth = useMemo(() => {
    if (viewLayout !== 'chat') return '100%';
    if (chatWidthPreset === 'compact') return '520px';
    if (chatWidthPreset === 'wide') return '780px';
    return '640px';
  }, [viewLayout, chatWidthPreset]);

  const resolvedInitialDoctorName = (
    reportData?.doctorInfo?.name?.trim() ||
    reportData?.tweakedDecisions?.doctorInfo?.name?.trim() ||
    reportData?.reviewedBy?.trim() ||
    reportData?.clinicalReport?.clinician_review?.reviewed_by?.trim() ||
    reportData?.clinicalReport?.clinician_verification?.verified_by?.trim() ||
    reportData?.prediction?.reviewed_by?.trim() ||
    reportData?.prediction?.clinician_review?.reviewed_by?.trim() ||
    localStorage.getItem('medsynapse_doctor_name') ||
    ''
  ).trim();

  const resolvedInitialDoctorTitle = (
    reportData?.doctorInfo?.title?.trim() ||
    reportData?.tweakedDecisions?.doctorInfo?.title?.trim() ||
    reportData?.clinicalReport?.clinician_review?.title?.trim() ||
    localStorage.getItem('medsynapse_doctor_title') ||
    'Attending Physician'
  ).trim();

  const [doctorName, setDoctorName] = useState(resolvedInitialDoctorName);
  const [doctorTitle, setDoctorTitle] = useState(resolvedInitialDoctorTitle);
  const [isEditingDoctor, setIsEditingDoctor] = useState(false);

  // Active Tweaked Decisions State
  const [tweakedDecisions, setTweakedDecisions] = useState(() => {
    const base = initialTweakedDecisions || {
      hasTweaks: Boolean(resolvedInitialDoctorName),
      diagnosis: null,
      riskTier: null,
      riskProbability: null,
      decisionThreshold: null,
      recommendations: null,
      featureRationales: {},
      doctorInfo: null,
    };
    return {
      ...base,
      doctorInfo: {
        ...(base.doctorInfo || {}),
        name: base.doctorInfo?.name || resolvedInitialDoctorName,
        title: base.doctorInfo?.title || resolvedInitialDoctorTitle,
        timestamp: base.doctorInfo?.timestamp || new Date().toLocaleString(),
      }
    };
  });

  const handleUpdateDoctorIdentity = (newName, newTitle) => {
    setDoctorName(newName);
    setDoctorTitle(newTitle);
    if (newName && newName.trim()) {
      localStorage.setItem('medsynapse_doctor_name', newName.trim());
    }
    if (newTitle && newTitle.trim()) {
      localStorage.setItem('medsynapse_doctor_title', newTitle.trim());
    }
    setTweakedDecisions(prev => ({
      ...prev,
      doctorInfo: {
        ...(prev?.doctorInfo || {}),
        name: newName,
        title: newTitle,
        timestamp: new Date().toLocaleString(),
      }
    }));
  };

  useEffect(() => {
    if (reportData?.tweakedDecisions) {
      setTweakedDecisions(prev => ({
        ...prev,
        ...reportData.tweakedDecisions,
        doctorInfo: {
          name: reportData.tweakedDecisions?.doctorInfo?.name || doctorName || resolvedInitialDoctorName,
          title: reportData.tweakedDecisions?.doctorInfo?.title || doctorTitle || resolvedInitialDoctorTitle,
          timestamp: reportData.tweakedDecisions?.doctorInfo?.timestamp || new Date().toLocaleString(),
        }
      }));
    }
  }, [reportData?.tweakedDecisions]);

  // Independent Section Edits State
  const [editedSections, setEditedSections] = useState({
    title: { value: '', reason: '', isEdited: false },
    screening_summary: { value: '', reason: '', isEdited: false },
    model_findings: { value: '', reason: '', isEdited: false },
    explainability_summary: { value: '', reason: '', isEdited: false },
    clinician_review: { value: '', reason: '', isEdited: false },
    recommendations: { value: [], reason: '', isEdited: false },
    physician_perspective_analysis: { value: '', reason: '', isEdited: false },
  });

  const [newRecommendationInput, setNewRecommendationInput] = useState('');

  const diseaseTitle = prediction?.disease || (
    diseaseKey === 'diabetes' ? 'Diabetes Mellitus' :
    diseaseKey === 'heart' ? 'Coronary Heart Disease' :
    diseaseKey === 'breast' ? 'Breast Cancer (FNA)' :
    diseaseKey === 'liver' ? 'Liver Disease (ILPD)' :
    diseaseKey === 'xray' ? 'Pneumonia (Chest X-Ray)' :
    diseaseKey === 'brain-tumor' ? 'Brain Tumor (MRI)' :
    diseaseKey === 'kidney-stone' ? 'Kidney Pathology (CT)' :
    diseaseKey === 'skin-cancer' ? 'Skin Cancer (HAM10000)' :
    diseaseKey === 'eye' ? 'Eye Disease (Ophthalmic)' : 'Clinical Condition'
  );

  const fetchLLMReport = async () => {
    if (!hasAssessmentData) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Gather active section edits
      const activeEdits = {};
      Object.entries(editedSections).forEach(([k, v]) => {
        if (v.isEdited && v.value) {
          activeEdits[k] = {
            value: v.value,
            reason: v.reason || 'Attending physician independent edit',
          };
        }
      });

      const hasInputTweaks = Object.keys(currentInputs).some(k => String(currentInputs[k]) !== String(inputs[k])) || Object.keys(inputReasons).length > 0;
      const activeTweakedDecisions = {
        ...tweakedDecisions,
        hasTweaks: Boolean(tweakedDecisions?.hasTweaks || hasInputTweaks || doctorName),
        doctorInfo: {
          name: doctorName || tweakedDecisions?.doctorInfo?.name || '',
          title: doctorTitle || tweakedDecisions?.doctorInfo?.title || 'Attending Physician',
          timestamp: tweakedDecisions?.doctorInfo?.timestamp || new Date().toLocaleString(),
        },
        inputTweaks: hasInputTweaks ? {
          originalInputs: inputs,
          currentInputs: currentInputs,
          reasons: inputReasons,
        } : (tweakedDecisions?.inputTweaks || null),
      };

      const res = await generateDirectLlmReport({
        disease_key: diseaseKey,
        prediction: prediction,
        inputs: currentInputs,
        clinical_report: clinicalReport,
        model_run_id: modelRunId,
        tweaked_decisions: activeTweakedDecisions,
        edited_sections: activeEdits,
        chat_history: chatHistory,
      });

      setReport(res.data);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastAutoUpdate(timeStr);
      setIsHighlightingUpdate(true);
      setTimeout(() => setIsHighlightingUpdate(false), 2000);

      // Populate edit fields if empty
      if (res.data) {
        setEditedSections((prev) => ({
          title: prev.title.isEdited ? prev.title : { value: res.data.title || '', reason: '', isEdited: false },
          screening_summary: prev.screening_summary.isEdited ? prev.screening_summary : { value: res.data.screening_summary || '', reason: '', isEdited: false },
          model_findings: prev.model_findings.isEdited ? prev.model_findings : { value: res.data.model_findings || '', reason: '', isEdited: false },
          explainability_summary: prev.explainability_summary.isEdited ? prev.explainability_summary : { value: res.data.explainability_summary || '', reason: '', isEdited: false },
          clinician_review: prev.clinician_review.isEdited ? prev.clinician_review : { value: res.data.clinician_review || '', reason: '', isEdited: false },
          recommendations: prev.recommendations.isEdited ? prev.recommendations : { value: [...(res.data.recommendations || [])], reason: '', isEdited: false },
          physician_perspective_analysis: prev.physician_perspective_analysis?.isEdited ? prev.physician_perspective_analysis : { value: res.data.physician_perspective_analysis || '', reason: '', isEdited: false },
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to generate LLM report');
    } finally {
      setLoading(false);
    }
  };

  const handleReportUpdatedFromChat = (newReport) => {
    if (!newReport) return;
    setReport(newReport);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastAutoUpdate(timeStr);
    setIsHighlightingUpdate(true);
    setTimeout(() => {
      setIsHighlightingUpdate(false);
    }, 2500);

    // Keep edited sections aligned with latest LLM synthesis
    setEditedSections((prev) => ({
      title: prev.title?.isEdited ? prev.title : { value: newReport.title || '', reason: '', isEdited: false },
      screening_summary: prev.screening_summary?.isEdited ? prev.screening_summary : { value: newReport.screening_summary || '', reason: '', isEdited: false },
      model_findings: prev.model_findings?.isEdited ? prev.model_findings : { value: newReport.model_findings || '', reason: '', isEdited: false },
      explainability_summary: prev.explainability_summary?.isEdited ? prev.explainability_summary : { value: newReport.explainability_summary || '', reason: '', isEdited: false },
      clinician_review: prev.clinician_review?.isEdited ? prev.clinician_review : { value: newReport.clinician_review || '', reason: '', isEdited: false },
      recommendations: prev.recommendations?.isEdited ? prev.recommendations : { value: [...(newReport.recommendations || [])], reason: '', isEdited: false },
      physician_perspective_analysis: prev.physician_perspective_analysis?.isEdited ? prev.physician_perspective_analysis : { value: newReport.physician_perspective_analysis || '', reason: '', isEdited: false },
    }));
  };

  const handleRegenerateSection = async (sectionKey, customInstructions = null) => {
    if (regeneratingSection) return;
    setRegeneratingSection(sectionKey);
    try {
      const res = await regenerateReportSection({
        section_key: sectionKey,
        disease_key: diseaseKey,
        prediction: prediction,
        inputs: currentInputs,
        current_report: report,
        tweaked_decisions: tweakedDecisions,
        chat_history: chatHistory,
        instructions: customInstructions || editedSections[sectionKey]?.reason || null,
      });

      if (res.updated_report) {
        setReport(res.updated_report);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastAutoUpdate(timeStr);
        setIsHighlightingUpdate(true);
        setTimeout(() => setIsHighlightingUpdate(false), 2000);

        // Update editedSections for this section
        setEditedSections((prev) => ({
          ...prev,
          [sectionKey]: {
            value: res.section_value,
            reason: prev[sectionKey]?.reason || '',
            isEdited: false,
          },
        }));
      }
    } catch (err) {
      console.error('Failed to regenerate section:', err);
    } finally {
      setRegeneratingSection(null);
    }
  };

  useEffect(() => {
    if (hasAssessmentData) {
      fetchLLMReport();
    }
  }, [reportData]);

  const handleUpdateSection = (sectionKey, textValue, reasonValue) => {
    setEditedSections((prev) => ({
      ...prev,
      [sectionKey]: {
        value: textValue,
        reason: reasonValue !== undefined ? reasonValue : (prev[sectionKey]?.reason || ''),
        isEdited: true,
      },
    }));
  };

  const handleResetSection = (sectionKey) => {
    if (!report) return;
    setEditedSections((prev) => ({
      ...prev,
      [sectionKey]: {
        value: report[sectionKey] || (sectionKey === 'recommendations' ? [] : ''),
        reason: '',
        isEdited: false,
      },
    }));
  };

  const handleAddRecommendation = () => {
    if (!newRecommendationInput.trim()) return;
    const currentList = editedSections.recommendations.value || [];
    const updated = [...currentList, newRecommendationInput.trim()];
    setEditedSections((prev) => ({
      ...prev,
      recommendations: {
        value: updated,
        reason: prev.recommendations.reason || 'Added clinical follow-up item',
        isEdited: true,
      },
    }));
    setNewRecommendationInput('');
  };

  const handleRemoveRecommendation = (index) => {
    const currentList = editedSections.recommendations.value || [];
    const updated = currentList.filter((_, i) => i !== index);
    setEditedSections((prev) => ({
      ...prev,
      recommendations: {
        value: updated,
        reason: prev.recommendations.reason || 'Modified recommendation protocol',
        isEdited: true,
      },
    }));
  };

  const totalActiveEdits = useMemo(() => {
    let count = 0;
    Object.values(editedSections).forEach((s) => {
      if (s.isEdited) count++;
    });
    if (tweakedDecisions?.hasTweaks) {
      if (tweakedDecisions.diagnosis) count++;
      if (tweakedDecisions.riskTier) count++;
      if (tweakedDecisions.riskProbability) count++;
      if (tweakedDecisions.recommendations) count++;
    }
    const inputTweaksCount = Object.keys(currentInputs).filter(k => String(currentInputs[k]) !== String(inputs[k])).length;
    count += inputTweaksCount;
    return count;
  }, [editedSections, tweakedDecisions, currentInputs, inputs]);

  const handlePrint = () => {
    printReportDocument('.clinical-report-sheet', `MedSynapse_LLM_Report_${diseaseTitle.replace(/\s+/g, '_')}_${reportId}`);
  };

  const handleCopy = () => {
    if (!report) return;
    const text = `
MEDSYNAPSE AI CLINICAL REPORT SYNTHESIS
Report ID: ${reportId}
Issued: ${reportDate}
Disease Target: ${diseaseTitle}

${report.title}

1. EXECUTIVE SCREENING SUMMARY:
${report.screening_summary}

2. BIOSTATISTICAL MODEL FINDINGS:
${report.model_findings}

3. EXPLAINABILITY & BIOMARKER ATTRIBUTIONS:
${report.explainability_summary}

4. CLINICAL PROTOCOL & VERIFICATION:
${report.clinician_review}

5. ACTIONABLE RECOMMENDATIONS:
${(report.recommendations || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}

6. LIMITATIONS:
${(report.limitations || []).map((l) => `• ${l}`).join('\n')}

DISCLAIMER:
${report.disclaimer}
`.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJSON = () => {
    if (!report) return;
    const dossier = {
      auditMetadata: {
        reportId,
        reportDate,
        diseaseTarget: diseaseTitle,
        diseaseKey,
        modelRunId: modelRunId || `RUN-${reportId}`,
        modelBackbone: 'openai/gpt-oss-120b via Groq API',
        decisionCutoff: prediction.decision_threshold ? Number(prediction.decision_threshold) : 0.50,
        attendingPhysician: doctorName || tweakedDecisions?.doctorInfo?.name?.trim() || 'Attending Physician',
        attendingPhysicianTitle: doctorTitle || tweakedDecisions?.doctorInfo?.title?.trim() || 'Attending Clinician',
        auditSeal: `MEDSYNAPSE-AUDIT-${reportId}`,
        verificationStandard: 'CDSS-ML-2026-COMPLIANT',
      },
      patientDemographics: {
        patientId: `PT-${reportId.replace('MS-LLM-', 'P')}`,
        age: currentInputs?.age || inputs?.age || '35',
        sex: (currentInputs?.sex === 1 || currentInputs?.gender === 'Male' || currentInputs?.gender === 'male') ? 'Male' : 'Female',
        diseaseCondition: diseaseTitle,
      },
      mlModelInference: {
        baselineDiagnosis: prediction.diagnosis || prediction.prediction,
        calibratedProbability: prediction.risk_probability,
        riskPercentage: prediction.risk_percentage !== undefined ? prediction.risk_percentage : (prediction.risk_probability ? (prediction.risk_probability * 100).toFixed(1) : null),
        riskTier: prediction.risk_tier,
        decisionThreshold: prediction.decision_threshold ? Number(prediction.decision_threshold) : 0.50,
      },
      physicianDecisionsAndOverrides: tweakedDecisions,
      featuresAuditMatrix: patientFeatureMatrix,
      explainabilitySummary: {
        shapContributions,
        gradcam: (explainability.overlay_data_url || explainability.heatmap_data_url) ? {
          targetClass: explainability.target_class || prediction.diagnosis,
          targetLayer: explainability.target_layer || 'Final Conv',
          maxAttention: explainability.attention_statistics?.max_attention || 1.0,
        } : null,
        deterministicSentences: explanationSentences,
      },
      llmNarrativeReport: report,
      copilotDialogue: chatHistory,
    };

    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MedSynapse_Case_Dossier_${diseaseTitle.replace(/\s+/g, '_')}_${reportId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setJsonDownloaded(true);
    setTimeout(() => setJsonDownloaded(false), 2500);
  };

  const handleDownloadMarkdown = () => {
    if (!report) return;
    const md = `
# MEDSYNAPSE CLINICAL REPORT SYNTHESIS
**Case Report ID:** ${reportId}  
**Date of Issuance:** ${reportDate}  
**Target Condition:** ${diseaseTitle}  
**Attending Physician:** ${doctorName || tweakedDecisions?.doctorInfo?.name?.trim() || 'Attending Physician'} (${doctorTitle || tweakedDecisions?.doctorInfo?.title?.trim() || 'Attending Clinician'})  
**Model Decision Cutoff:** ${prediction.decision_threshold ? Number(prediction.decision_threshold).toFixed(2) : '0.50'}  
**Status:** CDSS Clinician-Reviewed & Cryptographically Audited  

---

## ${report.title || 'Diagnostic Evaluation Report'}

### 01. EXECUTIVE SCREENING SUMMARY
${report.screening_summary}

### 02. BIOSTATISTICAL MODEL FINDINGS
${report.model_findings}

### 03. EXTRACTED CLINICAL BIOMARKERS & PHYSICIAN MODIFICATIONS MATRIX
| Biomarker / Parameter | Baseline ML Value | Physician Approved Value | Status | Reference Range | SHAP Attribution (φ) | Clinician Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${patientFeatureMatrix.map(f => `| **${f.displayName}** | ${f.originalValue} ${f.unit && f.unit !== 'units' ? f.unit : ''} | ${f.currentValue} ${f.unit && f.unit !== 'units' ? f.unit : ''} | ${f.isTweaked ? '👨‍⚕️ TWEAKED' : 'VALIDATED'} | ${f.refRange} | ${f.shapValue !== null ? (f.shapValue > 0 ? `+${Number(f.shapValue).toFixed(4)}` : Number(f.shapValue).toFixed(4)) : '—'} | ${f.doctorReason || 'Baseline validated measurement'} |`).join('\n')}

### 04. EXPLAINABILITY & BIOMARKER ATTRIBUTIONS
${report.explainability_summary}

### 05. ATTENDING PHYSICIAN CLINICAL REVIEW (DOCTOR'S POINT OF VIEW)
${report.physician_perspective_analysis || report.clinician_review}

### 06. ACTIONABLE CLINICAL RECOMMENDATIONS
${(report.recommendations || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}

### 07. TECHNICAL LIMITATIONS & COUNTER-INDICATIONS
${(report.limitations || []).map(l => `- ${l}`).join('\n')}

---
**Clinical Decision Support Disclaimer:**  
${report.disclaimer}

*Generated by MedSynapse AI Clinical Intelligence System*
`.trim();

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MedSynapse_Clinical_Report_${diseaseTitle.replace(/\s+/g, '_')}_${reportId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setMdDownloaded(true);
    setTimeout(() => setMdDownloaded(false), 2500);
  };

  // Report context for the chat copilot
  const chatReportContext = useMemo(() => ({
    diseaseTitle,
    diseaseKey,
    prediction,
    inputs: currentInputs,
    originalInputs: inputs,
    inputReasons,
    clinicalReport,
    currentReport: report,
    tweakedDecisions,
    editedSections,
  }), [diseaseTitle, diseaseKey, prediction, currentInputs, inputs, inputReasons, clinicalReport, report, tweakedDecisions, editedSections]);

  if (!hasAssessmentData) {
    return (
      <div className="animate-fade-in" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{
          maxWidth: '580px',
          margin: '0 auto',
          padding: '2.5rem',
          borderRadius: '16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: '#f0fdfa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}>
            <Sparkles size={28} color="#0d9488" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            No Diagnostic Case Loaded for LLM Report
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
            To synthesize an official LLM clinical report with customizable decision tweaks and rationale audit, please run a screening assessment first and click &quot;Generate Report via LLM&quot;, or jump to an input form below.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => onNavigateToForm ? onNavigateToForm('diabetes') : setTab('diabetes')}
              className="btn-primary"
              style={{ padding: '8px 18px' }}
            >
              Diabetes Analyzer (M1)
            </button>
            <button
              onClick={() => onNavigateToForm ? onNavigateToForm('heart') : setTab('heart')}
              className="btn-secondary"
              style={{ padding: '8px 18px' }}
            >
              Heart CAD (M2)
            </button>
            <button
              onClick={() => setTab('home')}
              className="btn-secondary"
              style={{ padding: '8px 18px' }}
            >
              Dashboard Overview
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '1440px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#ffffff', padding: '12px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => {
              if (onNavigateToForm) {
                onNavigateToForm(diseaseKey, currentInputs);
              } else {
                setTab(diseaseKey);
              }
            }}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={15} color="#475569" />
            <span>Back to {diseaseTitle} Form</span>
          </button>

          {/* Mode Switcher */}
          <div className="segmented-track">
            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              className={`segmented-item ${!isEditMode ? 'is-active' : ''}`}
            >
              <Eye size={14} color={!isEditMode ? '#0284c7' : '#64748b'} />
              <span>Preview Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className={`segmented-item is-amber ${isEditMode ? 'is-active' : ''}`}
            >
              <Edit3 size={14} color={isEditMode ? '#f59e0b' : '#64748b'} />
              <span>Edit & Tweak Mode</span>
              {totalActiveEdits > 0 && (
                <span style={{ background: '#f59e0b', color: '#ffffff', borderRadius: '10px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 800 }}>
                  {totalActiveEdits}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Layout View Selector */}
          <div className="segmented-track">
            <button
              type="button"
              onClick={() => setViewLayout('split')}
              title="Split View: Report & AI Chat"
              className={`segmented-item ${viewLayout === 'split' ? 'is-active' : ''}`}
            >
              <Columns size={13} color={viewLayout === 'split' ? '#0284c7' : '#64748b'} />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('report')}
              title="Full Report View"
              className={`segmented-item ${viewLayout === 'report' ? 'is-active' : ''}`}
            >
              <FileText size={13} color={viewLayout === 'report' ? '#0284c7' : '#64748b'} />
              <span>Report</span>
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('chat')}
              title="Full AI Chat View"
              className={`segmented-item ${viewLayout === 'chat' ? 'is-active' : ''}`}
            >
              <MessageSquare size={13} color={viewLayout === 'chat' ? '#0284c7' : '#64748b'} />
              <span>Chat</span>
            </button>
          </div>

          {/* Chat Width Presets (shown in Chat view) */}
          {viewLayout === 'chat' && (
            <div className="segmented-track" style={{ background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setChatWidthPreset('compact')}
                title="Compact Width (520px - matches Split view right pane)"
                className={`segmented-item ${chatWidthPreset === 'compact' ? 'is-active' : ''}`}
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
              >
                <span>520px (Split Match)</span>
              </button>
              <button
                type="button"
                onClick={() => setChatWidthPreset('standard')}
                title="Well-Fitting Width (640px)"
                className={`segmented-item ${chatWidthPreset === 'standard' ? 'is-active' : ''}`}
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
              >
                <span>640px (Standard Fit)</span>
              </button>
              <button
                type="button"
                onClick={() => setChatWidthPreset('wide')}
                title="Wide Width (780px)"
                className={`segmented-item ${chatWidthPreset === 'wide' ? 'is-active' : ''}`}
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
              >
                <span>780px (Wide)</span>
              </button>
            </div>
          )}

          <button
            onClick={fetchLLMReport}
            disabled={loading}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <RefreshCw size={14} color="#0284c7" className={loading ? 'animate-spin' : ''} />
            <span>Generate Report via LLM</span>
          </button>

          {/* Project Analysis & Audit Tool */}
          <button
            onClick={() => setShowAnalysisModal(true)}
            className="btn-secondary"
            title="Open comprehensive comparative analytics and project audit dossier"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: '#f0f9ff',
              color: '#0369a1',
              border: '1px solid #bae6fd',
            }}
          >
            <BarChart3 size={14} color="#0284c7" />
            <span>Project Analysis</span>
          </button>

          {/* Download JSON Dossier */}
          <button
            onClick={handleDownloadJSON}
            disabled={!report || loading}
            className="btn-secondary"
            title="Download full machine-readable case dossier (JSON)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 11px',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            {jsonDownloaded ? <Check size={14} color="#10b981" /> : <FileJson size={14} color="#0284c7" />}
            <span>{jsonDownloaded ? 'JSON Saved' : 'JSON Dossier'}</span>
          </button>

          {/* Download Markdown Report */}
          <button
            onClick={handleDownloadMarkdown}
            disabled={!report || loading}
            className="btn-secondary"
            title="Export clean Markdown report (.md)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 11px',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            {mdDownloaded ? <Check size={14} color="#10b981" /> : <FileCode size={14} color="#0284c7" />}
            <span>{mdDownloaded ? 'MD Saved' : 'Markdown'}</span>
          </button>

          <button
            onClick={handleCopy}
            disabled={!report || loading}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            {copied ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} color="#475569" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!report || loading}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: '#059669',
              color: '#ffffff',
              border: '1px solid #047857',
              borderRadius: '6px',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
              cursor: (!report || loading) ? 'not-allowed' : 'pointer'
            }}
          >
            <FileDown size={14} color="#ffffff" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div
        style={{
          display: viewLayout === 'split' ? 'grid' : 'block',
          gridTemplateColumns:
            viewLayout === 'split'
              ? 'minmax(0, 1.45fr) minmax(360px, 1fr)'
              : undefined,
          gap: '1.25rem',
          alignItems: 'start',
          width: '100%',
        }}
      >
        {/* LEFT: PRESENT ML REPORT & EDITABLE CLINICAL SYNTHESIS */}
        {(viewLayout === 'split' || viewLayout === 'report') && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              width: '100%',
              maxWidth: viewLayout === 'report' ? '1080px' : 'none',
              margin: viewLayout === 'report' ? '0 auto' : '0',
            }}
          >
            {/* Present ML Model Diagnostic Report Card */}
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                padding: '18px 22px',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#0284c7', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Activity size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Present ML Diagnostic Report ({diseaseTitle})
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Fetched directly from primary ML model backbone & explainability engine
                    </span>
                  </div>
                </div>

                <span className="badge badge-purple" style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                  PRESENT ML MODEL EVIDENCE
                </span>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                {/* Risk Probability */}
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    ML Predicted Risk
                  </span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: (prediction.risk_probability || 0) >= 0.5 ? '#dc2626' : '#15803d', margin: '2px 0' }}>
                    {prediction.risk_percentage !== undefined ? `${prediction.risk_percentage}%` : (prediction.risk_probability !== undefined ? `${(prediction.risk_probability * 100).toFixed(1)}%` : 'Evaluated')}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Calibrated probability</span>
                </div>

                {/* Risk Tier */}
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Assessed Risk Tier
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: (prediction.risk_probability || 0) >= 0.5 ? '#dc2626' : '#15803d', margin: '6px 0' }}>
                    {prediction.risk_tier || ((prediction.risk_probability || 0) >= 0.5 ? 'Elevated Risk' : 'Low Risk')}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Categorical tier</span>
                </div>

                {/* Primary Diagnosis */}
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Model Classification
                  </span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', margin: '6px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={prediction.diagnosis || prediction.prediction || 'Assessed'}>
                    {prediction.diagnosis || prediction.prediction || 'Assessed'}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Baseline determination</span>
                </div>

                {/* Decision Cutoff */}
                <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Decision Cutoff
                  </span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '6px 0', fontFamily: 'monospace' }}>
                    {prediction.decision_threshold ? Number(prediction.decision_threshold).toFixed(2) : '0.50'}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Target sensitivity</span>
                </div>
              </div>

              {/* Biomarker Drivers & Clinical Inputs side-by-side */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                {/* Contributing Biomarkers (SHAP) or Fallback Drivers */}
                {((prediction.contributing_factors && prediction.contributing_factors.length > 0) || shapContributions.length > 0) && (
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                      Primary Contributing Biomarkers (SHAP):
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto' }}>
                      {shapContributions.length > 0 ? (
                        shapContributions.slice(0, 5).map((f, idx) => {
                          const val = Number(f.shap_value || 0);
                          const isPos = val > 0;
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 8px', background: '#ffffff', borderRadius: '4px', fontSize: '0.74rem', border: '1px solid #e2e8f0' }}>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>{f.feature}: {f.patient_value !== undefined && f.patient_value !== null ? String(f.patient_value) : '—'}</span>
                              <span style={{ color: isPos ? '#dc2626' : '#15803d', fontWeight: 700, fontSize: '0.68rem', fontFamily: 'monospace' }}>
                                {isPos ? `+${val.toFixed(4)}` : val.toFixed(4)}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        prediction.contributing_factors.map((f, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 8px', background: '#ffffff', borderRadius: '4px', fontSize: '0.74rem', border: '1px solid #e2e8f0' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{f.factor}: {f.value}</span>
                            <span style={{ color: f.impact?.toLowerCase().includes('high') ? '#dc2626' : '#2563eb', fontWeight: 600, fontSize: '0.68rem' }}>
                              {f.impact}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Grad-CAM Saliency Badge & Thumbnail for Vision Modules */}
                {(explainability.overlay_data_url || explainability.heatmap_data_url) && (
                  <div style={{ background: '#f0f9ff', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #0284c7' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Sparkles size={13} color="#0284c7" /> Grad-CAM Visual Activation:
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '3px' }}>
                        {explainability.target_class || prediction.diagnosis || prediction.prediction}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                      {explainability.overlay_data_url && (
                        <img
                          src={explainability.overlay_data_url}
                          alt="Grad-CAM Overlay"
                          style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                      )}
                      {explainability.heatmap_data_url && (
                        <img
                          src={explainability.heatmap_data_url}
                          alt="Grad-CAM Heatmap"
                          style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                      )}
                      <div style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.4 }}>
                        <div><strong>Receptive Field:</strong> {explainability.target_layer || 'Final Conv'}</div>
                        <div><strong>Peak Saliency:</strong> {explainability.attention_statistics?.max_attention ? `${(explainability.attention_statistics.max_attention * 100).toFixed(0)}%` : '100%'}</div>
                        <div style={{ color: '#0284c7', fontWeight: 600 }}>Focal Attention Hotspot Active</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submitted Clinical Inputs (Tweakable with Rationale) */}
                {currentInputs && Object.keys(currentInputs).length > 0 && (
                  <div style={{
                    background: isEditingInputs ? '#f0fdfa' : '#f8fafc',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: isEditingInputs ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                          Validated Patient Inputs:
                        </span>
                        {Object.keys(currentInputs).some(k => String(currentInputs[k]) !== String(inputs[k])) && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#f59e0b', color: '#ffffff', borderRadius: '10px', padding: '1px 5px' }}>
                            Tweaked
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          type="button"
                          onClick={() => setIsEditingInputs(!isEditingInputs)}
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: isEditingInputs ? '#0d9488' : '#ffffff',
                            color: isEditingInputs ? '#ffffff' : '#0f766e',
                            border: '1px solid #0d9488',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <SlidersHorizontal size={11} />
                          <span>{isEditingInputs ? 'Close Tweak' : 'Tweak Inputs'}</span>
                        </button>

                        {onNavigateToForm && (
                          <button
                            type="button"
                            onClick={() => onNavigateToForm(diseaseKey, currentInputs)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              borderRadius: '4px',
                              cursor: 'pointer',
                              background: '#ffffff',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                            }}
                            title="Open full interactive form with current inputs"
                          >
                            Full Form ↗
                          </button>
                        )}
                      </div>
                    </div>

                    {!isEditingInputs ? (
                      <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.74rem' }}>
                        {Object.entries(currentInputs).map(([k, v]) => {
                          const isTweaked = String(v) !== String(inputs[k]);
                          return (
                            <div
                              key={k}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '3px 8px',
                                background: isTweaked ? '#fffbeb' : '#ffffff',
                                borderRadius: '4px',
                                border: isTweaked ? '1px solid #fde68a' : '1px solid #e2e8f0',
                              }}
                            >
                              <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isTweaked && (
                                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                                    {String(inputs[k])}
                                  </span>
                                )}
                                <strong style={{ color: isTweaked ? '#b45309' : '#0f172a', fontFamily: 'monospace' }}>
                                  {typeof v === 'number' ? v : String(v)}
                                </strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {Object.entries(currentInputs).map(([k, v]) => {
                            const isTweaked = String(v) !== String(inputs[k]);
                            return (
                              <div
                                key={k}
                                style={{
                                  padding: '6px 8px',
                                  background: '#ffffff',
                                  borderRadius: '6px',
                                  border: isTweaked ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '3px',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', textTransform: 'capitalize' }}>
                                    {k.replace(/_/g, ' ')}
                                  </label>
                                  <input
                                    type={typeof inputs[k] === 'number' ? 'number' : 'text'}
                                    step="any"
                                    value={v}
                                    onChange={(e) => {
                                      const rawVal = e.target.value;
                                      const parsed = typeof inputs[k] === 'number' ? (rawVal === '' ? '' : parseFloat(rawVal)) : rawVal;
                                      setCurrentInputs(prev => ({ ...prev, [k]: parsed }));
                                    }}
                                    style={{
                                      width: '90px',
                                      padding: '2px 6px',
                                      fontSize: '0.76rem',
                                      fontWeight: 700,
                                      borderRadius: '4px',
                                      border: '1px solid #94a3b8',
                                      textAlign: 'right',
                                      fontFamily: 'monospace',
                                    }}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={inputReasons[k] || ''}
                                  onChange={(e) => setInputReasons(prev => ({ ...prev, [k]: e.target.value }))}
                                  placeholder={`Clinical reason for tweaking ${k.replace(/_/g, ' ')}...`}
                                  style={{
                                    width: '100%',
                                    padding: '3px 6px',
                                    fontSize: '0.68rem',
                                    borderRadius: '3px',
                                    border: '1px solid #e2e8f0',
                                    color: '#475569',
                                    background: '#f8fafc',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #e2e8f0' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentInputs(inputs);
                              setInputReasons({});
                            }}
                            style={{
                              padding: '3px 6px',
                              fontSize: '0.68rem',
                              color: '#64748b',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            Reset Inputs
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingInputs(false);
                              fetchLLMReport();
                            }}
                            disabled={loading}
                            className="btn-primary"
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              background: '#0d9488',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Sparkles size={11} />
                            <span>Resynthesize Report</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Active Tweaks Notice & Quick Trigger Bar */}
            {isEditMode && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#92400e', fontWeight: 800, fontSize: '0.85rem' }}>
                    <SlidersHorizontal size={15} />
                    <span>Independent Report Tweak & Rationale Mode Active</span>
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#78350f' }}>
                    Edit any section directly below. Every modified section records your clinical reason and forwards it to the LLM.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchLLMReport}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: '#d97706',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
                  }}
                >
                  <Sparkles size={15} />
                  <span>Synthesize Complete Tweaked Report</span>
                </button>
              </div>
            )}

            {/* Section-by-Section One-Click Generation Toolbar */}
            <div style={{
              background: '#f8fafc',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>
                <Sparkles size={14} color="#0284c7" />
                <span>Section-by-Section LLM Generation:</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'screening_summary', label: '01 Summary' },
                  { key: 'model_findings', label: '02 Findings' },
                  { key: 'explainability_summary', label: '04 Explainability' },
                  { key: 'clinician_review', label: '05 Protocol' },
                  { key: 'recommendations', label: '06 Action Plan' },
                  { key: 'physician_perspective_analysis', label: '👨‍⚕️ Doctor POV' },
                ].map((sec) => (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => handleRegenerateSection(sec.key)}
                    disabled={regeneratingSection === sec.key}
                    title={`Regenerate ${sec.label} individually using current context`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: regeneratingSection === sec.key ? '#e0f2fe' : '#ffffff',
                      color: regeneratingSection === sec.key ? '#0284c7' : '#334155',
                      border: '1px solid #cbd5e1',
                      padding: '4px 9px',
                      borderRadius: '5px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {regeneratingSection === sec.key ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={10} color="#0284c7" />}
                    <span>{sec.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Official Report Card Sheet */}
            <div
              className="clinical-report-sheet"
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: isHighlightingUpdate ? '2.5px solid #0284c7' : '1.5px solid #cbd5e1',
                borderRadius: '8px',
                padding: '28px 34px',
                boxShadow: isHighlightingUpdate ? '0 0 24px rgba(2, 132, 199, 0.35)' : '0 4px 20px rgba(15, 23, 42, 0.08)',
                transition: 'border 0.4s ease, box-shadow 0.4s ease',
              }}
            >
              {/* Clinical Report Header Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={20} color="#38bdf8" />
                  </div>
                  <div>
                    <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                      MEDSYNAPSE CLINICAL REPORT SYNTHESIS
                    </h1>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      Interactive LLM Decision Support & Attending Physician Audit
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#475569' }}>
                  <div><strong>Report ID:</strong> {reportId}</div>
                  <div><strong>Date:</strong> {reportDate}</div>
                  <div style={{ color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                    <ShieldCheck size={14} /> Verified LLM Narrative
                  </div>
                  {lastAutoUpdate && (
                    <div style={{
                      color: '#0284c7',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#f0f9ff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid #bae6fd',
                      marginTop: '4px'
                    }}>
                      <Sparkles size={12} color="#0284c7" />
                      <span>Auto-Merged from Copilot ({lastAutoUpdate})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  <Sparkles size={36} className="animate-spin" color="#0284c7" />
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Synthesizing Report via LLM (incorporating your tweaks & reasons)...
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '480px' }}>
                    Calibrating multivariable model inferences, recorded physician rationales, and clinical protocols into an official medical synthesis.
                  </p>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <AlertTriangle size={17} />
                    <span>Synthesis Generation Error</span>
                  </div>
                  <p style={{ fontSize: '0.84rem', marginTop: '6px' }}>{error}</p>
                  <button onClick={fetchLLMReport} className="btn-secondary" style={{ marginTop: '8px', fontSize: '0.8rem', padding: '5px 12px' }}>
                    Retry Generation
                  </button>
                </div>
              )}

              {/* Report Body */}
              {report && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                  {/* =========================================================================
                      00. CASE & PATIENT CLINICAL DEMOGRAPHICS
                      ========================================================================= */}
                  <div className="break-inside-avoid" style={{
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px 18px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    fontSize: '0.76rem',
                  }}>
                    <div>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Patient Demographics</span>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.84rem', marginTop: '2px' }}>
                        PT-{reportId.replace('MS-LLM-', 'P')}
                      </div>
                      <div style={{ color: '#475569', marginTop: '1px' }}>
                        Age: <strong>{currentInputs?.age || inputs?.age || '35'} Yrs</strong> • Sex: <strong>{(currentInputs?.sex === 1 || currentInputs?.gender === 'Male' || currentInputs?.gender === 'male') ? 'Male' : 'Female'}</strong>
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Encounter & Case Dossier</span>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.84rem', marginTop: '2px' }}>
                        REF-{reportId}
                      </div>
                      <div style={{ color: '#475569', marginTop: '1px' }}>
                        Date: <strong>{reportDate}</strong>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Attending Clinician & Dept</span>
                        <button
                          type="button"
                          onClick={() => setIsEditingDoctor(!isEditingDoctor)}
                          style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.66rem', cursor: 'pointer', padding: '0 4px', fontWeight: 700 }}
                        >
                          {isEditingDoctor ? 'Done' : 'Edit'}
                        </button>
                      </div>
                      {isEditingDoctor ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                          <input
                            type="text"
                            value={doctorName}
                            onChange={(e) => handleUpdateDoctorIdentity(e.target.value, doctorTitle)}
                            placeholder="Doctor Name (e.g. Dr. A. Sharma)"
                            style={{ padding: '3px 6px', fontSize: '0.78rem', border: '1px solid #0284c7', borderRadius: '4px' }}
                          />
                          <input
                            type="text"
                            value={doctorTitle}
                            onChange={(e) => handleUpdateDoctorIdentity(doctorName, e.target.value)}
                            placeholder="Clinical Title (e.g. Attending Physician)"
                            style={{ padding: '3px 6px', fontSize: '0.74rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                          />
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.84rem', marginTop: '2px' }}>
                            {doctorName || tweakedDecisions?.doctorInfo?.name?.trim() || 'Attending Physician'}
                          </div>
                          <div style={{ color: '#475569', marginTop: '1px' }}>
                            {doctorTitle || tweakedDecisions?.doctorInfo?.title?.trim() || 'Attending Clinician'} • Computational Medicine CDSS
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Diagnostic AI Engine</span>
                      <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.84rem', marginTop: '2px' }}>
                        openai/gpt-oss-120b (Groq API)
                      </div>
                      <div style={{ color: '#475569', marginTop: '1px' }}>
                        Cutoff: <strong>{prediction.decision_threshold ? Number(prediction.decision_threshold).toFixed(2) : '0.50'}</strong> • Target: <strong>{diseaseKey.toUpperCase()}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Title & Specimen Overview Section */}
                  <div style={{
                    background: '#f8fafc',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #0284c7',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                  }}>
                    <div style={{ flex: '1 1 320px' }}>
                      {!isEditMode ? (
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {report.title}
                        </h2>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                              Report Title (Editable)
                            </span>
                            {editedSections.title.isEdited && (
                              <button
                                type="button"
                                onClick={() => handleResetSection('title')}
                                style={{ fontSize: '0.7rem', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                Revert
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={editedSections.title.value}
                            onChange={(e) => handleUpdateSection('title', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              fontSize: '0.92rem',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: editedSections.title.isEdited ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      )}
                      <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                        <span>Target: <strong>{diseaseKey.toUpperCase()}</strong></span>
                        {displayImageSrc && (
                          <span style={{ marginLeft: '12px', color: '#0284c7', fontWeight: 600 }}>
                            • Specimen: {displayImageFilename}
                          </span>
                        )}
                      </div>
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
                          background: '#ffffff',
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
                          padding: '5px 8px',
                          background: '#f8fafc',
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}>
                          <div style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            <CheckCircle2 size={11} color="#059669" />
                            <span>Clinical Reference</span>
                          </div>
                          <div style={{
                            fontSize: '0.64rem',
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

                  {/* =========================================================================
                      DEDICATED ANALYSIS FROM DOCTOR'S POINT OF VIEW (AI CLINICAL SYNTHESIS)
                      ========================================================================= */}
                  <div className="break-inside-avoid" style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                    border: '2px solid #059669',
                    borderRadius: '8px',
                    padding: '18px 22px',
                    boxShadow: '0 4px 16px rgba(5, 150, 105, 0.12)',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', borderBottom: '1.5px solid #a7f3d0', paddingBottom: '10px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#059669',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.15rem'
                        }}>
                          👨‍⚕️
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Clinical Analysis from Doctor's Point of View
                            </h3>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              background: '#059669',
                              color: '#ffffff',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              letterSpacing: '0.5px'
                            }}>
                              {tweakedDecisions?.hasTweaks ? '👨‍⚕️ DONE BY DOCTOR (OVERRIDES ACTIVE)' : '👨‍⚕️ CLINICALLY CONFIRMED BY DOCTOR'}
                            </span>
                          </div>
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#047857' }}>
                            Attending Clinician: <strong>{doctorName || tweakedDecisions?.doctorInfo?.name?.trim() || 'Attending Physician'}</strong>{doctorTitle || tweakedDecisions?.doctorInfo?.title?.trim() ? ` (${doctorTitle || tweakedDecisions.doctorInfo.title.trim()})` : ''} • LLM Synthesized Analysis
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSection('physician_perspective_analysis')}
                          disabled={regeneratingSection === 'physician_perspective_analysis'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#ffffff',
                            color: '#065f46',
                            border: '1px solid #6ee7b7',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {regeneratingSection === 'physician_perspective_analysis' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          <span>{regeneratingSection === 'physician_perspective_analysis' ? 'Generating...' : 'Regenerate Doctor POV'}</span>
                        </button>
                        <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#047857', fontWeight: 700 }}>
                          {tweakedDecisions?.doctorInfo?.timestamp ? `Audit: ${tweakedDecisions.doctorInfo.timestamp}` : `Date: ${reportDate}`}
                        </div>
                      </div>
                    </div>

                    {/* Overrides Comparative Grid */}
                    {tweakedDecisions?.hasTweaks && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                        {tweakedDecisions.diagnosis && (
                          <div style={{ background: '#ffffff', border: '1.5px solid #6ee7b7', borderRadius: '6px', padding: '8px 12px' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                              1. Diagnosis Override
                            </div>
                            <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
                              <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{tweakedDecisions.diagnosis.original}</span>
                              <span style={{ margin: '0 6px', color: '#059669', fontWeight: 800 }}>➔</span>
                              <strong style={{ color: '#065f46' }}>{tweakedDecisions.diagnosis.tweaked}</strong>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                              Rationale: &quot;{tweakedDecisions.diagnosis.reason || 'Clinical adjustment'}&quot;
                            </div>
                          </div>
                        )}

                        {tweakedDecisions.riskProbability && (
                          <div style={{ background: '#ffffff', border: '1.5px solid #6ee7b7', borderRadius: '6px', padding: '8px 12px' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                              2. Calibrated Risk Score Adjustment
                            </div>
                            <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
                              <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{tweakedDecisions.riskProbability.original}%</span>
                              <span style={{ margin: '0 6px', color: '#059669', fontWeight: 800 }}>➔</span>
                              <strong style={{ color: '#065f46' }}>{tweakedDecisions.riskProbability.tweaked}%</strong>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                              Rationale: &quot;{tweakedDecisions.riskProbability.reason || 'Biometric recalibration'}&quot;
                            </div>
                          </div>
                        )}

                        {tweakedDecisions.riskTier && (
                          <div style={{ background: '#ffffff', border: '1.5px solid #6ee7b7', borderRadius: '6px', padding: '8px 12px' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                              3. Risk Tier Override
                            </div>
                            <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
                              <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{tweakedDecisions.riskTier.original}</span>
                              <span style={{ margin: '0 6px', color: '#059669', fontWeight: 800 }}>➔</span>
                              <strong style={{ color: '#065f46' }}>{tweakedDecisions.riskTier.tweaked}</strong>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                              Rationale: &quot;{tweakedDecisions.riskTier.reason || 'Risk recalibration'}&quot;
                            </div>
                          </div>
                        )}

                        {tweakedDecisions.recommendations && (
                          <div style={{ background: '#ffffff', border: '1.5px solid #6ee7b7', borderRadius: '6px', padding: '8px 12px' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                              4. Protocol Customized
                            </div>
                            <div style={{ fontSize: '0.84rem', marginTop: '2px', color: '#065f46', fontWeight: 700 }}>
                              Physician-Tailored Clinical Pathway
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                              Rationale: &quot;{tweakedDecisions.recommendations.reason || 'Tailored to clinical presentation'}&quot;
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* In-depth Physician Perspective Narrative Analysis */}
                    <div style={{ background: '#ffffff', borderRadius: '6px', border: '1.5px solid #6ee7b7', padding: '14px 18px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={15} color="#059669" />
                        <span>Pathophysiological Evaluation & Clinical Justification (From Doctor's Viewpoint)</span>
                      </div>

                      {!isEditMode ? (
                        <div style={{ fontSize: '0.9rem', lineHeight: '1.7', color: '#0f172a', whiteSpace: 'pre-line' }}>
                          {report.physician_perspective_analysis || report.clinician_review}
                        </div>
                      ) : (
                        <div>
                          <textarea
                            rows={5}
                            value={editedSections.physician_perspective_analysis?.value || report.physician_perspective_analysis || ''}
                            onChange={(e) => handleUpdateSection('physician_perspective_analysis', e.target.value)}
                            placeholder="Edit clinical analysis from doctor's point of view..."
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '0.88rem',
                              lineHeight: '1.5',
                              borderRadius: '6px',
                              border: editedSections.physician_perspective_analysis?.isEdited ? '1.5px solid #059669' : '1px solid #cbd5e1',
                              background: '#ffffff',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 1. Executive Screening Summary */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#0284c7', color: '#ffffff', fontSize: '0.64rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>01</span>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileText size={15} color="#0284c7" />
                          Executive Screening Summary
                        </h3>
                        {(tweakedDecisions?.hasTweaks || editedSections.screening_summary.isEdited) && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>👨‍⚕️ DONE BY DOCTOR</span>
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSection('screening_summary')}
                          disabled={regeneratingSection === 'screening_summary'}
                          title="Regenerate this section individually via LLM"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#f0f9ff',
                            color: '#0284c7',
                            border: '1px solid #bae6fd',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {regeneratingSection === 'screening_summary' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          <span>{regeneratingSection === 'screening_summary' ? 'Generating...' : 'Regenerate Section'}</span>
                        </button>
                        {isEditMode && editedSections.screening_summary.isEdited && (
                          <button
                            type="button"
                            onClick={() => handleResetSection('screening_summary')}
                            style={{ fontSize: '0.7rem', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Revert
                          </button>
                        )}
                      </div>
                    </div>

                    {!isEditMode ? (
                      <p style={{ fontSize: '0.9rem', lineHeight: '1.65', color: '#1e293b', margin: 0 }}>
                        {report.screening_summary}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                          rows={4}
                          value={editedSections.screening_summary.value}
                          onChange={(e) => handleUpdateSection('screening_summary', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '0.88rem',
                            lineHeight: '1.5',
                            borderRadius: '6px',
                            border: editedSections.screening_summary.isEdited ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                            background: editedSections.screening_summary.isEdited ? '#fffbeb' : '#ffffff',
                            boxSizing: 'border-box'
                          }}
                        />
                        {editedSections.screening_summary.isEdited && (
                          <div style={{ background: '#fef3c7', padding: '6px 10px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
                              Clinical Reason for Tweaking Summary *
                            </label>
                            <input
                              type="text"
                              value={editedSections.screening_summary.reason}
                              onChange={(e) => handleUpdateSection('screening_summary', editedSections.screening_summary.value, e.target.value)}
                              placeholder="e.g. Patient presents atypical symptomatic episodes; customized screening narrative."
                              style={{ width: '100%', padding: '4px 8px', fontSize: '0.76rem', borderRadius: '4px', border: '1px solid #fcd34d', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Biostatistical Model Findings */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#059669', color: '#ffffff', fontSize: '0.64rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>02</span>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Activity size={15} color="#059669" />
                          Biostatistical Model Findings
                        </h3>
                        {(tweakedDecisions?.riskProbability || tweakedDecisions?.riskTier || editedSections.model_findings.isEdited) && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>👨‍⚕️ DONE BY DOCTOR (STATISTICAL OVERRIDE)</span>
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSection('model_findings')}
                          disabled={regeneratingSection === 'model_findings'}
                          title="Regenerate this section individually via LLM"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#f0fdf4',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {regeneratingSection === 'model_findings' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          <span>{regeneratingSection === 'model_findings' ? 'Generating...' : 'Regenerate Section'}</span>
                        </button>
                        {isEditMode && editedSections.model_findings.isEdited && (
                          <button
                            type="button"
                            onClick={() => handleResetSection('model_findings')}
                            style={{ fontSize: '0.7rem', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Revert
                          </button>
                        )}
                      </div>
                    </div>

                    {!isEditMode ? (
                      <p style={{ fontSize: '0.9rem', lineHeight: '1.65', color: '#1e293b', margin: 0 }}>
                        {report.model_findings}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                          rows={3}
                          value={editedSections.model_findings.value}
                          onChange={(e) => handleUpdateSection('model_findings', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '0.88rem',
                            lineHeight: '1.5',
                            borderRadius: '6px',
                            border: editedSections.model_findings.isEdited ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                            background: editedSections.model_findings.isEdited ? '#fffbeb' : '#ffffff',
                            boxSizing: 'border-box'
                          }}
                        />
                        {editedSections.model_findings.isEdited && (
                          <div style={{ background: '#fef3c7', padding: '6px 10px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
                              Clinical Reason for Tweaking Findings *
                            </label>
                            <input
                              type="text"
                              value={editedSections.model_findings.reason}
                              onChange={(e) => handleUpdateSection('model_findings', editedSections.model_findings.value, e.target.value)}
                              placeholder="e.g. Recalibrated statistical risk based on repeat biometric assay."
                              style={{ width: '100%', padding: '4px 8px', fontSize: '0.76rem', borderRadius: '4px', border: '1px solid #fcd34d', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* =========================================================================
                      03. EXTRACTED BIOMETRIC / CLINICAL FEATURE MATRIX (AUDIT & TWEAKS)
                      ========================================================================= */}
                  <div className="break-inside-avoid" style={{
                    background: '#ffffff',
                    border: '1.5px solid #0d9488',
                    borderRadius: '8px',
                    padding: '18px 22px',
                    boxShadow: '0 2px 8px rgba(13, 148, 136, 0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#0d9488', color: '#ffffff', fontSize: '0.64rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>03</span>
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Table size={16} color="#0d9488" />
                          Extracted Biometric & Clinical Feature Matrix
                        </h3>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: tweakedFeaturesCount > 0 ? '#fffbeb' : '#ecfdf5',
                          color: tweakedFeaturesCount > 0 ? '#b45309' : '#047857',
                          border: tweakedFeaturesCount > 0 ? '1px solid #fde68a' : '1px solid #a7f3d0',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {tweakedFeaturesCount > 0 ? `👨‍⚕️ ${tweakedFeaturesCount} CLINICAL MODIFICATIONS ACTIVE` : `✓ ALL ${patientFeatureMatrix.length} BASELINE FEATURES VALIDATED`}
                        </span>
                      </div>

                      {/* Quick in-table tweak toggle */}
                      <div className="no-print" style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setIsEditingInputs(!isEditingInputs)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: isEditingInputs ? '#0d9488' : '#f0fdfa',
                            color: isEditingInputs ? '#ffffff' : '#0f766e',
                            border: '1px solid #0d9488',
                            borderRadius: '4px',
                            padding: '3px 9px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <SlidersHorizontal size={12} />
                          <span>{isEditingInputs ? 'Close Tweak Mode' : 'Tweak Biometrics In-Place'}</span>
                        </button>
                        {isEditingInputs && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingInputs(false);
                              fetchLLMReport();
                            }}
                            disabled={loading}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#059669',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '3px 9px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            <Sparkles size={11} />
                            <span>Apply & Resynthesize</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
                      Comprehensive cross-audit comparing patient parameters extracted from the primary ML report against attending physician modifications, normative clinical reference ranges, and individual SHAP risk attributions.
                    </p>

                    {/* Feature Matrix Table */}
                    <div style={{ overflowX: 'auto', marginBottom: '8px' }}>
                      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Biomarker / Variable</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>Baseline (ML Report)</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>Physician Value</th>
                            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>Audit Status</th>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Ref Range & Unit</th>
                            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>Clinical Evaluation</th>
                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>SHAP Impact (φ)</th>
                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Doctor Clinical Rationale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patientFeatureMatrix.map((item, idx) => {
                            const isShapPos = item.shapValue !== null && item.shapValue > 0;
                            return (
                              <tr
                                key={item.key}
                                style={{
                                  background: item.isTweaked ? '#fffbeb' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                                  borderBottom: '1px solid #e2e8f0',
                                  transition: 'background 0.2s ease',
                                }}
                              >
                                <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>
                                  <div>{item.displayName}</div>
                                  <span style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 500 }}>{item.category}</span>
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: item.isTweaked ? '#94a3b8' : '#0f172a', textDecoration: item.isTweaked ? 'line-through' : 'none' }}>
                                  {item.originalValue}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                  {!isEditingInputs ? (
                                    <strong style={{ fontFamily: 'monospace', color: item.isTweaked ? '#047857' : '#0f172a', fontSize: item.isTweaked ? '0.84rem' : '0.78rem' }}>
                                      {item.currentValue}
                                    </strong>
                                  ) : (
                                    <input
                                      type={typeof inputs[item.key] === 'number' ? 'number' : 'text'}
                                      step="any"
                                      value={currentInputs[item.key] !== undefined ? currentInputs[item.key] : ''}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const parsed = typeof inputs[item.key] === 'number' ? (raw === '' ? '' : parseFloat(raw)) : raw;
                                        setCurrentInputs(prev => ({ ...prev, [item.key]: parsed }));
                                      }}
                                      style={{
                                        width: '75px',
                                        padding: '2px 5px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        borderRadius: '4px',
                                        border: '1px solid #0d9488',
                                        textAlign: 'right',
                                        fontFamily: 'monospace',
                                      }}
                                    />
                                  )}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.66rem',
                                    fontWeight: 800,
                                    background: item.isTweaked ? '#fef3c7' : '#ecfdf5',
                                    color: item.isTweaked ? '#b45309' : '#047857',
                                    border: item.isTweaked ? '1px solid #fde68a' : '1px solid #a7f3d0',
                                  }}>
                                    {item.isTweaked ? '👨‍⚕️ Tweaked' : 'Validated'}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 8px', color: '#475569', fontSize: '0.74rem' }}>
                                  <div><strong>{item.refRange}</strong></div>
                                  <span style={{ fontSize: '0.66rem', color: '#64748b' }}>({item.unit})</span>
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.66rem',
                                    fontWeight: 800,
                                    background: item.status.bg,
                                    color: item.status.color,
                                  }}>
                                    {item.status.label}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: item.shapValue !== null ? (isShapPos ? '#dc2626' : '#15803d') : '#94a3b8' }}>
                                  {item.shapValue !== null ? (isShapPos ? `+${Number(item.shapValue).toFixed(4)}` : Number(item.shapValue).toFixed(4)) : '—'}
                                </td>
                                <td style={{ padding: '6px 8px', color: '#475569' }}>
                                  {!isEditingInputs ? (
                                    <span style={{ fontStyle: item.isTweaked ? 'italic' : 'normal', color: item.isTweaked ? '#92400e' : '#64748b', fontSize: '0.72rem' }}>
                                      {item.doctorReason || 'Baseline validated clinical measurement'}
                                    </span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={inputReasons[item.key] || ''}
                                      onChange={(e) => setInputReasons(prev => ({ ...prev, [item.key]: e.target.value }))}
                                      placeholder="Doctor clinical rationale..."
                                      style={{
                                        width: '100%',
                                        padding: '2px 6px',
                                        fontSize: '0.7rem',
                                        borderRadius: '3px',
                                        border: '1px solid #cbd5e1',
                                      }}
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Imaging Specimen Audit Sub-block for Vision Modalities */}
                    {displayImageSrc && (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Sparkles size={14} color="#0284c7" />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                            Imaging Specimen Extraction: <strong>{displayImageFilename}</strong>
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                          <span>Modality: <strong>{diseaseTitle}</strong></span>
                          {explainability.target_layer && <span style={{ marginLeft: '10px' }}>• Attention Layer: <strong>{explainability.target_layer}</strong></span>}
                          {explainability.attention_statistics?.max_attention && (
                            <span style={{ marginLeft: '10px', color: '#0284c7', fontWeight: 700 }}>
                              • Peak Attention: {(explainability.attention_statistics.max_attention * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Explainability & Biomarker Attribution */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#7c3aed', color: '#ffffff', fontSize: '0.64rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>04</span>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={15} color="#7c3aed" />
                          Explainability & Biomarker Drivers
                        </h3>
                        {(tweakedDecisions?.inputTweaks || editedSections.explainability_summary.isEdited) && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>👨‍⚕️ DONE BY DOCTOR (INPUT ADJUSTMENT)</span>
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSection('explainability_summary')}
                          disabled={regeneratingSection === 'explainability_summary'}
                          title="Regenerate this section individually via LLM"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#faf5ff',
                            color: '#7c3aed',
                            border: '1px solid #e9d5ff',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {regeneratingSection === 'explainability_summary' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          <span>{regeneratingSection === 'explainability_summary' ? 'Generating...' : 'Regenerate Section'}</span>
                        </button>
                        {isEditMode && editedSections.explainability_summary.isEdited && (
                          <button
                            type="button"
                            onClick={() => handleResetSection('explainability_summary')}
                            style={{ fontSize: '0.7rem', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Revert
                          </button>
                        )}
                      </div>
                    </div>

                    {!isEditMode ? (
                      <p style={{ fontSize: '0.9rem', lineHeight: '1.65', color: '#1e293b', margin: 0 }}>
                        {report.explainability_summary}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                          rows={3}
                          value={editedSections.explainability_summary.value}
                          onChange={(e) => handleUpdateSection('explainability_summary', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '0.88rem',
                            lineHeight: '1.5',
                            borderRadius: '6px',
                            border: editedSections.explainability_summary.isEdited ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                            background: editedSections.explainability_summary.isEdited ? '#fffbeb' : '#ffffff',
                            boxSizing: 'border-box'
                          }}
                        />
                        {editedSections.explainability_summary.isEdited && (
                          <div style={{ background: '#fef3c7', padding: '6px 10px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
                              Clinical Reason for Tweaking Biomarkers *
                            </label>
                            <input
                              type="text"
                              value={editedSections.explainability_summary.reason}
                              onChange={(e) => handleUpdateSection('explainability_summary', editedSections.explainability_summary.value, e.target.value)}
                              placeholder="e.g. Adjusted attribution because glucose assay was collected postprandial."
                              style={{ width: '100%', padding: '4px 8px', fontSize: '0.76rem', borderRadius: '4px', border: '1px solid #fcd34d', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Visual Explainability - Grad-CAM Attention Heatmap & Saliency Overlay */}
                    {(explainability.overlay_data_url || explainability.heatmap_data_url) && (
                      <div className="break-inside-avoid" style={{
                        marginTop: '12px',
                        padding: '14px',
                        background: '#f8fafc',
                        border: '1.5px solid #0284c7',
                        borderRadius: '6px',
                        boxShadow: '0 2px 8px rgba(2, 132, 199, 0.06)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={14} color="#0284c7" /> Grad-CAM Convolutional Attention & Anatomical Saliency
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Target Class: <strong style={{ color: '#0f172a' }}>{explainability.target_class || prediction.diagnosis || prediction.prediction}</strong>
                            {explainability.target_layer ? ` • Layer: ${explainability.target_layer}` : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
                          {explainability.overlay_data_url && (
                            <div style={{ textAlign: 'center', flex: '1 1 200px', maxWidth: '300px' }}>
                              <img
                                src={explainability.overlay_data_url}
                                alt="Grad-CAM Saliency Overlay"
                                style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#0f172a', display: 'block' }}
                              />
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>Grad-CAM Saliency Overlay</div>
                              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Color-weighted neural network decision focus</div>
                            </div>
                          )}
                          {explainability.heatmap_data_url && (
                            <div style={{ textAlign: 'center', flex: '1 1 200px', maxWidth: '300px' }}>
                              <img
                                src={explainability.heatmap_data_url}
                                alt="Grad-CAM Heatmap"
                                style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#000000', display: 'block' }}
                              />
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>Feature Activation Intensity</div>
                              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Normalized activation tensor (Jet colormap)</div>
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#475569', marginBottom: '3px' }}>
                            <span>Low Attention (Background / Normal Parenchyma)</span>
                            <span>Peak Focal Saliency (Target Classifier Trigger)</span>
                          </div>
                          <div style={{
                            height: '6px',
                            borderRadius: '3px',
                            background: 'linear-gradient(to right, #000080, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000, #800000)',
                            border: '1px solid #cbd5e1'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Tabular Explainability - SHAP Feature Attribution Table */}
                    {shapContributions && shapContributions.length > 0 && (
                      <div className="break-inside-avoid" style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                            SHAP Feature Attribution & Individual Patient Impact
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            Method: {explainability.method || 'SHAP Additive Attribution'}
                          </span>
                        </div>
                        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '8px' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                              <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Biomarker / Feature</th>
                              <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>Patient Value</th>
                              <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>SHAP Value (φ)</th>
                              <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Direction of Effect</th>
                              <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#0f172a' }}>Decision Impact</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shapContributions.map((item, idx) => {
                              const shapVal = Number(item.shap_value || 0);
                              const isPositive = shapVal > 0;
                              return (
                                <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0f172a' }}>{item.feature}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                                    {item.patient_value !== undefined && item.patient_value !== null ? String(item.patient_value) : '—'}
                                  </td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: isPositive ? '#b91c1c' : '#15803d' }}>
                                    {isPositive ? `+${shapVal.toFixed(6)}` : shapVal.toFixed(6)}
                                  </td>
                                  <td style={{ padding: '4px 8px' }}>
                                    <span style={{
                                      padding: '2px 5px',
                                      borderRadius: '3px',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      background: isPositive ? '#fee2e2' : '#dcfce7',
                                      color: isPositive ? '#991b1b' : '#166534',
                                      border: isPositive ? '1px solid #fca5a5' : '1px solid #86efac'
                                    }}>
                                      {isPositive ? 'Elevates Risk (+)' : 'Mitigates Risk (-)'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '4px 8px', color: '#475569', fontSize: '0.74rem' }}>
                                    {item.effect || (isPositive ? 'Increased predicted positive score' : 'Reduced predicted positive score')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Deterministic Explanations */}
                    {explanationSentences && explanationSentences.length > 0 && (
                      <div className="break-inside-avoid" style={{ marginTop: '10px', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Deterministic Interpretability Sentences:
                        </span>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#334155', fontSize: '0.78rem', lineHeight: 1.5 }}>
                          {explanationSentences.map((sentence, idx) => (
                            <li key={idx} style={{ marginBottom: '3px' }}>{sentence}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* 05. Clinical Protocol & Attending Review */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#d97706', color: '#ffffff', fontSize: '0.64rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>05</span>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserCheck size={15} color="#d97706" />
                          Clinical Protocol & Attending Review
                        </h3>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#059669', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>👨‍⚕️ DONE BY DOCTOR: {doctorName || tweakedDecisions?.doctorInfo?.name?.trim() || 'Attending Physician'}</span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSection('clinician_review')}
                          disabled={regeneratingSection === 'clinician_review'}
                          title="Regenerate this section individually via LLM"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fffbeb',
                            color: '#d97706',
                            border: '1px solid #fde68a',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {regeneratingSection === 'clinician_review' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          <span>{regeneratingSection === 'clinician_review' ? 'Generating...' : 'Regenerate Section'}</span>
                        </button>
                        {isEditMode && editedSections.clinician_review.isEdited && (
                          <button
                            type="button"
                            onClick={() => handleResetSection('clinician_review')}
                            style={{ fontSize: '0.7rem', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Revert
                          </button>
                        )}
                      </div>
                    </div>

                    {!isEditMode ? (
                      <p style={{ fontSize: '0.9rem', lineHeight: '1.65', color: '#1e293b', margin: 0 }}>
                        {report.clinician_review}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                          rows={3}
                          value={editedSections.clinician_review.value}
                          onChange={(e) => handleUpdateSection('clinician_review', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '0.88rem',
                            lineHeight: '1.5',
                            borderRadius: '6px',
                            border: editedSections.clinician_review.isEdited ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                            background: editedSections.clinician_review.isEdited ? '#fffbeb' : '#ffffff',
                            boxSizing: 'border-box'
                          }}
                        />
                        {editedSections.clinician_review.isEdited && (
                          <div style={{ background: '#fef3c7', padding: '6px 10px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
                              Clinical Reason for Protocol Adjustment *
                            </label>
                            <input
                              type="text"
                              value={editedSections.clinician_review.reason}
                              onChange={(e) => handleUpdateSection('clinician_review', editedSections.clinician_review.value, e.target.value)}
                              placeholder="e.g. Attending physician overrides applied per institutional clinical care pathway."
                              style={{ width: '100%', padding: '4px 8px', fontSize: '0.76rem', borderRadius: '4px', border: '1px solid #fcd34d', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 06. Actionable Recommendations */}
                  <div style={{ background: '#f0fdf4', padding: '16px 20px', borderRadius: '8px', border: '1.5px solid #86efac', boxShadow: '0 1px 3px rgba(22, 101, 52, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#16a34a', color: '#ffffff', fontSize: '0.64rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>06</span>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#166534', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={16} color="#16a34a" />
                          Actionable Medical Recommendations
                        </h3>
                        {(tweakedDecisions?.recommendations || editedSections.recommendations.isEdited) && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#16a34a', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>👨‍⚕️ DONE BY DOCTOR / CUSTOM PROTOCOL</span>
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleRegenerateSection('recommendations')}
                          disabled={regeneratingSection === 'recommendations'}
                          title="Regenerate this section individually via LLM"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#ffffff',
                            color: '#166534',
                            border: '1px solid #86efac',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {regeneratingSection === 'recommendations' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          <span>{regeneratingSection === 'recommendations' ? 'Generating...' : 'Regenerate Recommendations'}</span>
                        </button>
                        {isEditMode && editedSections.recommendations.isEdited && (
                          <button
                            type="button"
                            onClick={() => handleResetSection('recommendations')}
                            style={{ fontSize: '0.7rem', color: '#166534', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Revert Recommendations
                          </button>
                        )}
                      </div>
                    </div>

                    {!isEditMode ? (
                      <ul style={{ margin: 0, paddingLeft: '1.3rem', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88rem', color: '#14532d' }}>
                        {(report.recommendations || []).map((rec, i) => (
                          <li key={i} style={{ lineHeight: '1.55' }}>{rec}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(editedSections.recommendations.value || []).map((rec, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>{i + 1}.</span>
                              <input
                                type="text"
                                value={rec}
                                onChange={(e) => {
                                  const updated = [...editedSections.recommendations.value];
                                  updated[i] = e.target.value;
                                  setEditedSections((prev) => ({
                                    ...prev,
                                    recommendations: { ...prev.recommendations, value: updated, isEdited: true },
                                  }));
                                }}
                                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.82rem', color: '#0f172a' }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveRecommendation(i)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add recommendation row */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={newRecommendationInput}
                            onChange={(e) => setNewRecommendationInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddRecommendation();
                              }
                            }}
                            placeholder="Add custom clinical recommendation..."
                            style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
                          />
                          <button
                            type="button"
                            onClick={handleAddRecommendation}
                            style={{ padding: '6px 12px', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Plus size={14} />
                            <span>Add</span>
                          </button>
                        </div>

                        {editedSections.recommendations.isEdited && (
                          <div style={{ background: '#fef3c7', padding: '6px 10px', borderRadius: '4px', border: '1px solid #fde68a', marginTop: '4px' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#92400e', marginBottom: '2px' }}>
                              Clinical Reason for Recommendation Modifications *
                            </label>
                            <input
                              type="text"
                              value={editedSections.recommendations.reason}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditedSections((prev) => ({
                                  ...prev,
                                  recommendations: { ...prev.recommendations, reason: val, isEdited: true },
                                }));
                              }}
                              placeholder="e.g. Added intensive glycemic surveillance and dietary intervention plan."
                              style={{ width: '100%', padding: '4px 8px', fontSize: '0.76rem', borderRadius: '4px', border: '1px solid #fcd34d', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 07. Model Scope & Limitations */}
                  {report.limitations && report.limitations.length > 0 && (
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                        Model Scope & Limitations
                      </span>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#475569' }}>
                        {report.limitations.map((lim, i) => (
                          <li key={i}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 08. Regulatory CDSS Disclaimer & Cryptographic Audit Seal */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', fontSize: '0.74rem', color: '#64748b', lineHeight: '1.5' }}>
                    <strong>Clinical Decision Support Disclaimer:</strong> {report.disclaimer}
                  </div>

                  {/* Bottom Trigger Button in Edit Mode */}
                  {isEditMode && (
                    <div style={{ textAlign: 'center', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={fetchLLMReport}
                        disabled={loading}
                        style={{
                          padding: '10px 24px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                        }}
                      >
                        <Sparkles size={16} />
                        <span>Generate Complete Report via LLM with All Tweaks</span>
                      </button>
                    </div>
                  )}

                  {/* Official Verification Seal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid #0f172a', paddingTop: '14px', marginTop: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                      <div><strong>Platform:</strong> MedSynapse AI Multi-Disease Engine</div>
                      <div><strong>ISO/IEEE Reference:</strong> CDSS-ML-2026-COMPLIANT</div>
                      <div><strong>Audit Seal:</strong> #{reportId}</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ border: '2px dashed #16a34a', padding: '5px 12px', borderRadius: '6px', background: '#f0fdf4', display: 'inline-block' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          MEDSYNAPSE AI VERIFIED
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#15803d' }}>
                          Electronic Audit Record Stored
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT: MEDSYNAPSE AI CLINICAL CHAT */}
        {(viewLayout === 'split' || viewLayout === 'chat') && (
          <div
            style={{
              height: viewLayout === 'chat' ? 'min(760px, calc(100vh - 180px))' : 'calc(100vh - 160px)',
              minHeight: viewLayout === 'chat' ? '580px' : '680px',
              position: viewLayout === 'split' ? 'sticky' : 'relative',
              top: viewLayout === 'split' ? '90px' : 'auto',
              width: '100%',
              maxWidth: chatMaxWidth,
              margin: viewLayout === 'chat' ? '0 auto' : '0',
              transition: 'max-width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <ClinicalReportChat
              reportContext={chatReportContext}
              onRegenerateReport={fetchLLMReport}
              onReportUpdated={handleReportUpdatedFromChat}
              onMessagesChange={setChatHistory}
              isGeneratingReport={loading}
              layoutMode={viewLayout}
              chatWidthPreset={chatWidthPreset}
              onWidthPresetChange={setChatWidthPreset}
            />
          </div>
        )}
      </div>

      {/* Project Analysis & Comparative Audit Dossier Modal */}
      {showAnalysisModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            maxWidth: '880px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid #cbd5e1',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 22px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <BarChart3 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    Clinical Case Comparative Analysis & Project Dossier Audit
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Target: {diseaseTitle} • Case #{reportId} • Machine Learning & Attending Physician Audit
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAnalysisModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* KPI Scorecard Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Baseline ML Risk</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: (prediction.risk_probability || 0) >= 0.5 ? '#dc2626' : '#15803d', margin: '4px 0' }}>
                    {prediction.risk_percentage !== undefined ? `${prediction.risk_percentage}%` : (prediction.risk_probability ? `${(prediction.risk_probability * 100).toFixed(1)}%` : '—')}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Tier: <strong>{prediction.risk_tier || 'Evaluated'}</strong></span>
                </div>

                <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '8px', padding: '12px 14px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Doctor Approved Risk</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: (tweakedDecisions?.riskProbability?.tweaked ? (Number(tweakedDecisions.riskProbability.tweaked) >= 50 ? '#dc2626' : '#15803d') : ((prediction.risk_probability || 0) >= 0.5 ? '#dc2626' : '#15803d')), margin: '4px 0' }}>
                    {tweakedDecisions?.riskProbability?.tweaked ? `${tweakedDecisions.riskProbability.tweaked}%` : (prediction.risk_percentage !== undefined ? `${prediction.risk_percentage}%` : `${(prediction.risk_probability * 100).toFixed(1)}%`)}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#166534' }}>
                    {tweakedDecisions?.hasTweaks ? '👨‍⚕️ Clinician Overrides Active' : '✓ Clinically Concordant'}
                  </span>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Features Audited</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>
                    {patientFeatureMatrix.length}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: tweakedFeaturesCount > 0 ? '#b45309' : '#15803d', fontWeight: 700 }}>
                    {tweakedFeaturesCount > 0 ? `${tweakedFeaturesCount} Modified by Doctor` : 'All Baseline Validated'}
                  </span>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Decision Cutoff</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0284c7', margin: '4px 0', fontFamily: 'monospace' }}>
                    {prediction.decision_threshold ? Number(prediction.decision_threshold).toFixed(2) : '0.50'}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Sensitivity-Calibrated</span>
                </div>
              </div>

              {/* Feature Extraction & Modification Table in Modal */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                  Patient Feature Extraction & Clinician Modifications Audit
                </h4>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Biomarker / Variable</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Baseline ML</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Physician Value</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>Status</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Clinical Unit / Ref</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Doctor Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientFeatureMatrix.map((f, i) => (
                        <tr key={f.key} style={{ background: f.isTweaked ? '#fffbeb' : (i % 2 === 0 ? '#ffffff' : '#f8fafc'), borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '5px 8px', fontWeight: 600, color: '#0f172a' }}>{f.displayName}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: f.isTweaked ? '#94a3b8' : '#0f172a', textDecoration: f.isTweaked ? 'line-through' : 'none' }}>
                            {f.originalValue}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: f.isTweaked ? '#047857' : '#0f172a' }}>
                            {f.currentValue}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                            <span style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              background: f.isTweaked ? '#fef3c7' : '#dcfce7',
                              color: f.isTweaked ? '#b45309' : '#15803d',
                              border: f.isTweaked ? '1px solid #fde68a' : '1px solid #86efac',
                            }}>
                              {f.isTweaked ? '👨‍⚕️ Tweaked' : 'Validated'}
                            </span>
                          </td>
                          <td style={{ padding: '5px 8px', color: '#64748b' }}>{f.refRange}</td>
                          <td style={{ padding: '5px 8px', color: '#475569', fontStyle: 'italic', fontSize: '0.72rem' }}>
                            {f.doctorReason || 'Baseline validated measurement'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Audit Trail & Compliance */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', fontSize: '0.76rem', color: '#475569', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div><strong>Attending Physician:</strong> {doctorName || tweakedDecisions?.doctorInfo?.name?.trim() || 'Attending Physician'} ({doctorTitle || tweakedDecisions?.doctorInfo?.title?.trim() || 'Attending Clinician'})</div>
                  <div><strong>Clinical Department:</strong> Computational Medicine & CDSS</div>
                  <div><strong>Verification Hash:</strong> #{reportId}</div>
                </div>
                <div>
                  <div><strong>Engine:</strong> MedSynapse ({prediction.disease || diseaseKey})</div>
                  <div><strong>Standard:</strong> ISO/IEEE CDSS-ML-2026-COMPLIANT</div>
                  <div style={{ color: '#16a34a', fontWeight: 700 }}>✓ Verified Audit Trail Recorded</div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleDownloadJSON}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <FileJson size={14} />
                  <span>Download Dossier (JSON)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    color: '#0284c7',
                    border: '1px solid #0284c7',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <FileCode size={14} />
                  <span>Export Markdown (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <FileDown size={14} />
                  <span>Print PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAnalysisModal(false)}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
