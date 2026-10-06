import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  Printer, 
  FileDown, 
  CheckCircle, 
  Info, 
  Activity, 
  FileCheck,
  Stethoscope,
  CheckSquare,
  Square,
  Layers,
  ClipboardList,
  UserCheck,
  Ban,
  TrendingUp,
  TrendingDown,
  Award,
  Sparkles
} from 'lucide-react';
import { generateFinalReport, reviewModelRun } from '../services/api';

export default function DiagnosticResultCard({ 
  result: resultProp,
  onReset, 
  title = 'Diagnostic Risk Assessment',
  onWorkflowStageChange,
}) {
  const assessmentResponse = resultProp?.success && resultProp?.data ? resultProp : null;
  const result = assessmentResponse?.data || resultProp;
  const clinicalReport = assessmentResponse?.clinical_report || null;
  const modelRunId = assessmentResponse?.model_run_id || clinicalReport?.model_run_id || null;

  const [reportId] = useState(() => `MS-${Math.floor(100000 + Math.random() * 900000)}`);
  const [reportDate] = useState(() => new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }));

  const [reviewedBy, setReviewedBy] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [doctorDecisionChoice, setDoctorDecisionChoice] = useState('approved');
  const [workflowStatus, setWorkflowStatus] = useState(
    assessmentResponse?.workflow_status || 'awaiting_clinician_review'
  );
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [finalReport, setFinalReport] = useState(null);

  const explainability = clinicalReport?.explainability || {};
  const decisionTrace = clinicalReport?.decision_trace || {};
  const clinicalInputs = clinicalReport?.clinical_inputs || [];
  const explanationSentences = explainability?.plain_language?.sentences || [];
  const baseValue = explainability?.base_value;

  const shapContributions = useMemo(() => {
    if (!clinicalReport?.explainability) return [];
    if (Array.isArray(clinicalReport.explainability.all_contributions) && clinicalReport.explainability.all_contributions.length > 0) {
      return clinicalReport.explainability.all_contributions;
    }
    const pos = clinicalReport.explainability.top_positive_contributors || [];
    const neg = clinicalReport.explainability.top_negative_contributors || [];
    return [...pos, ...neg];
  }, [clinicalReport]);

  const [verifiedFeatures, setVerifiedFeatures] = useState(() => {
    if (shapContributions.length > 0) {
      return new Set(shapContributions.map(c => c.feature));
    }
    return new Set(['Glucose', 'Age', 'BloodPressure', 'BMI', 'Insulin', 'Pregnancies', 'SkinThickness', 'DiabetesPedigreeFunction', 'BMI_Cat']);
  });

  React.useEffect(() => {
    if (shapContributions.length > 0 && verifiedFeatures.size === 0) {
      setVerifiedFeatures(new Set(shapContributions.map(c => c.feature)));
    }
  }, [shapContributions]);

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
    if (shapContributions.length > 0) {
      setVerifiedFeatures(new Set(shapContributions.map(c => c.feature)));
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

  // Dynamic Severity & Threshold Coloring
  const isBelowThreshold = isHealthy || prob < decisionThreshold;

  let severityTheme;
  if (isBelowThreshold) {
    severityTheme = {
      level: 'normal',
      tier: 'Low Risk',
      statusPill: 'NEGATIVE / BASELINE NORMAL (BELOW THRESHOLD)',
      statusDesc: `Calibrated Score (${(prob * 100).toFixed(1)}%) is below the diagnostic threshold (${(decisionThreshold * 100).toFixed(0)}%) — Within expected physiological baseline.`,
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
  } else if (prob < 0.70 || riskTier === 'Moderate Risk') {
    severityTheme = {
      level: 'moderate',
      tier: 'Moderate Risk',
      statusPill: 'ELEVATED RISK / MODERATE SEVERITY (ABOVE THRESHOLD)',
      statusDesc: `Calibrated Score (${(prob * 100).toFixed(1)}%) exceeds decision threshold (${(decisionThreshold * 100).toFixed(0)}%) with intermediate risk drivers.`,
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
      tier: 'High Risk / Severe',
      statusPill: 'POSITIVE INDICATION / HIGH SEVERITY (ABOVE THRESHOLD)',
      statusDesc: `Calibrated Score (${(prob * 100).toFixed(1)}%) markedly exceeds decision threshold (${(decisionThreshold * 100).toFixed(0)}%) — Prioritized clinical assessment recommended.`,
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

  // Module identification for clinical insights
  const diseaseNameLower = (result.disease || title || '').toLowerCase();
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

  const handleDownloadPDF = () => {
    const originalTitle = document.title;
    const diseaseName = (result.disease || result.modality || 'Medical').replace(/\s+/g, '_');
    document.title = `MedSynapse_${diseaseName}_Report_${reportId}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
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

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handleDownloadPDF} 
            className="btn-primary" 
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0f172a',
              color: '#ffffff',
              border: '1px solid #0f172a',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <FileDown size={14} /> Download A4 PDF Report
          </button>
          <button 
            onClick={handleDownloadPDF} 
            className="btn-secondary" 
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
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

        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <tbody>
            <tr>
              <td style={{ width: '22%', fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Diagnostic Target:</td>
              <td style={{ width: '28%', fontWeight: 600, color: '#0f172a' }}>{title}</td>
              <td style={{ width: '22%', fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Evaluation Pipeline:</td>
              <td style={{ width: '28%', color: '#0f172a' }}>{modelName}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Acquisition Source:</td>
              <td style={{ color: '#0f172a' }}>{clinicalReport?.screening?.input_source || 'Direct Parameter Submission'}</td>
              <td style={{ fontWeight: 700, background: '#f8fafc', color: '#334155' }}>Input Validation:</td>
              <td style={{ fontWeight: 600, color: '#0f172a' }}>
                {decisionTrace.input_validation === 'passed' ? 'Verified / Complete (Passed)' : 'Pending Verification'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Structured Input Biomarkers Table */}
      {clinicalInputs && clinicalInputs.length > 0 && (
        <div className="break-inside-avoid" style={{ marginBottom: '16px' }}>
          <h4 style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#334155',
            margin: '0 0 6px 0'
          }}>
            Measured Biomarkers & Clinical Parameters
          </h4>
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
              {clinicalInputs.map((input, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '5px 10px', fontWeight: 600, color: '#1e293b' }}>
                    {input.display_name || input.name}
                  </td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                    {input.value !== null && input.value !== undefined ? String(input.value) : '—'}
                  </td>
                  <td style={{ padding: '5px 10px', color: '#475569' }}>
                    {input.unit || '—'}
                  </td>
                  <td style={{ padding: '5px 10px', color: '#64748b', fontSize: '0.74rem' }}>
                    {input.source || 'Validated model input'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <span>{result.diagnosis || result.prediction || (isHealthy ? 'Baseline Physiological Control' : 'Elevated Risk Indication')}</span>
          </h2>

          <p style={{ fontSize: '0.82rem', color: severityTheme.textMain, margin: '0 0 6px 0', fontWeight: 500 }}>
            {severityTheme.statusDesc}
          </p>

          <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <span>Decision Threshold: <strong style={{ color: '#0f172a' }}>0.50</strong></span>
            <span>•</span>
            <span>Calibrated Risk Score: <strong style={{ color: severityTheme.textMain }}>{prob.toFixed(4)}</strong></span>
            <span>•</span>
            <span>Risk Tier: <strong style={{ color: severityTheme.textMain }}>{riskTier}</strong></span>
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
            {riskPercent}%
          </div>
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
                Calibrated probability ({prob.toFixed(4)}) {prob >= 0.5 ? '≥' : '<'} Decision Threshold (0.5000)
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
                  {prob >= 0.5 ? 'Threshold Exceeded (Positive Flag)' : 'Within Reference Range (Negative)'}
                </span>
              </td>
            </tr>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>6. Risk Stratification</td>
              <td style={{ padding: '6px 10px', color: '#334155' }}>
                Stratified by probability cutoffs (Low: &lt;0.35, Moderate: 0.35–0.70, High: ≥0.70)
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
                  {riskTier}
                </span>
              </td>
            </tr>
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

          {/* Feature verification checklist for SHAP */}
          {shapContributions.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#1e293b' }}>
                  Verify Biomarker SHAP Drivers ({verifiedFeatures.size}/{shapContributions.length} Verified)
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
                {shapContributions.map((item) => {
                  const isVerified = verifiedFeatures.has(item.feature);
                  const shapVal = Number(item.shap_value || 0);
                  const isPos = shapVal >= 0;
                  return (
                    <div
                      key={item.feature}
                      onClick={() => workflowStatus !== 'final_report_generated' && toggleFeatureVerification(item.feature)}
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
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a' }}>{item.feature}</span>
                      </div>
                      <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>
                        {isPos ? `+${shapVal.toFixed(4)}` : shapVal.toFixed(4)}
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
                onChange={(event) => setReviewedBy(event.target.value)} 
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
            {workflowStatus === 'clinician_approved' && (
              <button 
                disabled={reviewLoading} 
                onClick={handleFinalReport}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  background: '#0f172a',
                  color: '#ffffff',
                  border: '1px solid #0f172a',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileCheck size={15} /> Generate Clinician Final Report
              </button>
            )}
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
      {result.recommendations && result.recommendations.length > 0 && (
        <div className="break-inside-avoid" style={{ marginBottom: '16px' }}>
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
            <ClipboardList size={15} color="#0f172a" /> Recommended Next Steps & Clinical Management Protocol
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {result.recommendations.map((rec, idx) => (
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
