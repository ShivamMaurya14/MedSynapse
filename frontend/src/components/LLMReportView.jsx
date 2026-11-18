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
} from 'lucide-react';
import { generateDirectLlmReport } from '../services/api';
import ClinicalReportChat from './ClinicalReportChat';

export default function LLMReportView({ reportData, setTab, onNavigateToForm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [copied, setCopied] = useState(false);
  const [viewLayout, setViewLayout] = useState('split'); // 'split' | 'report' | 'chat'
  const [isEditMode, setIsEditMode] = useState(false);
  
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

  // Active Tweaked Decisions State
  const [tweakedDecisions] = useState(initialTweakedDecisions || {
    hasTweaks: false,
    diagnosis: null,
    riskTier: null,
    riskProbability: null,
    decisionThreshold: null,
    recommendations: null,
    featureRationales: {},
  });

  // Independent Section Edits State
  const [editedSections, setEditedSections] = useState({
    title: { value: '', reason: '', isEdited: false },
    screening_summary: { value: '', reason: '', isEdited: false },
    model_findings: { value: '', reason: '', isEdited: false },
    explainability_summary: { value: '', reason: '', isEdited: false },
    clinician_review: { value: '', reason: '', isEdited: false },
    recommendations: { value: [], reason: '', isEdited: false },
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
        hasTweaks: Boolean(tweakedDecisions?.hasTweaks || hasInputTweaks),
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
      });

      setReport(res.data);

      // Populate edit fields if empty
      if (res.data) {
        setEditedSections((prev) => ({
          title: prev.title.isEdited ? prev.title : { value: res.data.title || '', reason: '', isEdited: false },
          screening_summary: prev.screening_summary.isEdited ? prev.screening_summary : { value: res.data.screening_summary || '', reason: '', isEdited: false },
          model_findings: prev.model_findings.isEdited ? prev.model_findings : { value: res.data.model_findings || '', reason: '', isEdited: false },
          explainability_summary: prev.explainability_summary.isEdited ? prev.explainability_summary : { value: res.data.explainability_summary || '', reason: '', isEdited: false },
          clinician_review: prev.clinician_review.isEdited ? prev.clinician_review : { value: res.data.clinician_review || '', reason: '', isEdited: false },
          recommendations: prev.recommendations.isEdited ? prev.recommendations : { value: [...(res.data.recommendations || [])], reason: '', isEdited: false },
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to generate LLM report');
    } finally {
      setLoading(false);
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
    const originalTitle = document.title;
    document.title = `MedSynapse_LLM_Report_${diseaseTitle.replace(/\s+/g, '_')}_${reportId}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
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
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={15} />
            <span>Back to {diseaseTitle} Form</span>
          </button>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                background: !isEditMode ? '#ffffff' : 'transparent',
                color: !isEditMode ? '#0f172a' : '#64748b',
                boxShadow: !isEditMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              <Eye size={14} color={!isEditMode ? '#0284c7' : '#64748b'} />
              <span>Preview Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                background: isEditMode ? '#ffffff' : 'transparent',
                color: isEditMode ? '#92400e' : '#64748b',
                boxShadow: isEditMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
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
          <div style={{ display: 'flex', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px' }}>
            <button
              type="button"
              onClick={() => setViewLayout('split')}
              title="Split View: Report & AI Chat"
              style={{
                background: viewLayout === 'split' ? '#0f172a' : 'transparent',
                color: viewLayout === 'split' ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.74rem',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Columns size={13} />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('report')}
              title="Full Report View"
              style={{
                background: viewLayout === 'report' ? '#0f172a' : 'transparent',
                color: viewLayout === 'report' ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.74rem',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <FileText size={13} />
              <span>Report</span>
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('chat')}
              title="Full AI Chat View"
              style={{
                background: viewLayout === 'chat' ? '#0f172a' : 'transparent',
                color: viewLayout === 'chat' ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.74rem',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <MessageSquare size={13} />
              <span>Chat</span>
            </button>
          </div>

          <button
            onClick={fetchLLMReport}
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Generate Report via LLM</span>
          </button>

          <button
            onClick={handleCopy}
            disabled={!report || loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', fontSize: '0.82rem' }}
          >
            {copied ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
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
              padding: '7px 16px',
              fontSize: '0.82rem',
              background: '#0f172a',
              color: '#ffffff'
            }}
          >
            <FileDown size={14} />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            viewLayout === 'split'
              ? 'minmax(0, 1.45fr) minmax(360px, 1fr)'
              : viewLayout === 'report'
              ? '1fr'
              : '1fr',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* LEFT: PRESENT ML REPORT & EDITABLE CLINICAL SYNTHESIS */}
        {(viewLayout === 'split' || viewLayout === 'report') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                {/* Contributing Biomarkers */}
                {prediction.contributing_factors && prediction.contributing_factors.length > 0 && (
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                      Primary Contributing Biomarkers (SHAP):
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto' }}>
                      {prediction.contributing_factors.map((f, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 8px', background: '#ffffff', borderRadius: '4px', fontSize: '0.74rem', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{f.factor}: {f.value}</span>
                          <span style={{ color: f.impact?.toLowerCase().includes('high') ? '#dc2626' : '#2563eb', fontWeight: 600, fontSize: '0.68rem' }}>
                            {f.impact}
                          </span>
                        </div>
                      ))}
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

            {/* Official Report Card Sheet */}
            <div
              className="clinical-report-sheet"
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                padding: '28px 34px',
                boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
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
                  {/* Title Section */}
                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid #0284c7' }}>
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
                  </div>

                  {/* 1. Executive Screening Summary */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.6px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={15} color="#0284c7" />
                        1. Executive Screening Summary
                      </h3>
                      {isEditMode && editedSections.screening_summary.isEdited && (
                        <button
                          type="button"
                          onClick={() => handleResetSection('screening_summary')}
                          style={{ fontSize: '0.7rem', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Revert to Baseline
                        </button>
                      )}
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
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.6px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={15} color="#059669" />
                        2. Biostatistical Model Findings
                      </h3>
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

                  {/* 3. Explainability & Biomarker Attribution */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.6px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={15} color="#7c3aed" />
                        3. Explainability & Biomarker Drivers
                      </h3>
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
                  </div>

                  {/* 4. Clinical Protocol & Attending Review */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.6px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <UserCheck size={15} color="#d97706" />
                        4. Clinical Protocol & Attending Review
                      </h3>
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

                  {/* 5. Actionable Recommendations */}
                  <div style={{ background: '#f0fdf4', padding: '16px 20px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#166534', letterSpacing: '0.6px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={16} color="#16a34a" />
                        5. Actionable Medical Recommendations
                      </h3>
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

                  {/* 6. Limitations */}
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

                  {/* 7. Regulatory Disclaimer */}
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
                      <div><strong>Platform:</strong> MedSynapse AI v2.0 Multi-Disease Engine</div>
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
          <div style={{ height: 'calc(100vh - 160px)', minHeight: '680px', position: 'sticky', top: '90px' }}>
            <ClinicalReportChat
              reportContext={chatReportContext}
              onRegenerateReport={fetchLLMReport}
              isGeneratingReport={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
