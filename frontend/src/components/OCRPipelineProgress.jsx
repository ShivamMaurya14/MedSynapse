/**
 * OCRPipelineProgress — shows each stage of the
 * upload → OCR → Gemma extraction → DB save pipeline
 * with animated steps, elapsed time, and per-stage descriptions.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Database,
  FileSearch,
  LoaderCircle,
  ScanText,
  Sparkles,
  XCircle,
} from 'lucide-react';

// ─── Stage definitions ────────────────────────────────────────────────────────
const STAGES = [
  {
    key: 'upload',
    icon: FileSearch,
    label: 'Reading document',
    hint: 'Sending the file to the backend over a local connection.',
  },
  {
    key: 'ocr',
    icon: ScanText,
    label: 'OCR extraction',
    hint: 'Tesseract 5 + PyMuPDF are reading text from every page.',
  },
  {
    key: 'gemma',
    icon: Sparkles,
    label: 'Gemma feature extraction',
    hint: 'Local gemma3:4b is identifying clinical values from the OCR text. This takes ~45–90 s on CPU.',
  },
  {
    key: 'db',
    icon: Database,
    label: 'Saving to feature store',
    hint: 'Validated features and extraction status are written to SQLite.',
  },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

// ─── Helper: elapsed timer ────────────────────────────────────────────────────
function useElapsed(running) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (running) {
      setElapsed(0);
      ref.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(ref.current);
    }
    return () => clearInterval(ref.current);
  }, [running]);
  return elapsed;
}

function fmt(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─── Step row ─────────────────────────────────────────────────────────────────
function StepRow({ stage, activeKey, errorKey }) {
  const activeIdx = STAGE_INDEX[activeKey] ?? -1;
  const stageIdx  = STAGE_INDEX[stage.key];
  const Icon = stage.icon;

  let status = 'pending';
  if (errorKey === stage.key)       status = 'error';
  else if (stageIdx < activeIdx)    status = 'done';
  else if (stageIdx === activeIdx)  status = 'active';

  const colours = {
    done:    { bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.4)',  text: '#4ade80' },
    active:  { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.5)', text: '#38bdf8' },
    error:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  text: '#f87171' },
    pending: { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', text: '#64748b' },
  }[status];

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      padding: '12px 14px', borderRadius: '10px',
      background: colours.bg, border: `1px solid ${colours.border}`,
      transition: 'all 0.3s ease',
    }}>
      {/* Icon bubble */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: colours.border, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {status === 'done'   && <CheckCircle2 size={17} color={colours.text} />}
        {status === 'active' && <LoaderCircle size={17} color={colours.text} className="animate-spin" />}
        {status === 'error'  && <XCircle      size={17} color={colours.text} />}
        {status === 'pending'&& <Circle       size={14} color={colours.text} />}
      </div>

      {/* Text */}
      <div>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: colours.text }}>
          <Icon size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          {stage.label}
        </div>
        {(status === 'active' || status === 'error') && (
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 3 }}>
            {stage.hint}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * Props
 *   activeStage  : 'upload' | 'ocr' | 'gemma' | 'db' | null
 *   errorStage   : same set | null
 *   errorMessage : string | null
 *   diseaseLabel : string   e.g. "Diabetes"
 */
export default function OCRPipelineProgress({ activeStage, errorStage, errorMessage, diseaseLabel }) {
  const isRunning = Boolean(activeStage && !errorStage);
  const elapsed   = useElapsed(isRunning);
  const isDone    = !activeStage && !errorStage;   // all stages finished, parent cleared activeStage

  if (!activeStage && !errorStage) return null;     // nothing to show

  const activeIdx = STAGE_INDEX[activeStage] ?? 0;
  const progress  = errorStage
    ? null
    : isDone ? 100 : Math.round(((activeIdx) / STAGES.length) * 100);

  return (
    <div style={{
      background: 'rgba(15,23,42,0.9)',
      border: '1px solid rgba(56,189,248,0.25)',
      borderRadius: '14px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {errorStage ? 'Pipeline interrupted' : 'Pipeline running'}
          </p>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginTop: 2 }}>
            {errorStage
              ? `Error during ${STAGES.find(s => s.key === errorStage)?.label ?? errorStage}`
              : activeStage
                ? `${STAGES.find(s => s.key === activeStage)?.label ?? activeStage}…`
                : 'All stages complete'}
          </h3>
        </div>
        {isRunning && (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
            ⏱ {fmt(elapsed)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg,#0ea5e9,#38bdf8)',
            borderRadius: 99,
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {STAGES.map(stage => (
          <StepRow
            key={stage.key}
            stage={stage}
            activeKey={activeStage}
            errorKey={errorStage}
          />
        ))}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          fontSize: '0.82rem', color: '#fca5a5',
        }}>
          {errorMessage}
        </div>
      )}

      {/* Gemma note */}
      {activeStage === 'gemma' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
          fontSize: '0.78rem', color: '#fde047',
        }}>
          <Sparkles size={13} />
          gemma3:4b is running locally — generation takes 45–90 s on CPU. Do not close or refresh.
        </div>
      )}
    </div>
  );
}
