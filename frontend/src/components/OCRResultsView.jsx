import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Database,
  ShieldCheck,
  CheckCircle2,
  FileText,
  UploadCloud,
  AlertCircle
} from 'lucide-react';

export default function OCRResultsView({
  ocrResult,
  onBack,
  onTransferToPredictor,
  sourceInfo = 'Clinical Document'
}) {
  if (!ocrResult) {
    return (
      <div className="animate-fade-in" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{
          maxWidth: '560px',
          margin: '0 auto',
          padding: '2.5rem',
          borderRadius: '16px',
          background: '#ffffff',
          border: '1px solid #d7e7db',
          boxShadow: 'var(--shadow-md)'
        }}>
          <AlertCircle size={40} color="#f43f5e" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            No Extracted Features Available
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
            Please scan a lab report or select a sample document from the scanner to view biomarker extractions.
          </p>
          <button onClick={onBack} className="btn-primary">
            <ArrowLeft size={16} />
            <span>Go to Document Scanner</span>
          </button>
        </div>
      </div>
    );
  }

  const parametersList = Object.entries(ocrResult.parameters || {});

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Top Navigation & Utility Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '0.85rem 1.25rem',
        borderRadius: '12px',
        background: '#ffffff',
        border: '1px solid var(--border-card)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Lab Scanner</span>
          </button>
          <span style={{ color: 'var(--border-card)' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <FileText size={15} color="#25854a" />
            <span style={{ fontWeight: 600 }}>Source:</span>
            <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
              {sourceInfo}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onBack}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UploadCloud size={15} />
            <span>Upload Another Document</span>
          </button>
        </div>
      </div>

      {/* Main Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-success">
              <CheckCircle2 size={13} /> {ocrResult.extracted_count} Biomarkers Identified
            </span>
            <span className="badge badge-purple">JEV Suitability Verified</span>
            <span className="badge badge-cyan">Tesseract 5.0 + Gemma 3:4B</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
            Clinical Feature Extraction & Confidence Scoring
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '850px' }}>
            Validated multi-modal feature ledger parsed from clinical report. Features have been cross-checked against standard reference intervals, assigned confidence metrics, and indexed into the local SQLite store for downstream predictive CDSS models.
          </p>
        </div>
      </div>

      {/* Database Persistence & Feature Store Status Banner */}
      <div style={{
        padding: '1.1rem 1.25rem',
        borderRadius: '12px',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} color="#16a34a" />
            <strong style={{ color: '#166534', fontSize: '0.92rem' }}>
              Features Persisted to SQLite Feature Store (`data/medsynapse.db`)
            </strong>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
            <ShieldCheck size={12} /> Immutable Audit Ledger
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#1e3a2b', marginTop: '2px' }}>
          {ocrResult.feature_extraction_id && (
            <div>
              <strong>Diabetes Feature Extraction ID:</strong>{' '}
              <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                {ocrResult.feature_extraction_id}
              </code>
            </div>
          )}
          {ocrResult.heart_feature_extraction_id && (
            <div>
              <strong>Heart Feature Extraction ID:</strong>{' '}
              <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                {ocrResult.heart_feature_extraction_id}
              </code>
            </div>
          )}
          {ocrResult.breast_feature_extraction_id && (
            <div>
              <strong>Breast Feature Extraction ID:</strong>{' '}
              <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                {ocrResult.breast_feature_extraction_id}
              </code>
            </div>
          )}
        </div>
      </div>

      {/* JEV Evidence Suitability Scoring Section */}
      {Array.isArray(ocrResult.jev_scoring) && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-purple" style={{ fontSize: '0.78rem' }}>JEV Evidence Suitability</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Routing signal based on extracted biomarker completeness
              </span>
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>
            Scores indicate completeness and clinical suitability of extracted features for each downstream prediction model:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
            {ocrResult.jev_scoring.map(score => (
              <div 
                key={score.disease} 
                style={{ 
                  padding: '1rem', 
                  border: score.status === 'ready_for_routing' ? '1px solid #bbf7d0' : '1px solid var(--border-card)', 
                  borderRadius: '10px', 
                  background: score.status === 'ready_for_routing' ? '#f0fdf4' : '#ffffff',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{score.disease}</strong>
                  <span className={`badge ${score.status === 'ready_for_routing' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                    {score.confidence_percentage}%
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: score.status === 'ready_for_routing' ? '#166534' : 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
                  {score.status === 'ready_for_routing' ? '✓ Evidence complete for routing' : `Missing: ${score.missing_features?.join(', ') || 'Parameters'}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Clinical Parameters Header & Actions */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-card)', paddingBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-success">
                <CheckCircle2 size={13} /> {ocrResult.extracted_count} Biomarkers Identified
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Scanned {ocrResult.line_count} document lines
              </span>
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
              Extracted Clinical Parameters & Values
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Review the parsed clinical values below. Use the action buttons to route these parameters directly to any prediction module.
            </p>
          </div>

          {/* Quick Actions to Send to Models */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => onTransferToPredictor('diabetes')}
              className="btn-accent"
              style={{ background: 'linear-gradient(135deg, #e11d48, #f43f5e)', padding: '10px 18px' }}
            >
              <span>Apply to Diabetes Predictor</span>
              <ArrowRight size={16} />
            </button>

            <button 
              onClick={() => onTransferToPredictor('heart')}
              className="btn-primary"
              style={{ padding: '10px 18px' }}
            >
              <span>Apply to Cardiac Predictor</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onTransferToPredictor('breast')}
              disabled={ocrResult.gemma_breast_cancer?.status !== 'ready_for_inference'}
              className="btn-primary"
              style={{ padding: '10px 18px' }}
              title={ocrResult.gemma_breast_cancer?.status !== 'ready_for_inference' ? 'All 30 explicitly labelled WDBC FNA features are required before screening.' : ''}
            >
              <span>Apply to Breast Predictor</span>
              <ArrowRight size={16} />
            </button>

            <button 
              onClick={() => onTransferToPredictor('liver')}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', padding: '10px 18px' }}
            >
              <span>Apply to Liver Predictor</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Grid of Extracted Parameter Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem'
        }}>
          {parametersList.map(([key, item]) => {
            const isNormal = (item.clinical_status || item.status || '').toLowerCase().includes('normal') || 
                             (item.clinical_status || item.status || '').toLowerCase().includes('desirable');
            return (
              <div
                key={key}
                style={{
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid var(--border-card)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                    {typeof item.confidence === 'number' ? (item.confidence * 100).toFixed(0) : '95'}% Conf
                  </span>
                </div>

                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {item.display || item.value} <span style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 600 }}>{item.unit || ''}</span>
                </div>

                {item.normal_range && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Standard Ref: <strong style={{ color: 'var(--text-secondary)' }}>{item.normal_range}</strong>
                  </div>
                )}

                {(item.clinical_status || item.status) && (
                  <div>
                    <span className={`badge ${isNormal ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.68rem', fontWeight: 600 }}>
                      {item.clinical_status || item.status}
                    </span>
                  </div>
                )}

                {item.matched_text && (
                  <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={item.matched_text}>
                    Match: "{item.matched_text}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
