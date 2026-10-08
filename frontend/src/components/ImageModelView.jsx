import React, { useRef, useState } from 'react';
import { Brain, CircleDot, Image as ImageIcon, RefreshCw, Upload } from 'lucide-react';
import DiagnosticResultCard from './DiagnosticResultCard';

const MODEL_COPY = {
  eye: {
    title: 'Eye Disease Analyzer',
    icon: CircleDot,
    description: 'Upload a fundus or ocular scan for the future eye-disease model.',
    endpointLabel: 'Eye image',
    accept: 'image/*',
  },
  breast: {
    title: 'Breast Cancer Analyzer',
    icon: Brain,
    description: 'Upload a mammogram or breast scan for the future breast-cancer model.',
    endpointLabel: 'Breast image',
    accept: 'image/*',
  },
};

export default function ImageModelView({ kind, onPredict }) {
  const copy = MODEL_COPY[kind];
  const Icon = copy.icon;
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFile = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError(null);
  };

  const analyze = async () => {
    if (!file) {
      setError(`Choose an ${copy.endpointLabel.toLowerCase()} first.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await onPredict(file);
      setResult(response);
    } catch (err) {
      setError(err.message || `${copy.title} failed`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <span className="badge badge-cyan"><Icon size={13} /> Model Integration Slot</span>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b1b1b', marginTop: '6px' }}>{copy.title}</h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{copy.description}</p>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', maxWidth: '760px' }}>
        <input ref={inputRef} type="file" accept={copy.accept} onChange={handleFile} style={{ display: 'none' }} />
        <button className="btn-secondary" onClick={() => inputRef.current?.click()}>
          <Upload size={17} /> Choose image
        </button>
        {file && <span style={{ marginLeft: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{file.name}</span>}

        {preview && (
          <div style={{ marginTop: '1rem', border: '1px solid var(--border-card)', borderRadius: '10px', overflow: 'hidden', maxWidth: '520px' }}>
            <img src={preview} alt={`${copy.title} preview`} style={{ display: 'block', width: '100%', maxHeight: '360px', objectFit: 'contain' }} />
          </div>
        )}

        {error && <div style={{ marginTop: '1rem', color: '#b42318', fontSize: '0.85rem' }}>{error}</div>}
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn-primary" onClick={analyze} disabled={loading}>
            {loading ? <RefreshCw size={17} className="animate-spin" /> : <ImageIcon size={17} />}
            {loading ? 'Analyzing…' : 'Run model slot'}
          </button>
          <small style={{ color: 'var(--text-muted)' }}>Artifact required in <code>models/</code></small>
        </div>
      </div>

      {result && <DiagnosticResultCard result={result} title={copy.title} onReset={() => setResult(null)} />}
    </div>
  );
}
