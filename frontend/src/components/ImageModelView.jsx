import React, { useRef, useState } from 'react';
import { Brain, CircleDot, Image as ImageIcon, RefreshCw, Upload } from 'lucide-react';
import DiagnosticResultCard from './DiagnosticResultCard';
import eyeFundusDemoA from '../assets/samples/eye-fundus-demo-a.jpg';
import eyeFundusDemoB from '../assets/samples/eye-fundus-demo-b.jpg';

const MODEL_COPY = {
  eye: {
    title: 'Eye Disease Analyzer',
    icon: CircleDot,
    description: 'Upload a fundus or ocular scan, or load one of the synthetic demonstration fundus images below.',
    endpointLabel: 'Eye image',
    accept: 'image/*',
    samples: [
      {
        title: 'Synthetic Fundus Demo A',
        description: 'Generated software-demo image. Not a patient record and not disease-labelled.',
        filename: 'synthetic-fundus-demo-a.jpg',
        source: eyeFundusDemoA,
      },
      {
        title: 'Synthetic Fundus Demo B',
        description: 'Generated software-demo image. Not a patient record and not disease-labelled.',
        filename: 'synthetic-fundus-demo-b.jpg',
        source: eyeFundusDemoB,
      },
    ],
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

  const loadSample = async (sample) => {
    setResult(null);
    setError(null);
    try {
      const response = await fetch(sample.source);
      const blob = await response.blob();
      setFile(new File([blob], sample.filename, { type: blob.type || 'image/png' }));
      setPreview(sample.source);
    } catch {
      setError(`Could not load ${sample.title}.`);
    }
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
        {copy.samples?.length > 0 && (
          <section style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ margin: 0, color: '#1b1b1b', fontSize: '1rem' }}>Synthetic fundus demo samples</h2>
            <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              These images are for upload and workflow testing only. They do not represent a patient or a clinical diagnosis.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.8rem', marginTop: '0.9rem' }}>
              {copy.samples.map(sample => (
                <button
                  key={sample.filename}
                  type="button"
                  className="btn-secondary"
                  onClick={() => loadSample(sample)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px', textAlign: 'left' }}
                >
                  <img src={sample.source} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px' }} />
                  <span>
                    <strong style={{ display: 'block', color: '#1b1b1b', fontSize: '0.8rem' }}>{sample.title}</strong>
                    <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: '3px', fontSize: '0.68rem' }}>{sample.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
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
