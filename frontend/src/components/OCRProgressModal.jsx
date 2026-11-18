import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  ScanText,
  Sparkles,
  Database,
  ArrowRight,
} from 'lucide-react';
import ProcessTrackerBar from './ProcessTrackerBar';

const STAGES = [
  {
    key: 'upload_reading',
    number: '01',
    title: 'Document Parsing & Page Ingestion',
    description: 'PyMuPDF and image processors extract high-resolution text buffers.',
    icon: FileText,
  },
  {
    key: 'ocr_extraction',
    number: '02',
    title: 'Tesseract OCR & Heuristic Biomarker Match',
    description: 'Optical character recognition and regex pattern matching for clinical values.',
    icon: ScanText,
  },
  {
    key: 'gemma_extraction',
    number: '03',
    title: 'Gemma 3:4B Local Feature Extraction',
    description: 'Local neural model enforces strict clinical JSON schema and validates evidence.',
    icon: Sparkles,
  },
  {
    key: 'feature_store_saving',
    number: '04',
    title: 'SQLite Feature Store & JEV Suitability Scoring',
    description: 'Persisting extraction audit ledger and matching disease model readiness.',
    icon: Database,
  },
];

function getStageIndex(stage) {
  switch (stage) {
    case 'upload_reading':
      return 0;
    case 'ocr_extraction':
      return 1;
    case 'gemma_extraction':
      return 2;
    case 'feature_store_saving':
      return 3;
    case 'complete':
      return 4;
    default:
      return 0;
  }
}

export default function OCRProgressModal({
  isOpen,
  stage = 'upload_reading',
  error = null,
  onClose,
  diseaseType = 'all',
  filename = '',
}) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isOpen && stage !== 'complete' && !error) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isOpen, stage, error]);

  if (!isOpen) return null;

  const currentIndex = getStageIndex(stage);
  const isComplete = stage === 'complete';
  const hasError = Boolean(error);
  const progressPercent = hasError
    ? 100
    : isComplete
      ? 100
      : Math.max(15, Math.min(95, ((currentIndex + 0.6) / STAGES.length) * 100));

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins > 0 ? `${mins}m ` : ''}${secs}s`;
  };

  const getStageTitle = () => {
    if (hasError) return 'Document Parsing Failed';
    if (isComplete) return 'Biomarkers & Evidence Extracted!';
    if (stage === 'gemma_extraction') return 'Gemma 3:4B Local Feature Extraction';
    if (stage === 'ocr_extraction') return 'Tesseract OCR Biomarker Match';
    if (stage === 'feature_store_saving') return 'SQLite Feature Store Saving';
    return 'Document Parsing & Page Ingestion';
  };

  const mappedSteps = STAGES.map((s, index) => {
    let status = 'pending';
    if (hasError) {
      if (index < currentIndex) status = 'complete';
      else if (index === currentIndex) status = 'error';
      else status = 'pending';
    } else if (isComplete) {
      status = 'complete';
    } else {
      if (index < currentIndex) status = 'complete';
      else if (index === currentIndex) status = 'active';
      else status = 'pending';
    }

    return {
      key: s.key,
      number: s.number,
      title: s.title,
      description: s.description,
      status,
    };
  });

  const actions = [];
  if (isComplete || hasError) {
    actions.push({
      label: isComplete ? 'View Extracted Results' : 'Close & Retry',
      icon: <ArrowRight size={14} />,
      onClick: onClose,
      variant: 'primary',
    });
  }

  const trackerElement = (
    <ProcessTrackerBar
      isOpen={isOpen}
      moduleLabel={diseaseType && diseaseType !== 'all' ? `OCR • ${diseaseType.toUpperCase()}` : 'OCR SCANNER'}
      currentProcessName={getStageTitle()}
      currentProcessDesc={
        filename
          ? `File: ${filename} • ${hasError ? 'Extraction encountered an error' : isComplete ? 'Validated in local SQLite store' : 'Local neural extraction in progress'}`
          : 'Local neural extraction in progress'
      }
      progressPercent={progressPercent}
      isActive={!isComplete && !hasError}
      isComplete={isComplete}
      isError={hasError}
      errorMessage={error}
      elapsedText={formatTime(elapsed)}
      steps={mappedSteps}
      actions={actions}
      onClose={onClose}
      defaultExpanded={false}
    />
  );

  return createPortal(trackerElement, document.body);
}
