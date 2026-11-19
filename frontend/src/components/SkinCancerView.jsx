import React, { useRef, useState } from 'react';
import { Eye, Upload, RefreshCw, FileText, CheckCircle2, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { predictSkinCancer } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';
import ClinicalPipelineProgressModal from './ClinicalPipelineProgressModal';
import useClinicalPipelineProgress from '../hooks/useClinicalPipelineProgress';
import { printReportDocument } from '../utils/printReport';
import ModuleTopBar from './ModuleTopBar';

const SKIN_DEMOS = [
  {
    id: 'mel',
    title: 'Cutaneous Malignant Melanoma',
    type: 'Melanoma',
    tier: 'High Risk',
    malignant: true,
    image: '/test_samples/skin_melanoma.jpg',
    desc: 'Verified HAM10000 dataset: Pigmented macule with irregular notched borders.',
    color: '#b91c1c'
  },
  {
    id: 'bcc',
    title: 'Basal Cell Carcinoma (BCC)',
    type: 'Basal Cell Carcinoma',
    tier: 'High Risk',
    malignant: true,
    image: '/test_samples/skin_basal_cell_carcinoma.jpg',
    desc: 'Verified HAM10000 dataset: Translucent papule with arborizing telangiectasias.',
    color: '#c2410c'
  },
  {
    id: 'akiec',
    title: 'Actinic Keratoses / Bowen Disease',
    type: 'Actinic Keratoses',
    tier: 'Moderate Risk',
    malignant: false,
    image: '/test_samples/skin_actinic_keratosis.jpg',
    desc: 'Verified HAM10000 dataset: Erythematous scaly plaque with follicular plugging.',
    color: '#d97706'
  },
  {
    id: 'nv',
    title: 'Benign Melanocytic Nevus',
    type: 'Melanocytic Nevus',
    tier: 'Low Risk',
    malignant: false,
    image: '/test_samples/skin_nevus.jpg',
    desc: 'Verified HAM10000 dataset: Symmetric homogeneous reticular pigment network.',
    color: '#15803d'
  }
];

export default function SkinCancerView({ setTab, onNavigateToLLMReport, onNavigateToDiagnosticReport }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const pipelineProgress = useClinicalPipelineProgress();

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setSelectedDemo(null);
    setResult(null);
    setError(null);
  };

  const handleDownloadMLReportFromModal = () => {
    printReportDocument('.clinical-report-sheet', 'MedSynapse_Skin_Cancer_Dermoscopy_Report');
  };

  const handleGenerateLLMReportFromModal = () => {
    pipelineProgress.close();
    const docName = (
      result?.clinician_review?.reviewed_by?.trim() ||
      result?.clinical_report?.clinician_review?.reviewed_by?.trim() ||
      localStorage.getItem('medsynapse_doctor_name') ||
      ''
    ).trim();
    const docTitle = localStorage.getItem('medsynapse_doctor_title') || 'Attending Physician';

    onNavigateToLLMReport?.({
      diseaseKey: 'skin-cancer',
      prediction: {
        ...(result?.data || result || {}),
        reviewed_by: docName,
      },
      inputs: {
        source_filename: file?.name || 'dermoscopy_image.jpg',
        file: file,
        previewUrl: preview,
        image_preview: preview,
        image_url: preview,
        preview: preview,
        demo_id: selectedDemo?.id,
      },
      image: preview,
      preview: preview,
      clinicalReport: result?.clinical_report || null,
      modelRunId: result?.model_run_id || null,
      reviewedBy: docName,
      doctorInfo: {
        name: docName,
        title: docTitle,
        timestamp: new Date().toLocaleString(),
      },
      tweakedDecisions: {
        hasTweaks: Boolean(docName),
        doctorInfo: {
          name: docName,
          title: docTitle,
          timestamp: new Date().toLocaleString(),
        }
      }
    });
  };

  const handleSelectDemo = async (demo) => {
    setSelectedDemo(demo);
    setError(null);
    setResult(null);
    setLoading(true);
    pipelineProgress.start();
    try {
      const res = await fetch(demo.image);
      if (!res.ok) throw new Error(`HTTP ${res.status} loading ${demo.image}`);
      const blob = await res.blob();
      const sampleFile = new File([blob], `${demo.id}_dataset_dermoscopy.jpg`, { type: 'image/jpeg' });
      setPreview(demo.image);
      setFile(sampleFile);

      const analysisRes = await predictSkinCancer(sampleFile);
      pipelineProgress.transition('awaiting_review');
      if (onNavigateToDiagnosticReport) {
        onNavigateToDiagnosticReport({
          result: analysisRes,
          title: 'Dermoscopic Skin Cancer Assessment (HAM10000)',
          diseaseKey: 'skin-cancer',
          sourceTab: 'skin-cancer',
          inputs: {
            source_filename: sampleFile.name,
            demo_id: demo.id,
            file: sampleFile,
            image_preview: demo.image,
            image_url: demo.image,
            preview: demo.image,
          },
          image: demo.image,
          preview: demo.image,
          onWorkflowStageChange: pipelineProgress.handleWorkflowStageChange,
        });
      } else {
        setResult(analysisRes);
      }
    } catch (err) {
      const msg = 'Dermoscopic evaluation failed: ' + (err.message || err);
      setError(msg);
      pipelineProgress.fail(msg, 'prediction');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!file) {
      setError('Please upload a dermoscopic photograph or choose a reference clinical case.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    pipelineProgress.start();
    try {
      const res = await predictSkinCancer(file);
      pipelineProgress.transition('awaiting_review');
      if (onNavigateToDiagnosticReport) {
        onNavigateToDiagnosticReport({
          result: res,
          title: 'Dermoscopic Skin Cancer Assessment (HAM10000)',
          diseaseKey: 'skin-cancer',
          sourceTab: 'skin-cancer',
          inputs: {
            source_filename: file.name,
            file: file,
            previewUrl: preview,
            image_preview: preview,
            image_url: preview,
            preview: preview,
            demo_id: selectedDemo?.id,
          },
          image: preview,
          preview: preview,
          onWorkflowStageChange: pipelineProgress.handleWorkflowStageChange,
        });
      } else {
        setResult(res);
      }
    } catch (err) {
      const msg = err.message || 'Dermoscopic lesion evaluation failed';
      setError(msg);
      pipelineProgress.fail(msg, 'prediction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ClinicalPipelineProgressModal
        isOpen={pipelineProgress.isOpen}
        moduleName="SKIN CANCER & LESIONS (HAM10000)"
        modality="imaging"
        stage={pipelineProgress.stage}
        error={pipelineProgress.error}
        failedAt={pipelineProgress.failedAt}
        onClose={pipelineProgress.close}
        onDownloadMLReport={handleDownloadMLReportFromModal}
        onGenerateLLMReport={handleGenerateLLMReportFromModal}
      />
      
      {/* Top Navigation Bar with Back Button */}
      <ModuleTopBar
        setTab={setTab}
        title="Skin Cancer & Cutaneous Lesion Classifier"
        moduleCode="M8"
        icon={AlertTriangle}
        iconColor="#dc2626"
      />

      {/* Header Banner */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <AlertTriangle size={13} /> Module M8 • Dermatology & Cutaneous Oncology
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Deep 4-Block Hierarchical CNN • 97.98% Test Accuracy (HAM10000)
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b1b1b', margin: 0 }}>
          Skin Cancer & Cutaneous Lesion Classifier
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '850px', fontSize: '0.92rem' }}>
          Automated multi-class dermoscopic screening system across 7 clinical entities including <strong>Melanoma</strong>, <strong>Basal Cell Carcinoma</strong>, <strong>Actinic Keratoses</strong>, and benign lesions.
        </p>
      </div>

      {/* Upload & Preset Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 0.8fr)', gap: '1.5rem' }}>
        
        {/* Upload Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Upload Dermoscopic Lesion Photograph
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 14px 0' }}>
              Accepts high-resolution close-up epiluminescence and standard dermoscopic images.
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
                Click to browse or drop skin lesion image here
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                JPEG or PNG dermoscopic photograph
              </div>
            </div>

            {preview && (
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px' }}>
                <img src={preview} alt="Lesion Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file?.name || 'Selected Dermoscopic Photograph'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Status: Standardized for HAM10000 4-Block CNN
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
              style={{ padding: '10px 20px' }}
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
              <span>{loading ? 'Evaluating Cutaneous Lesion…' : 'Run 7-Class Skin Cancer Screening'}</span>
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
            <Sparkles size={16} color="#e11d48" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Instant Reference Dermoscopic Cases
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 12px 0' }}>
            Select verified reference dermoscopic lesions for immediate 1-click evaluation:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SKIN_DEMOS.map((demo) => {
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
                      background: demo.malignant ? '#fef2f2' : '#f0fdf4',
                      color: demo.malignant ? '#b91c1c' : '#15803d'
                    }}>
                      {demo.tier}
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
      {result && (!onNavigateToDiagnosticReport ? (
        <DiagnosticResultCard 
          result={result} 
          title="Dermoscopic Skin Cancer Assessment (HAM10000)"
          diseaseKey="skin-cancer"
          inputs={{
            source_filename: file?.name || 'dermoscopy_image.jpg',
            file: file,
            previewUrl: preview,
            image_preview: preview,
            image_url: preview,
            preview: preview,
            demo_id: selectedDemo?.id,
          }}
          image={preview}
          onReset={() => { setResult(null); setFile(null); setPreview(null); setSelectedDemo(null); }}
          onNavigateToLLMReport={onNavigateToLLMReport}
        />
      ) : (
        <div style={{
          padding: '1rem 1.25rem',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} color="#15803d" />
            <div>
              <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.92rem' }}>
                Active Dermoscopic Assessment Available
              </div>
              <div style={{ fontSize: '0.8rem', color: '#166534' }}>
                7-class HAM10000 lesion evaluation and Grad-CAM visualizations are open on the dedicated report route.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {onNavigateToLLMReport && (
              <button
                type="button"
                onClick={handleGenerateLLMReportFromModal}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4', fontWeight: 700 }}
              >
                <Sparkles size={14} color="#0d9488" />
                <span>Generate Report via LLM →</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateToDiagnosticReport({
                result,
                title: 'Dermoscopic Skin Cancer Assessment (HAM10000)',
                diseaseKey: 'skin-cancer',
                sourceTab: 'skin-cancer',
                inputs: { source_filename: file?.name || 'dermoscopy_image.jpg' },
                onWorkflowStageChange: pipelineProgress.handleWorkflowStageChange,
              })}
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.82rem' }}
            >
              Open Dedicated Diagnostic Report →
            </button>
          </div>
        </div>
      ))}

    </div>
  );
}
