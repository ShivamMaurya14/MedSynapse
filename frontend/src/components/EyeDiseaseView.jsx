import React, { useRef, useState } from 'react';
import { Eye, Upload, RefreshCw, FileText, CheckCircle2, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { predictEye } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';

const EYE_DEMOS = [
  {
    id: 'cataract',
    title: 'Cataract (Lens Opacity)',
    type: 'Cataracts',
    image: '/test_samples/eye_cataract.jpeg',
    desc: 'Verified Ocular dataset: Nuclear/cortical lens opacity with media haziness.',
    color: '#0284c7'
  },
  {
    id: 'glaucoma',
    title: 'Glaucoma (Optic Neuropathy)',
    type: 'Glaucoma',
    image: '/test_samples/eye_glaucoma.jpeg',
    desc: 'Verified Ocular dataset: Pathological optic cup cupping and neuroretinal margin thinning.',
    color: '#d97706'
  },
  {
    id: 'bulging',
    title: 'Bulging Eyes (Proptosis)',
    type: 'Bulging Eyes',
    image: '/test_samples/eye_bulging.jpeg',
    desc: 'Verified Ocular dataset: Anterior globe displacement and exophthalmos pattern.',
    color: '#b91c1c'
  },
  {
    id: 'crossed',
    title: 'Crossed Eyes (Strabismus)',
    type: 'Crossed Eyes',
    image: '/test_samples/eye_crossed.jpeg',
    desc: 'Verified Ocular dataset: Extraocular muscle misalignment and convergent axis deviation.',
    color: '#7c3aed'
  },
  {
    id: 'uveitis',
    title: 'Uveitis (Intraocular Inflammation)',
    type: 'Uveitis',
    image: '/test_samples/eye_uveitis.jpeg',
    desc: 'Verified Ocular dataset: Ciliary flush, anterior chamber reaction, and uveal inflammation.',
    color: '#c2410c'
  }
];

export default function EyeDiseaseView({ setTab }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setSelectedDemo(null);
    setResult(null);
    setError(null);
  };

  const handleSelectDemo = async (demo) => {
    setSelectedDemo(demo);
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(demo.image);
      if (!res.ok) throw new Error(`HTTP ${res.status} loading ${demo.image}`);
      const blob = await res.blob();
      const sampleFile = new File([blob], `${demo.id}_dataset_eye.jpeg`, { type: 'image/jpeg' });
      setPreview(demo.image);
      setFile(sampleFile);

      const analysisRes = await predictEye(sampleFile);
      setResult(analysisRes);
    } catch (err) {
      setError('Ophthalmic evaluation failed: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!file) {
      setError('Please upload a digital fundus photograph or select a clinical reference case.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await predictEye(file);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Retinal fundus analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Banner */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Eye size={13} /> Module M9 • Ophthalmology
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            PyTorch ResNet-18 Transfer Learning • 90.78% Benchmark Accuracy
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b1b1b', margin: 0 }}>
          Retinal Fundus Multi-Disease Analyzer
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '850px', fontSize: '0.92rem' }}>
          Automated multi-class digital fundus photography screening for <strong>Diabetic Retinopathy</strong>, <strong>Glaucoma (Optic Neuropathy)</strong>, <strong>Cataracts</strong>, and <strong>Healthy Retinal Vasculature</strong>.
        </p>
      </div>

      {/* Upload and Presets Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 0.8fr)', gap: '1.5rem' }}>
        
        {/* Upload Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Upload Digital Retinal Fundus Scan
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 14px 0' }}>
              Accepts 45° and widefield color fundus photography (JPEG / PNG). ResNet-18 scales input to 224×224 RGB.
            </p>

            <div 
              onClick={() => inputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '2rem 1rem',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer'
              }}
            >
              <input 
                ref={inputRef}
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              <Upload size={32} color="#64748b" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                Click to browse or drop retinal fundus image here
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                Color fundus photograph (macula or disc-centered)
              </div>
            </div>

            {preview && (
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px' }}>
                <img src={preview} alt="Fundus Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file?.name || 'Selected Retinal Fundus Image'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Status: Standardized for PyTorch ResNet-18
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
            <button 
              className="btn-primary" 
              onClick={runAnalysis} 
              disabled={loading}
              style={{ padding: '10px 20px', background: '#0f172a' }}
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
              <span>{loading ? 'Evaluating Fundus Scan…' : 'Run Retinal Disease Screening'}</span>
            </button>
            {result && (
              <button 
                className="btn-secondary" 
                onClick={() => { setResult(null); setFile(null); setPreview(null); setSelectedDemo(null); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Clinical Presets */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Sparkles size={16} color="#7c3aed" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Instant Reference Fundus Cases
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 12px 0' }}>
            Select verified reference fundus photographs for immediate 1-click evaluation:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {EYE_DEMOS.map((demo) => {
              const isSelected = selectedDemo?.id === demo.id;
              return (
                <div
                  key={demo.id}
                  onClick={() => handleSelectDemo(demo)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: isSelected ? '#f8fafc' : '#ffffff',
                    border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                      {demo.title}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: demo.type.includes('Normal') ? '#f0fdf4' : '#fef2f2',
                      color: demo.type.includes('Normal') ? '#15803d' : '#b91c1c'
                    }}>
                      {demo.type.split(' ')[0]}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                    {demo.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Result Card */}
      {result && (
        <DiagnosticResultCard 
          result={result} 
          title="Ophthalmic Retinal Fundus Assessment"
          onReset={() => { setResult(null); setFile(null); setPreview(null); setSelectedDemo(null); }}
        />
      )}

    </div>
  );
}
