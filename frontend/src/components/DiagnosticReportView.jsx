import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  FileCheck, 
  Sparkles, 
  FileText, 
  Printer,
  ChevronRight,
  Activity,
} from 'lucide-react';
import DiagnosticResultCard from './DiagnosticResultCard';
import ClinicalPipelineProgressModal from './ClinicalPipelineProgressModal';
import { printReportDocument } from '../utils/printReport';

export default function DiagnosticReportView({ reportData, setTab, onNavigateToLLMReport, onNavigateToForm, onReportUpdated }) {
  if (!reportData || !reportData.result) {
    return (
      <div className="animate-fade-in" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{
          maxWidth: '560px',
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
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}>
            <FileText size={28} color="#64748b" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            No Diagnostic Report Generated Yet
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
            Please select a diagnostic module, enter the patient biomarkers or scan image, and click "Calculate Risk" to produce an official verified screening record on this route.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTab('diabetes')}
              className="btn-primary"
              style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>Go to Diabetes Analyzer (M1)</span>
              <ChevronRight size={16} />
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

  const [currentReportData, setCurrentReportData] = useState(reportData);
  const [currentTweaks, setCurrentTweaks] = useState(reportData?.tweakedDecisions || null);

  useEffect(() => {
    setCurrentReportData(reportData);
    if (reportData?.tweakedDecisions) {
      setCurrentTweaks(reportData.tweakedDecisions);
    }
  }, [reportData]);

  const sourceTab = currentReportData?.sourceTab || 'diabetes';
  const diseaseTitle = currentReportData?.title || 'Diagnostic Risk Assessment';
  const [trackerOpen, setTrackerOpen] = useState(true);
  const [isParametersModified, setIsParametersModified] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(() => {
    const status = currentReportData?.result?.workflow_status;
    if (status === 'clinician_approved') return 'approved';
    if (status === 'final_report_generated') return 'complete';
    return 'awaiting_review';
  });

  const handleReportUpdated = (newResult, newInputs) => {
    setCurrentReportData(prev => ({
      ...prev,
      result: newResult,
      inputs: newInputs,
    }));
    setPipelineStage('awaiting_review');
    onReportUpdated?.(newResult, newInputs);
    window.dispatchEvent(new CustomEvent('medsynapse-sync-app-report', {
      detail: { result: newResult, inputs: newInputs, diseaseKey: currentReportData?.diseaseKey || sourceTab }
    }));
  };

  useEffect(() => {
    const handleModified = (e) => {
      setIsParametersModified(Boolean(e.detail?.isModified));
    };
    const handleReportSync = (e) => {
      if (e.detail?.result) {
        setCurrentReportData(prev => ({
          ...prev,
          result: e.detail.result,
          inputs: e.detail.inputs || prev.inputs,
        }));
        setPipelineStage('awaiting_review');
      }
    };
    const handleTweaksSync = (e) => {
      if (e.detail) {
        setCurrentTweaks(e.detail);
      }
    };
    window.addEventListener('medsynapse-parameters-modified', handleModified);
    window.addEventListener('medsynapse-report-updated', handleReportSync);
    window.addEventListener('medsynapse-tweaks-updated', handleTweaksSync);
    return () => {
      window.removeEventListener('medsynapse-parameters-modified', handleModified);
      window.removeEventListener('medsynapse-report-updated', handleReportSync);
      window.removeEventListener('medsynapse-tweaks-updated', handleTweaksSync);
    };
  }, []);

  const handleStageChange = (stage) => {
    setPipelineStage(stage);
    currentReportData?.onWorkflowStageChange?.(stage);
  };

  const handleTriggerNavigateToLLMReport = () => {
    if (!onNavigateToLLMReport) return;
    const basePred = currentReportData?.result?.data || currentReportData?.result || {};
    const effPred = currentTweaks?.effectiveValues ? {
      ...basePred,
      diagnosis: currentTweaks.effectiveValues.diagnosis,
      prediction: currentTweaks.effectiveValues.diagnosis,
      risk_tier: currentTweaks.effectiveValues.riskTier,
      risk_percentage: currentTweaks.effectiveValues.riskPercentage,
      risk_probability: currentTweaks.effectiveValues.riskProbability,
      recommendations: currentTweaks.effectiveValues.recommendations,
    } : basePred;

    const docName = (
      currentTweaks?.doctorInfo?.name?.trim() ||
      currentReportData?.result?.clinician_review?.reviewed_by?.trim() ||
      currentReportData?.result?.clinical_report?.clinician_review?.reviewed_by?.trim() ||
      currentReportData?.reviewedBy?.trim() ||
      localStorage.getItem('medsynapse_doctor_name') ||
      ''
    ).trim();

    const docTitle = (
      currentTweaks?.doctorInfo?.title?.trim() ||
      localStorage.getItem('medsynapse_doctor_title') ||
      'Attending Physician'
    ).trim();

    const enrichedTweaks = {
      ...(currentTweaks || {}),
      doctorInfo: {
        name: docName,
        title: docTitle,
        timestamp: currentTweaks?.doctorInfo?.timestamp || new Date().toLocaleString(),
      }
    };

    onNavigateToLLMReport({
      diseaseKey: currentReportData?.diseaseKey || sourceTab || 'diabetes',
      prediction: { ...effPred, reviewed_by: docName },
      inputs: currentReportData?.inputs || currentReportData?.result?.inputs || {},
      clinicalReport: currentReportData?.result?.clinical_report || null,
      modelRunId: currentReportData?.result?.model_run_id || null,
      tweakedDecisions: enrichedTweaks,
      reviewedBy: docName,
      doctorInfo: enrichedTweaks.doctorInfo,
      image: currentReportData?.image || currentReportData?.preview || currentReportData?.inputs?.image_preview || currentReportData?.inputs?.preview || currentReportData?.inputs?.image_url || currentReportData?.inputs?.previewUrl,
    });
  };

  const isImaging = ['xray', 'brain-tumor', 'kidney-stone', 'skin-cancer', 'eye'].includes(currentReportData?.diseaseKey || sourceTab);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ClinicalPipelineProgressModal
        isOpen={trackerOpen}
        moduleName={`${(currentReportData?.diseaseKey || sourceTab || 'clinical').toUpperCase()} PIPELINE`}
        modality={isImaging ? 'imaging' : 'tabular'}
        stage={pipelineStage}
        onClose={null}
        onDownloadMLReport={() => {
          if (!isParametersModified) {
            printReportDocument('.clinical-report-sheet', `MedSynapse_${diseaseTitle.replace(/\s+/g, '_')}_Report`);
          }
        }}
        onGenerateLLMReport={onNavigateToLLMReport ? handleTriggerNavigateToLLMReport : undefined}
      />
      {/* Top Breadcrumb & Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '0.85rem 1.25rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (onNavigateToForm) {
                onNavigateToForm(sourceTab, currentReportData?.inputs);
              } else {
                setTab(sourceTab);
              }
            }}
            className="btn-secondary"
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to {currentReportData?.diseaseKey ? currentReportData.diseaseKey.toUpperCase() : 'Input'} Form</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <FileCheck size={16} color="#059669" />
              <span>{diseaseTitle} — Official Report Route</span>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Active Doctor Override Indicator */}
          {currentTweaks?.hasTweaks && (
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '5px 10px',
              borderRadius: '6px',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1.5px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.15)'
            }}>
              <span>👨‍⚕️</span>
              <span>Done by Doctor ({currentTweaks.doctorInfo?.name?.trim() || 'Reviewing Clinician'}): Overrides Active</span>
            </span>
          )}

          {/* Active Highlighted Run ML Analysis Button */}
          {isParametersModified && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('medsynapse-trigger-ml-analysis'))}
              className="btn-primary btn-run-ml-pulse"
              style={{
                padding: '6px 14px',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: '1.5px solid #38bdf8',
                boxShadow: '0 0 14px rgba(56, 189, 248, 0.5)'
              }}
              title="Parameters have changed. Re-run ML Analysis to compute fresh results."
            >
              <Activity size={14} color="#ffffff" className="animate-spin" />
              <span>⚡ Run ML Analysis</span>
            </button>
          )}

          {onNavigateToLLMReport && (
            <button
              onClick={handleTriggerNavigateToLLMReport}
              className="btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: currentTweaks?.hasTweaks ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                color: '#ffffff',
                border: currentTweaks?.hasTweaks ? '1px solid #10b981' : '1px solid #0f766e',
                boxShadow: currentTweaks?.hasTweaks ? '0 0 10px rgba(16, 185, 129, 0.35)' : '0 2px 6px rgba(13, 148, 136, 0.25)',
              }}
            >
              <Sparkles size={14} color={currentTweaks?.hasTweaks ? '#a7f3d0' : '#5eead4'} />
              <span>{currentTweaks?.hasTweaks ? 'Generate Tweaked LLM Report' : 'Generate Report via LLM'}</span>
            </button>
          )}

          <button
            onClick={isParametersModified ? undefined : () => printReportDocument('.clinical-report-sheet', `MedSynapse_${diseaseTitle.replace(/\s+/g, '_')}_Report`)}
            disabled={isParametersModified}
            className={`btn-secondary ${isParametersModified ? 'is-disabled-stale' : ''}`}
            style={{
              padding: '6px 12px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isParametersModified ? 0.55 : 1,
              cursor: isParametersModified ? 'not-allowed' : 'pointer'
            }}
            title={isParametersModified ? "Parameters modified. Re-run ML Analysis to enable printing." : "Print Report"}
          >
            <Printer size={14} />
            <span>{isParametersModified ? 'Print Locked' : 'Print Report'}</span>
          </button>
        </div>
      </div>

      {/* Main Diagnostic Result Card */}
      <DiagnosticResultCard
        result={currentReportData?.result}
        title={diseaseTitle}
        diseaseKey={currentReportData?.diseaseKey || sourceTab}
        inputs={currentReportData?.inputs}
        image={currentReportData?.image || currentReportData?.preview || currentReportData?.inputs?.image_preview || currentReportData?.inputs?.preview || currentReportData?.inputs?.image_url || currentReportData?.inputs?.previewUrl}
        onWorkflowStageChange={handleStageChange}
        onReset={() => {
          if (onNavigateToForm) {
            onNavigateToForm(sourceTab, currentReportData?.inputs);
          } else {
            setTab(sourceTab);
          }
        }}
        onNavigateToLLMReport={onNavigateToLLMReport}
        onNavigateToForm={onNavigateToForm}
        onReportUpdated={handleReportUpdated}
        onTweaksChange={setCurrentTweaks}
      />
    </div>
  );
}
