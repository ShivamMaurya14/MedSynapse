import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  LoaderCircle,
  XCircle,
  Circle,
  Activity,
  FileSpreadsheet,
  Scan,
  BrainCircuit,
  Stethoscope,
  Sparkles,
  Award,
  FileDown,
  ChevronLeft,
  FileText,
  ScanText,
  Database,
  SlidersHorizontal,
} from 'lucide-react';
import { printReportDocument } from '../utils/printReport';

// Fallback icon resolver for level steps
function getDefaultStepIcon(index, stepKey = '') {
  if (stepKey.includes('scan') || stepKey.includes('image')) return Scan;
  if (stepKey.includes('ocr') || stepKey.includes('text')) return ScanText;
  if (stepKey.includes('db') || stepKey.includes('store')) return Database;
  switch (index) {
    case 0:
      return FileSpreadsheet;
    case 1:
      return BrainCircuit;
    case 2:
      return Stethoscope;
    case 3:
      return Sparkles;
    case 4:
      return Award;
    default:
      return Activity;
  }
}

export default function ProcessTrackerBar({
  isOpen,
  moduleLabel = 'DIAGNOSTIC PIPELINE',
  currentProcessName,
  currentProcessDesc,
  progressPercent = 0,
  isActive = false,
  isComplete = false,
  isError = false,
  errorMessage = null,
  elapsedText = null,
  steps = [],
  actions = [],
  onClose, // Intentionally ignored for closeable UI per user directive
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isClickedOpen, setIsClickedOpen] = useState(false);
  const [hoveredStepIndex, setHoveredStepIndex] = useState(null);
  const [isParametersModified, setIsParametersModified] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleModified = (e) => {
      setIsParametersModified(Boolean(e.detail?.isModified));
    };
    window.addEventListener('medsynapse-parameters-modified', handleModified);
    return () => window.removeEventListener('medsynapse-parameters-modified', handleModified);
  }, []);

  if (!isOpen) return null;

  const displayPercent = Math.max(0, Math.min(100, Math.round(progressPercent)));
  
  // Find current level number (1-indexed)
  const completedCount = steps.filter(s => s.status === 'complete').length;
  const currentStepIdx = steps.findIndex(s => s.status === 'current' || s.status === 'active');
  const currentLevelNum = currentStepIdx !== -1 
    ? currentStepIdx + 1 
    : isComplete 
      ? steps.length 
      : Math.min(steps.length, completedCount + 1);

  const showFlyout = isHovered || isClickedOpen;

  // Handle clicking outside the tracker to collapse the flyout if opened by click
  useEffect(() => {
    if (!isClickedOpen) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsClickedOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isClickedOpen]);

  const handleDownload = () => {
    printReportDocument('.clinical-report-sheet', `MedSynapse_${moduleLabel.replace(/\s+/g, '_')}_Report`);
  };

  const progressRatio = isComplete
    ? 1
    : steps.length > 1
      ? Math.max(0, Math.min(1, (currentLevelNum - 1) / (steps.length - 1)))
      : displayPercent / 100;

  return (
    <aside
      ref={containerRef}
      className="side-level-tracker-dock-container"
      aria-label="Clinical Pipeline Level Tracker"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredStepIndex(null);
      }}
    >
      {/* ── 1. Vertical Side Rail Dock (Balanced, Proportional Medical Tracker Bar) ── */}
      <div 
        className={`side-level-tracker-rail ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''} ${isError ? 'is-error' : ''} ${isClickedOpen ? 'is-expanded' : ''}`}
        onClick={() => setIsClickedOpen(prev => !prev)}
        role="region"
        aria-label={`Diagnostic Level Tracker: Level ${currentLevelNum} of ${steps.length}`}
        title={showFlyout ? undefined : "Diagnostic Pipeline Tracker — Hover or click to view step-by-step level audit"}
      >
        {/* Top Level Telemetry Header */}
        <div 
          className="side-dock-top-badge" 
          title={showFlyout ? undefined : `Diagnostic Pipeline: Level ${currentLevelNum} of ${steps.length} (${displayPercent}% Completed)`}
        >
          <div className="side-dock-status-dot">
            {isError ? (
              <XCircle size={14} className="text-red-400" />
            ) : isComplete ? (
              <CheckCircle2 size={14} className="text-emerald-400" />
            ) : isActive ? (
              <LoaderCircle size={14} className="animate-spin text-teal-300" />
            ) : (
              <Activity size={14} className="text-teal-400" />
            )}
          </div>
          <span className="side-dock-level-label">L{currentLevelNum}</span>
          <span className="side-dock-percent-text">{displayPercent}%</span>
        </div>

        {/* Vertical Stepper Nodes with Diagnostic Pipeline Spine */}
        <div className="side-dock-stepper-track">
          {/* Continuous Rail Line Track Wrapper */}
          <div className="side-dock-track-line-wrap">
            <div className="side-dock-track-line-bg" />
            <div 
              className="side-dock-track-line-fill" 
              style={{ 
                height: `${progressRatio * 100}%` 
              }} 
            />
          </div>

          {steps.map((step, idx) => {
            const status = step.status || 'pending';
            const isDone = status === 'complete';
            const isCurrent = status === 'current' || status === 'active';
            const isErr = status === 'error' || status === 'rejected';
            const StepIcon = step.icon || getDefaultStepIcon(idx, step.key);

            return (
              <div
                key={step.key || idx}
                className={`side-dock-node is-${status} ${hoveredStepIndex === idx ? 'is-hovered' : ''}`}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredStepIndex(idx);
                }}
                title={showFlyout ? undefined : `Level 0${idx + 1}: ${step.title || step.label} (${isDone ? 'Completed' : isCurrent ? 'Under Review' : 'Queued'})`}
              >
                <div className="side-dock-node-circle">
                  <StepIcon size={14} className="side-dock-node-icon" />
                  {isDone && (
                    <span className="side-dock-done-check">✓</span>
                  )}
                  {isCurrent && (
                    <span className="side-dock-pulse-ring" />
                  )}
                </div>
                <span className="side-dock-node-number">{step.number || `0${idx + 1}`}</span>
              </div>
            );
          })}
        </div>

        {/* Bottom Utility & Action Bay */}
        <div className="side-dock-footer-actions">
          <div className="side-dock-footer-divider" />

          {/* Quick Action: Tweak Decisions directly from Rail */}
          <button
            type="button"
            className="side-dock-tweak-btn"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('medsynapse-open-tweak-center'));
            }}
            title="Tweak & Modify Model Decisions (Clinician Override)"
            aria-label="Tweak and Modify Model Decisions"
          >
            <SlidersHorizontal size={14} />
          </button>

          {/* Quick Action: Download ML Report directly from Rail */}
          <button
            type="button"
            className="side-dock-download-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            title="Download Clinical Report as PDF"
            aria-label="Download Diagnostic Report as PDF"
          >
            <FileDown size={14} />
          </button>

          {/* Hover/Expand Peek Tab Indicator */}
          <div 
            className="side-dock-peek-handle"
            title={showFlyout ? "Collapse audit details" : "Expand audit details"}
          >
            <ChevronLeft size={12} className={showFlyout ? 'rotate-180' : ''} />
          </div>
        </div>
      </div>

      {/* ── 2. Interactive Flyout: Level Details & What is Done Till This State ── */}
      {showFlyout && (
        <div 
          className="side-level-flyout animate-fade-in"
          role="dialog"
          aria-label="Diagnostic Level Details"
        >
          {/* Header - Pin button cleanly removed */}
          <div className="side-flyout-header">
            <div>
              <div className="side-flyout-eyebrow">
                <span className="side-flyout-module-tag">{moduleLabel}</span>
                <span className="side-flyout-audit-tag">Diagnostic Audit Ledger</span>
                {elapsedText && <span className="side-flyout-elapsed">⏱ {elapsedText}</span>}
              </div>
              <h3 className="side-flyout-title">
                Level {currentLevelNum} of {steps.length}: {currentProcessName || 'Diagnostic In Progress'}
              </h3>
              {currentProcessDesc && (
                <p className="side-flyout-desc">{currentProcessDesc}</p>
              )}
            </div>
          </div>

          {/* Overall Level Progress Bar */}
          <div className="side-flyout-progress-container">
            <div className="side-flyout-progress-meta">
              <span className="side-flyout-progress-label">
                Pipeline Execution: <strong>{completedCount} of {steps.length} Levels Completed</strong>
              </span>
              <span className="side-flyout-progress-val">{displayPercent}%</span>
            </div>
            <div className="side-flyout-progress-track">
              <div 
                className={`side-flyout-progress-fill ${isActive ? 'is-animated' : ''} ${isComplete ? 'is-complete' : ''} ${isError ? 'is-error' : ''}`}
                style={{ width: `${displayPercent}%` }}
              />
            </div>
          </div>

          {/* Error Banner if any */}
          {isError && errorMessage && (
            <div className="side-flyout-error-box">
              <XCircle size={16} className="text-red-500" />
              <div>
                <strong>Pipeline Interrupted</strong>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* What is Done Till This State: Chronological Level Audit List */}
          <div className="side-flyout-steps-section">
            <div className="side-flyout-section-heading">
              <span>Stage-by-Stage Diagnostic Audit:</span>
              <span className={`side-flyout-badge-state ${completedCount === steps.length ? 'is-all-done' : isError ? 'is-error' : 'is-in-progress'}`}>
                {completedCount === steps.length 
                  ? '✓ All Levels Completed' 
                  : isError 
                    ? '⚠️ Stage Interrupted' 
                    : `Active · Level 0${currentLevelNum} of 0${steps.length}`}
              </span>
            </div>

            <div className="side-flyout-steps-list">
              {steps.map((s, idx) => {
                const status = s.status || 'pending';
                const isStepComplete = status === 'complete';
                const isStepActive = status === 'active' || status === 'current';
                const isStepError = status === 'error' || status === 'rejected';
                const StepIcon = s.icon || getDefaultStepIcon(idx, s.key);
                const isTargetHovered = hoveredStepIndex === idx;

                return (
                  <div 
                    key={s.key || idx} 
                    className={`side-flyout-step-row is-${status} ${isTargetHovered ? 'is-target-hovered' : ''}`}
                  >
                    {/* Level Icon with Appropriate Medical/Diagnostic Logo */}
                    <div className="side-flyout-step-icon-wrap">
                      <div className="side-flyout-icon-box">
                        <StepIcon size={15} />
                      </div>
                      <span className="side-flyout-step-level-tag">L0{idx + 1}</span>
                    </div>

                    {/* Step Details & What Was Done */}
                    <div className="side-flyout-step-body">
                      <div className="side-flyout-step-top">
                        <span className="side-flyout-step-title">{s.title || s.label}</span>
                        {/* Status Badge */}
                        <div className="side-flyout-status-pill-wrap">
                          {isStepComplete && (
                            <span className="side-flyout-pill is-done">
                              <CheckCircle2 size={10} /> Completed
                            </span>
                          )}
                          {isStepActive && (
                            <span className="side-flyout-pill is-active">
                              <Activity size={10} /> {status === 'current' ? 'Under Review' : 'Active'}
                            </span>
                          )}
                          {isStepError && (
                            <span className="side-flyout-pill is-error">
                              <XCircle size={10} /> {status === 'rejected' ? 'Rejected' : 'Error'}
                            </span>
                          )}
                          {!isStepComplete && !isStepActive && !isStepError && (
                            <span className="side-flyout-pill is-queued">
                              <Circle size={8} /> Queued
                            </span>
                          )}
                        </div>
                      </div>

                      {s.description && (
                        <p className="side-flyout-step-desc">
                          {isStepComplete 
                            ? `✓ Completed: ${s.description}`
                            : isStepActive 
                              ? `⚡ In Progress: ${s.description}`
                              : `⏳ Scheduled: ${s.description}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="side-flyout-actions-footer">
            {/* Highly Visible & Highlighted Tweak Decisions Action */}
            <button
              type="button"
              className="side-flyout-action-btn is-tweak-highlight"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('medsynapse-open-tweak-center'));
              }}
              title="Clinician Governance: Modify diagnostic determination, adjust risk tier, override parameters or record clinical notes"
            >
              <SlidersHorizontal size={14} color="#ffffff" strokeWidth={2.5} />
              <span>🎚️ Tweak Model Decisions</span>
            </button>

            {/* Run ML Analysis Button (Prominently Active when Parameters are Modified) */}
            {isParametersModified && (
              <button
                type="button"
                className="side-flyout-action-btn is-ml-active btn-run-ml-pulse"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('medsynapse-trigger-ml-analysis'));
                }}
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  border: '1.5px solid #38bdf8',
                  boxShadow: '0 0 16px rgba(56, 189, 248, 0.55)',
                }}
                title="Parameters modified! Click to run ML analysis on updated values"
              >
                <Activity size={14} color="#ffffff" className="animate-spin" />
                <span>⚡ Run ML Analysis (Active)</span>
              </button>
            )}

            {/* Single Clean Report PDF Download Button (Disabled when parameters modified) */}
            <button
              type="button"
              className={`side-flyout-action-btn is-download ${isParametersModified ? 'is-disabled-stale' : ''}`}
              onClick={isParametersModified ? undefined : handleDownload}
              disabled={isParametersModified}
              style={isParametersModified ? {
                opacity: 0.55,
                cursor: 'not-allowed',
                background: '#64748b',
                borderColor: '#64748b',
                color: '#f8fafc',
              } : undefined}
              title={isParametersModified 
                ? "Download locked: clinical parameters were modified. Run ML Analysis to generate a fresh report and enable download." 
                : "Download ONLY the clinical diagnostic report currently showing as a PDF"}
            >
              <FileDown size={14} />
              <span>{isParametersModified ? 'Download Locked (Stale)' : 'Download ML Report (PDF)'}</span>
            </button>

            {/* Other actions like Generate Report via LLM (excluding duplicate download buttons) */}
            {actions
              .filter(act => !act.label || !act.label.toLowerCase().includes('download'))
              .map((act, i) => (
                <button
                  key={i}
                  type="button"
                  className={`side-flyout-action-btn ${act.variant === 'primary' ? 'is-primary' : 'is-secondary'}`}
                  onClick={act.onClick}
                  style={act.style}
                >
                  {act.icon}
                  <span>{act.label}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </aside>
  );
}
