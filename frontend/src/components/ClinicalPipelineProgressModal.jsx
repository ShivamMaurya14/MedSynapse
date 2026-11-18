import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileDown,
  Sparkles,
} from 'lucide-react';
import ProcessTrackerBar from './ProcessTrackerBar';

export default function ClinicalPipelineProgressModal({
  isOpen,
  moduleName = 'Clinical Module',
  modality = 'tabular', // 'tabular' | 'imaging'
  stage = 'prediction_running',
  error,
  failedAt,
  onClose,
  onDownloadMLReport,
  onGenerateLLMReport,
}) {
  const isImaging = modality === 'imaging';

  const STEPS = useMemo(() => [
    {
      key: 'input',
      number: '01',
      title: isImaging ? 'Medical Scan Standardized' : 'Clinical Features Submitted',
      description: isImaging
        ? 'High-resolution scan validated and transformed to neural tensor.'
        : 'Patient biomarkers and report parameters validated securely.',
    },
    {
      key: 'prediction',
      number: '02',
      title: isImaging ? 'Deep CNN Inference & Attention' : 'Ensemble Prediction & SHAP Analysis',
      description: isImaging
        ? 'Convolutional neural network calculates class probability distribution.'
        : 'Model ensemble calculates risk score and feature contributions.',
    },
    {
      key: 'review',
      number: '03',
      title: 'Clinician Verification & Review',
      description: 'Attending physician audits AI predictions and explanation evidence.',
    },
    {
      key: 'groq',
      number: '04',
      title: 'Clinical Synthesis & Report Generation',
      description: 'Structured LLM synthesis generates the final verified diagnostic report.',
    },
    {
      key: 'complete',
      number: '05',
      title: 'Diagnostic Report Finalized',
      description: 'Immutable record stored in local clinical feature store.',
    },
  ], [isImaging]);

  const STAGE_COPY = useMemo(() => ({
    prediction_running: {
      title: isImaging ? 'Analyzing Scan & Class Activations' : 'Calculating Risk & Explainability',
      message: isImaging
        ? 'Deep learning vision model evaluating tissue densities and class activations.'
        : 'AI ensemble evaluating patient indicators and computing exact SHAP attributions.',
      currentIndex: 1,
    },
    awaiting_review: {
      title: 'Ready for Clinician Review',
      message: 'Diagnostic evaluation, risk score, and explainability evidence ready for medical audit.',
      currentIndex: 2,
    },
    review_saving: {
      title: 'Saving Review Record',
      message: 'Recording clinician verification decision and comments into audit ledger.',
      currentIndex: 2,
    },
    approved: {
      title: 'Clinician Approved — Generating Report',
      message: 'Approved evidence formatted for final diagnostic synthesis.',
      currentIndex: 3,
    },
    rejected: {
      title: 'Review Rejected — Pipeline Halted',
      message: 'Assessment rejected by clinician. Report generation has stopped.',
      currentIndex: 2,
    },
    groq_generating: {
      title: 'Synthesizing Clinical Report (Groq LLM)',
      message: 'Synthesizing comprehensive diagnostic findings from approved evidence.',
      currentIndex: 3,
    },
    complete: {
      title: 'Final Diagnostic Report Ready',
      message: 'Validated, clinician-approved diagnostic report locked and available.',
      currentIndex: 4,
    },
    error: {
      title: 'Stage Encountered an Error',
      message: error || 'An issue occurred during processing. Please review details.',
      currentIndex: 1,
    },
  }), [isImaging, error]);

  const ACTIVE_STAGES = useMemo(() => new Set(['prediction_running', 'review_saving', 'groq_generating']), []);

  if (!isOpen) return null;

  const copy = STAGE_COPY[stage] || STAGE_COPY.prediction_running;
  const isActive = ACTIVE_STAGES.has(stage);
  const isComplete = stage === 'complete' || stage === 'approved';
  const isError = stage === 'error' || stage === 'rejected';

  const progressPercent = isError
    ? 100
    : isComplete
      ? 100
      : Math.max(15, Math.min(95, ((copy.currentIndex + (stage === 'awaiting_review' ? 0.6 : 0.2)) / STEPS.length) * 100));

  function stepStatus(stepIndex) {
    const currentIndex = copy.currentIndex ?? 0;
    if (stage === 'rejected') {
      if (stepIndex < 2) return 'complete';
      if (stepIndex === 2) return 'rejected';
      return 'pending';
    }
    if (stage === 'error') {
      const failedIndex = { input: 0, prediction: 1, review: 2, groq: 3, complete: 4 }[failedAt] ?? 1;
      if (stepIndex < failedIndex) return 'complete';
      if (stepIndex === failedIndex) return 'error';
      return 'pending';
    }
    if (stage === 'complete') return 'complete';
    if (stage === 'approved') {
      if (stepIndex <= 2) return 'complete';
      if (stepIndex === 3) return 'active';
      return 'pending';
    }
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return ACTIVE_STAGES.has(stage) ? 'active' : 'current';
    return 'pending';
  }

  const mappedSteps = STEPS.map((s, index) => ({
    key: s.key,
    number: s.number,
    title: s.title,
    description: s.description,
    status: stepStatus(index),
  }));

  const actions = [];
  if (onDownloadMLReport) {
    actions.push({
      label: 'Download ML Report',
      icon: <FileDown size={14} />,
      onClick: onDownloadMLReport,
      variant: 'secondary',
    });
  }
  if (onGenerateLLMReport && (stage === 'awaiting_review' || stage === 'approved')) {
    actions.push({
      label: 'Generate Report via LLM',
      icon: <Sparkles size={14} color="#5eead4" />,
      onClick: onGenerateLLMReport,
      variant: 'primary',
      style: { background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', color: '#ffffff' }
    });
  }

  const trackerElement = (
    <ProcessTrackerBar
      isOpen={isOpen}
      moduleLabel={moduleName}
      currentProcessName={copy.title}
      currentProcessDesc={copy.message}
      progressPercent={progressPercent}
      isActive={isActive}
      isComplete={isComplete || stage === 'awaiting_review'}
      isError={isError}
      errorMessage={error}
      steps={mappedSteps}
      actions={actions}
      onClose={onClose}
    />
  );

  return createPortal(trackerElement, document.body);
}
