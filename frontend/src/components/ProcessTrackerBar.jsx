import React, { useState } from 'react';
import {
  CheckCircle2,
  LoaderCircle,
  XCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  Sparkles,
  ArrowRight,
  Activity,
} from 'lucide-react';

export default function ProcessTrackerBar({
  isOpen,
  moduleLabel = 'PROCESS',
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
  onClose,
  defaultExpanded = false,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!isOpen) return null;

  const displayPercent = Math.max(0, Math.min(100, Math.round(progressPercent)));

  const handleBarClick = (e) => {
    // Only toggle if not clicking a button inside the bar
    if (e.target.closest('button')) return;
    setIsExpanded((prev) => !prev);
  };

  return (
    <aside
      className="process-tracker-container"
      aria-label="Clinical Process Tracker"
      role="complementary"
    >
      {/* ── Single Interactive Line Tracker Bar ── */}
      <div
        className={`process-tracker-line-bar ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''} ${isError ? 'is-error' : ''}`}
        onClick={handleBarClick}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${currentProcessName} — ${displayPercent}% complete. Click to ${isExpanded ? 'collapse' : 'expand'} details.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
      >
        {/* Status Indicator Icon */}
        <div className="tracker-status-icon-wrap">
          {isError ? (
            <XCircle size={16} className="text-red-500" strokeWidth={2.5} />
          ) : isComplete ? (
            <CheckCircle2 size={16} className="text-emerald-600" strokeWidth={2.5} />
          ) : isActive ? (
            <div className="tracker-pulse-icon-box">
              <LoaderCircle size={15} className="animate-spin text-teal-600" strokeWidth={2.5} />
            </div>
          ) : (
            <Activity size={15} className="text-slate-500" />
          )}
        </div>

        {/* Module Label Pill */}
        {moduleLabel && (
          <span className="tracker-module-pill">
            {moduleLabel}
          </span>
        )}

        {/* Active Undergoing Process Name (The single line of text) */}
        <div className="tracker-process-text-wrap" title={`${currentProcessName} ${currentProcessDesc ? `— ${currentProcessDesc}` : ''}`}>
          <span className="tracker-process-title">
            {currentProcessName || 'Processing clinical operation...'}
          </span>
          {elapsedText && !isComplete && !isError && (
            <span className="tracker-elapsed-tag">
              ⏱ {elapsedText}
            </span>
          )}
        </div>

        {/* Percentage or Status Badge */}
        <div className="tracker-progress-badge">
          {isError ? 'Failed' : isComplete ? 'Ready' : `${displayPercent}%`}
        </div>

        {/* Interactive Expand/Collapse & Close Buttons */}
        <div className="tracker-controls-wrap">
          <button
            type="button"
            className="tracker-ctrl-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            title={isExpanded ? 'Collapse stage details' : 'Expand stage details'}
            aria-label={isExpanded ? 'Collapse stage details' : 'Expand stage details'}
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {onClose && (isComplete || isError || !isActive) && (
            <button
              type="button"
              className="tracker-ctrl-btn tracker-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Dismiss tracker bar"
              aria-label="Dismiss tracker bar"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Single Interactive Progress Track Line (Integrated directly along bottom of bar) */}
        <div className="tracker-single-line-track">
          <div
            className={`tracker-single-line-fill ${isActive ? 'is-animated' : ''} ${isError ? 'is-error' : ''} ${isComplete ? 'is-complete' : ''}`}
            style={{ width: `${displayPercent}%` }}
          />
        </div>
      </div>

      {/* ── Expanded Floating Stage Breakdown & Actions Panel ── */}
      {isExpanded && (
        <div className="process-tracker-dropdown animate-fade-in" role="region" aria-label="Process Details">
          {/* Header of expanded details */}
          <div className="tracker-dropdown-header">
            <div>
              <div className="tracker-dropdown-eyebrow">
                <span>{moduleLabel} Audit Trail</span>
                {elapsedText && <span>Elapsed: {elapsedText}</span>}
              </div>
              <h4 className="tracker-dropdown-title">{currentProcessName}</h4>
              {currentProcessDesc && (
                <p className="tracker-dropdown-desc">{currentProcessDesc}</p>
              )}
            </div>
            <button
              type="button"
              className="tracker-dropdown-minimize-btn"
              onClick={() => setIsExpanded(false)}
              title="Collapse to single line"
            >
              <ChevronUp size={14} />
              <span>Minimize</span>
            </button>
          </div>

          {/* Error Banner if any */}
          {isError && errorMessage && (
            <div className="tracker-dropdown-error">
              <XCircle size={15} />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '0.78rem' }}>Operation Interrupted</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Multi-Step Progression List */}
          {steps.length > 0 && (
            <div className="tracker-dropdown-steps">
              {steps.map((s, idx) => {
                const status = s.status || 'pending';
                return (
                  <div className={`tracker-step-item is-${status}`} key={s.key || idx}>
                    <div className="tracker-step-icon">
                      {status === 'complete' && <CheckCircle2 size={14} className="text-emerald-600" strokeWidth={2.5} />}
                      {status === 'active' && <LoaderCircle size={14} className="animate-spin text-teal-600" />}
                      {(status === 'error' || status === 'rejected') && <XCircle size={14} className="text-red-500" strokeWidth={2.5} />}
                      {(status === 'pending' || status === 'queued' || status === 'blocked') && (
                        <Circle size={9} fill="currentColor" opacity={0.35} />
                      )}
                      {status === 'current' && <Activity size={14} className="text-teal-600" />}
                    </div>

                    <div className="tracker-step-info">
                      <div className="tracker-step-header">
                        {s.number && <span className="tracker-step-num">{s.number}</span>}
                        <span className="tracker-step-name">{s.title || s.label}</span>
                      </div>
                      {s.description && (
                        <p className="tracker-step-desc">{s.description}</p>
                      )}
                    </div>

                    <div className="tracker-step-badge-wrap">
                      {status === 'complete' && <span className="tracker-badge-pill is-complete">Done</span>}
                      {status === 'active' && <span className="tracker-badge-pill is-active">Active</span>}
                      {status === 'error' && <span className="tracker-badge-pill is-error">Error</span>}
                      {status === 'rejected' && <span className="tracker-badge-pill is-error">Rejected</span>}
                      {status === 'current' && <span className="tracker-badge-pill is-active">Review</span>}
                      {status === 'pending' && <span className="tracker-badge-pill is-pending">Queued</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Buttons Footer */}
          {actions.length > 0 && (
            <div className="tracker-dropdown-actions">
              {actions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  className={`tracker-action-btn ${action.variant === 'primary' ? 'is-primary' : 'is-secondary'}`}
                  onClick={() => {
                    action.onClick?.();
                  }}
                  style={action.style}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
