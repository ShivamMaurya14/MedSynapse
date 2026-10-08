import React, { useEffect, useMemo } from 'react';
import {
  Check,
  Circle,
  FileCheck,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';

const STEPS = [
  {
    key: 'input',
    title: 'Clinical features submitted',
    description: 'The validated nine-feature diabetes input has been sent securely.',
  },
  {
    key: 'prediction',
    title: 'Prediction and SHAP explanation',
    description: 'The diabetes ensemble and explainability adapter run in one backend request.',
  },
  {
    key: 'review',
    title: 'Clinician review',
    description: 'The doctor reviews the prediction, SHAP evidence, and generated explanation.',
  },
  {
    key: 'groq',
    title: 'Groq final-report generation',
    description: 'Only approved evidence is sent to the configured Groq model.',
  },
  {
    key: 'complete',
    title: 'Final report persisted',
    description: 'The validated report is locked and ready for display or export.',
  },
];

const STAGE_COPY = {
  prediction_running: {
    eyebrow: 'Diabetes analysis in progress',
    title: 'Running prediction and explainability',
    message: 'The backend is calculating diabetes risk and all nine SHAP contributions.',
    currentIndex: 1,
  },
  awaiting_review: {
    eyebrow: 'Model analysis complete',
    title: 'Waiting for clinician review',
    message: 'The prediction and explanation are ready. Continue to inspect and approve or reject the result.',
    currentIndex: 2,
  },
  review_saving: {
    eyebrow: 'Recording clinician decision',
    title: 'Saving the review decision',
    message: 'The clinician identity, decision, and comment are being added to the audit record.',
    currentIndex: 2,
  },
  approved: {
    eyebrow: 'Clinician approval recorded',
    title: 'Ready for final report generation',
    message: 'The approved prediction and exact SHAP evidence can now be sent to Groq.',
    currentIndex: 3,
  },
  rejected: {
    eyebrow: 'Clinician rejection recorded',
    title: 'Final report generation stopped',
    message: 'The decision was rejected, so no evidence will be sent to Groq.',
    currentIndex: 2,
  },
  groq_generating: {
    eyebrow: 'Approved evidence only',
    title: 'Groq is generating the final report',
    message: 'The response will be schema-validated and persisted before it is shown.',
    currentIndex: 3,
  },
  complete: {
    eyebrow: 'Pipeline completed',
    title: 'Final report is ready',
    message: 'The clinician-approved Groq report has been validated, saved, and locked.',
    currentIndex: 4,
  },
  error: {
    eyebrow: 'Pipeline interrupted',
    title: 'The current stage could not finish',
    message: 'Review the error below and retry when the underlying issue is resolved.',
    currentIndex: 1,
  },
};

const ACTIVE_STAGES = new Set(['prediction_running', 'review_saving', 'groq_generating']);

function stepStatus(stepIndex, stage, failedAt) {
  const currentIndex = STAGE_COPY[stage]?.currentIndex ?? 0;
  if (stage === 'rejected') {
    if (stepIndex < 2) return 'complete';
    if (stepIndex === 2) return 'rejected';
    return 'blocked';
  }
  if (stage === 'error') {
    const failedIndex = { input: 0, prediction: 1, review: 2, groq: 3, complete: 4 }[failedAt] ?? 1;
    if (stepIndex < failedIndex) return 'complete';
    if (stepIndex === failedIndex) return 'error';
    return 'pending';
  }
  if (stage === 'complete') return 'complete';
  if (stage === 'approved' && stepIndex === 3) return 'pending';
  if (stepIndex < currentIndex) return 'complete';
  if (stepIndex === currentIndex) return ACTIVE_STAGES.has(stage) ? 'active' : 'current';
  return 'pending';
}

function StepIcon({ status }) {
  if (status === 'complete') return <Check size={16} />;
  if (status === 'active') return <LoaderCircle size={16} className="animate-spin" />;
  if (status === 'error' || status === 'rejected') return <XCircle size={16} />;
  return <Circle size={13} />;
}

export default function DiabetesPipelineProgressModal({
  isOpen,
  stage,
  error,
  failedAt,
  onClose,
}) {
  const copy = STAGE_COPY[stage] || STAGE_COPY.prediction_running;
  const progress = useMemo(() => {
    if (stage === 'rejected' || stage === 'error') return null;
    return Math.max(10, ((copy.currentIndex + (stage === 'complete' ? 1 : 0)) / STEPS.length) * 100);
  }, [copy.currentIndex, stage]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !ACTIVE_STAGES.has(stage)) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, stage]);

  if (!isOpen) return null;

  const isActive = ACTIVE_STAGES.has(stage);
  const isComplete = stage === 'complete';
  const isRejected = stage === 'rejected';

  return (
    <div className="pipeline-modal-backdrop" role="presentation">
      <section
        className="pipeline-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diabetes-pipeline-title"
        aria-describedby="diabetes-pipeline-message"
      >
        {!isActive && (
          <button className="pipeline-modal-close" type="button" onClick={onClose} aria-label="Close pipeline status">
            <X size={19} />
          </button>
        )}

        <header className="pipeline-modal-header">
          <div className={`pipeline-modal-symbol ${stage === 'error' || isRejected ? 'is-error' : isComplete ? 'is-complete' : ''}`}>
            {stage === 'error' || isRejected
              ? <XCircle size={25} />
              : isComplete
                ? <FileCheck size={25} />
                : stage === 'groq_generating'
                  ? <Sparkles size={25} />
                  : <ShieldCheck size={25} />}
          </div>
          <div>
            <p className="pipeline-modal-eyebrow">{copy.eyebrow}</p>
            <h2 id="diabetes-pipeline-title">{copy.title}</h2>
            <p id="diabetes-pipeline-message">{copy.message}</p>
          </div>
        </header>

        {progress !== null && (
          <div className="pipeline-progress-track" aria-label={`Pipeline progress ${Math.round(progress)} percent`}>
            <span style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="pipeline-step-list" aria-live="polite">
          {STEPS.map((step, index) => {
            const status = stepStatus(index, stage, failedAt);
            return (
              <div className={`pipeline-step is-${status}`} key={step.key}>
                <div className="pipeline-step-icon"><StepIcon status={status} /></div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="pipeline-modal-error">{error}</div>}

        <footer className="pipeline-modal-footer">
          <span>
            {isActive ? 'Please keep this window open while the current request finishes.' : 'The audit record is updated at every completed backend stage.'}
          </span>
          {!isActive && (
            <button className="btn-primary" type="button" onClick={onClose}>
              {stage === 'awaiting_review'
                ? 'Review model result'
                : stage === 'approved'
                  ? 'Continue to final report'
                  : isComplete
                    ? 'View final report'
                    : 'Close'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
