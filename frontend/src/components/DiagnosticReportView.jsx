import React, { useState } from 'react';
import { 
  ArrowLeft, 
  FileCheck, 
  Sparkles, 
  FileText, 
  Printer,
  ChevronRight 
} from 'lucide-react';
import DiagnosticResultCard from './DiagnosticResultCard';
import ClinicalPipelineProgressModal from './ClinicalPipelineProgressModal';

export default function DiagnosticReportView({ reportData, setTab, onNavigateToLLMReport, onNavigateToForm }) {
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

  const sourceTab = reportData.sourceTab || 'diabetes';
  const diseaseTitle = reportData.title || 'Diagnostic Risk Assessment';
  const [trackerOpen, setTrackerOpen] = useState(true);
  const [pipelineStage, setPipelineStage] = useState(() => {
    const status = reportData.result?.workflow_status;
    if (status === 'clinician_approved') return 'approved';
    if (status === 'final_report_generated') return 'complete';
    return 'awaiting_review';
  });

  const handleStageChange = (stage) => {
    setPipelineStage(stage);
    reportData.onWorkflowStageChange?.(stage);
  };

  const isImaging = ['xray', 'brain-tumor', 'kidney-stone', 'skin-cancer', 'eye'].includes(reportData.diseaseKey || sourceTab);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ClinicalPipelineProgressModal
        isOpen={trackerOpen}
        moduleName={`${(reportData.diseaseKey || sourceTab || 'clinical').toUpperCase()} PIPELINE`}
        modality={isImaging ? 'imaging' : 'tabular'}
        stage={pipelineStage}
        onClose={() => setTrackerOpen(false)}
        onDownloadMLReport={() => window.print()}
        onGenerateLLMReport={onNavigateToLLMReport ? () => onNavigateToLLMReport({
          diseaseKey: reportData.diseaseKey || sourceTab || 'diabetes',
          prediction: reportData.result?.data || reportData.result,
          inputs: reportData.inputs || {},
          clinicalReport: reportData.result?.clinical_report || null,
          modelRunId: reportData.result?.model_run_id || null,
        }) : undefined}
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
                onNavigateToForm(sourceTab, reportData.inputs);
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
            <span>Back to {reportData.diseaseKey ? reportData.diseaseKey.toUpperCase() : 'Input'} Form</span>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onNavigateToLLMReport && (
            <button
              onClick={() => onNavigateToLLMReport({
                diseaseKey: reportData.diseaseKey || 'diabetes',
                prediction: reportData.result?.data || reportData.result,
                inputs: reportData.inputs || {},
                clinicalReport: reportData.result?.clinical_report || null,
                modelRunId: reportData.result?.model_run_id || null,
              })}
              className="btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#38bdf8',
                border: '1px solid #334155'
              }}
            >
              <Sparkles size={14} color="#38bdf8" />
              <span>Generate Report via LLM</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Main Diagnostic Result Card */}
      <DiagnosticResultCard
        result={reportData.result}
        title={diseaseTitle}
        diseaseKey={reportData.diseaseKey || sourceTab}
        inputs={reportData.inputs}
        onWorkflowStageChange={reportData.onWorkflowStageChange}
        onReset={() => {
          if (onNavigateToForm) {
            onNavigateToForm(sourceTab, reportData.inputs);
          } else {
            setTab(sourceTab);
          }
        }}
        onNavigateToLLMReport={onNavigateToLLMReport}
        onNavigateToForm={onNavigateToForm}
      />
    </div>
  );
}
