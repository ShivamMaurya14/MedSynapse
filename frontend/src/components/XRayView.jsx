import React, { useState, useRef } from 'react';
import { Scan, Upload, Play, RefreshCw, AlertCircle, CheckCircle, Image as ImageIcon, Sparkles, FileText } from 'lucide-react';
import { predictXRay } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';

export default function XRayView() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
      setError(null);
    }
  };

  const handleLoadSampleScan = async (sampleType) => {
    setError(null);
    setLoading(true);
    try {
      // Create a sample canvas radiograph blob
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 300, 300);

      // Ribs & Lung fields
      ctx.fillStyle = sampleType === 'pneumonia' ? '#475569' : '#1e293b';
      ctx.beginPath();
      ctx.ellipse(90, 150, 45, 90, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(210, 150, 45, 90, 0, 0, Math.PI * 2);
      ctx.fill();

      // Opacity infiltrate if pneumonia
      if (sampleType === 'pneumonia') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(200, 170, 35, 0, Math.PI * 2);
        ctx.fill();
      }

      // Spine & sternum
      ctx.fillStyle = '#64748b';
      ctx.fillRect(140, 30, 20, 240);

      canvas.toBlob(async (blob) => {
        const sampleFile = new File([blob], `sample_${sampleType}_xray.png`, { type: 'image/png' });
        setFile(sampleFile);
        setPreview(URL.createObjectURL(sampleFile));

        // Auto predict
        try {
          const res = await predictXRay(sampleFile);
          setResult(res);
          setTimeout(() => {
            resultRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 150);
        } catch (err) {
          setError(err.message || 'X-Ray analysis failed');
        } finally {
          setLoading(false);
        }
      }, 'image/png');

    } catch (err) {
      setError('Could not generate sample: ' + err.message);
      setLoading(false);
    }
  };

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    if (!file) {
      setError('Please select or upload a chest X-Ray scan image.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await predictXRay(file);
      setResult(res);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err) {
      setError(err.message || 'X-Ray analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-cyan">Radiology & Vision AI</span>
            <span className="badge badge-success">Convolutional Neural Network</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
            Chest X-Ray Pneumonia Detector
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Automated deep learning screening for acute pulmonary opacification and pneumonia consolidations.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Feature extraction: the model uses a validated 224 × 224 normalized chest X-ray pixel tensor; text reports are not used as model inputs.
          </p>
        </div>
      </div>

      {/* Demo Sample Presets */}
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Instant 1-Click Demo Scans:
        </span>
        <button
          type="button"
          disabled={loading}
          onClick={() => handleLoadSampleScan('normal')}
          className="btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
        >
          🟢 Test Normal Healthy Lungs
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => handleLoadSampleScan('pneumonia')}
          className="btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.85rem', borderColor: 'rgba(244, 63, 94, 0.4)' }}
        >
          🔴 Test Pneumonia Infiltrate
        </button>
      </div>

      {/* Upload & Preview Card Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {/* Upload Card */}
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} color="#38bdf8" /> Upload Radiograph Scan
          </h3>

          <label 
            style={{
              border: '2px dashed rgba(56, 189, 248, 0.4)',
              borderRadius: '12px',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              backgroundColor: 'rgba(14, 165, 233, 0.04)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease'
            }}
          >
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(14, 165, 233, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Scan size={24} color="#38bdf8" />
            </div>
            <div>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>
                {file ? file.name : 'Select Chest X-Ray (JPEG/PNG)'}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Anterior-Posterior (AP) or Posterior-Anterior (PA) view
              </p>
            </div>
          </label>

          <button
            onClick={handlePredict}
            disabled={loading || !file}
            className="btn-primary"
            style={{ width: '100%', marginTop: 'auto', padding: '12px' }}
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Running Deep Neural Net Inference...</span>
              </>
            ) : (
              <>
                <Play size={18} />
                <span>Analyze Radiograph Scan</span>
              </>
            )}
          </button>
        </div>

        {/* Scan Preview Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '280px' }}>
          {preview ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <img 
                src={preview} 
                alt="Selected Chest X-Ray" 
                style={{
                  maxHeight: '260px',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                }} 
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scan Ready for Neural Network Evaluation</span>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem' }}>
              <ImageIcon size={48} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No scan loaded yet.</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Click a demo button above or upload your X-Ray scan to preview.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error Output */}
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: '10px',
          color: '#fda4af',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Results Card */}
      <div ref={resultRef}>
        {result && (
          <DiagnosticResultCard
            result={result}
            title="Chest Radiography Diagnostic Report"
            onReset={() => { setResult(null); setFile(null); setPreview(null); }}
          />
        )}
      </div>
    </div>
  );
}
