import React, { useState, useEffect } from 'react';
import { Activity, Droplet, Sparkles, RefreshCw, FileText, CheckCircle2, AlertCircle, FileDown, ArrowRight } from 'lucide-react';
import { predictLiverDisease } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';
import ClinicalPipelineProgressModal from './ClinicalPipelineProgressModal';
import useClinicalPipelineProgress from '../hooks/useClinicalPipelineProgress';
import { printReportDocument } from '../utils/printReport';
import ModuleTopBar from './ModuleTopBar';

const LIVER_PRESETS = [
  {
    id: 'healthy',
    title: 'Healthy Liver Profile',
    desc: 'Bilirubin, transaminases, and synthetic proteins in optimal reference ranges.',
    values: {
      age: 34,
      gender: 'Male',
      total_bilirubin: 0.7,
      direct_bilirubin: 0.2,
      alkaline_phosphotase: 95,
      alamine_aminotransferase: 24,
      aspartate_aminotransferase: 22,
      total_protiens: 7.2,
      albumin: 4.2,
      ag_ratio: 1.4
    }
  },
  {
    id: 'hepatocellular',
    title: 'Acute Hepatocellular Injury',
    desc: 'Marked transaminase elevation (ALT/AST > 180 IU/L) with moderate hyperbilirubinemia.',
    values: {
      age: 48,
      gender: 'Male',
      total_bilirubin: 2.8,
      direct_bilirubin: 1.2,
      alkaline_phosphotase: 190,
      alamine_aminotransferase: 240,
      aspartate_aminotransferase: 185,
      total_protiens: 6.5,
      albumin: 3.3,
      ag_ratio: 1.0
    }
  },
  {
    id: 'cholestatic',
    title: 'Cholestatic / Biliary Obstruction',
    desc: 'Severe alkaline phosphatase elevation (ALP > 350 IU/L) with conjugated direct bilirubin.',
    values: {
      age: 56,
      gender: 'Female',
      total_bilirubin: 3.9,
      direct_bilirubin: 2.1,
      alkaline_phosphotase: 420,
      alamine_aminotransferase: 68,
      aspartate_aminotransferase: 74,
      total_protiens: 6.8,
      albumin: 3.6,
      ag_ratio: 1.1
    }
  },
  {
    id: 'cirrhotic',
    title: 'Cirrhotic / Decompensated Liver',
    desc: 'Hypoalbuminemia with inverted A/G ratio (< 0.8) and marked jaundice.',
    values: {
      age: 62,
      gender: 'Male',
      total_bilirubin: 4.5,
      direct_bilirubin: 2.4,
      alkaline_phosphotase: 280,
      alamine_aminotransferase: 95,
      aspartate_aminotransferase: 110,
      total_protiens: 5.4,
      albumin: 2.3,
      ag_ratio: 0.7
    }
  }
];

export default function LiverDiseaseView({ setTab, initialData, onNavigateToLLMReport, onNavigateToDiagnosticReport }) {
  const [formData, setFormData] = useState({
    age: initialData?.Age ?? initialData?.age ?? 45,
    gender: initialData?.Gender ?? (initialData?.gender === 0 || initialData?.gender === 'Male' ? 'Male' : initialData?.gender === 1 || initialData?.gender === 'Female' ? 'Female' : 'Male'),
    total_bilirubin: initialData?.Total_Bilirubin ?? initialData?.total_bilirubin ?? 0.8,
    direct_bilirubin: initialData?.Direct_Bilirubin ?? initialData?.direct_bilirubin ?? 0.2,
    alkaline_phosphotase: initialData?.Alkaline_Phosphotase ?? initialData?.alkaline_phosphotase ?? 120,
    alamine_aminotransferase: initialData?.Alamine_Aminotransferase ?? initialData?.alamine_aminotransferase ?? 28,
    aspartate_aminotransferase: initialData?.Aspartate_Aminotransferase ?? initialData?.aspartate_aminotransferase ?? 25,
    total_protiens: initialData?.Total_Protiens ?? initialData?.total_protiens ?? 7.0,
    albumin: initialData?.Albumin ?? initialData?.albumin ?? 4.0,
    ag_ratio: initialData?.Albumin_and_Globulin_Ratio ?? initialData?.albumin_and_globulin_ratio ?? initialData?.ag_ratio ?? 1.3
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        age: initialData?.Age ?? initialData?.age ?? prev.age,
        gender: initialData?.Gender ?? (initialData?.gender === 0 || initialData?.gender === 'Male' ? 'Male' : initialData?.gender === 1 || initialData?.gender === 'Female' ? 'Female' : prev.gender),
        total_bilirubin: initialData?.Total_Bilirubin ?? initialData?.total_bilirubin ?? prev.total_bilirubin,
        direct_bilirubin: initialData?.Direct_Bilirubin ?? initialData?.direct_bilirubin ?? prev.direct_bilirubin,
        alkaline_phosphotase: initialData?.Alkaline_Phosphotase ?? initialData?.alkaline_phosphotase ?? prev.alkaline_phosphotase,
        alamine_aminotransferase: initialData?.Alamine_Aminotransferase ?? initialData?.alamine_aminotransferase ?? prev.alamine_aminotransferase,
        aspartate_aminotransferase: initialData?.Aspartate_Aminotransferase ?? initialData?.aspartate_aminotransferase ?? prev.aspartate_aminotransferase,
        total_protiens: initialData?.Total_Protiens ?? initialData?.total_protiens ?? prev.total_protiens,
        albumin: initialData?.Albumin ?? initialData?.albumin ?? prev.albumin,
        ag_ratio: initialData?.Albumin_and_Globulin_Ratio ?? initialData?.albumin_and_globulin_ratio ?? initialData?.ag_ratio ?? prev.ag_ratio,
      }));
    }
  }, [initialData]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const pipelineProgress = useClinicalPipelineProgress();

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDownloadMLReportFromModal = () => {
    printReportDocument('.clinical-report-sheet', 'MedSynapse_Liver_Disease_Report');
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
      diseaseKey: 'liver',
      prediction: {
        ...(result?.data || result || {}),
        reviewed_by: docName,
      },
      inputs: formData,
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

  const applyPreset = async (preset) => {
    setFormData(preset.values);
    setError(null);
    setResult(null);
    setLoading(true);
    pipelineProgress.start();
    try {
      const payload = {
        ...preset.values,
        age: Number(preset.values.age),
        total_bilirubin: Number(preset.values.total_bilirubin),
        direct_bilirubin: Number(preset.values.direct_bilirubin),
        alkaline_phosphotase: Number(preset.values.alkaline_phosphotase),
        alamine_aminotransferase: Number(preset.values.alamine_aminotransferase),
        aspartate_aminotransferase: Number(preset.values.aspartate_aminotransferase),
        total_protiens: Number(preset.values.total_protiens),
        albumin: Number(preset.values.albumin),
        ag_ratio: Number(preset.values.ag_ratio)
      };
      const res = await predictLiverDisease(payload);
      pipelineProgress.transition('awaiting_review');
      if (onNavigateToDiagnosticReport) {
        onNavigateToDiagnosticReport({
          result: res,
          title: 'Hepatic Function & ILPD Risk Assessment',
          diseaseKey: 'liver',
          sourceTab: 'liver',
          inputs: preset.values,
          onWorkflowStageChange: pipelineProgress.handleWorkflowStageChange,
        });
      } else {
        setResult(res);
      }
    } catch (err) {
      const msg = err.message || 'Liver profile evaluation failed';
      setError(msg);
      pipelineProgress.fail(msg, 'prediction');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    pipelineProgress.start();
    try {
      const payload = {
        ...formData,
        age: Number(formData.age),
        total_bilirubin: Number(formData.total_bilirubin),
        direct_bilirubin: Number(formData.direct_bilirubin),
        alkaline_phosphotase: Number(formData.alkaline_phosphotase),
        alamine_aminotransferase: Number(formData.alamine_aminotransferase),
        aspartate_aminotransferase: Number(formData.aspartate_aminotransferase),
        total_protiens: Number(formData.total_protiens),
        albumin: Number(formData.albumin),
        ag_ratio: Number(formData.ag_ratio)
      };
      const res = await predictLiverDisease(payload);
      pipelineProgress.transition('awaiting_review');
      if (onNavigateToDiagnosticReport) {
        onNavigateToDiagnosticReport({
          result: res,
          title: 'Hepatic Function & ILPD Risk Assessment',
          diseaseKey: 'liver',
          sourceTab: 'liver',
          inputs: formData,
          onWorkflowStageChange: pipelineProgress.handleWorkflowStageChange,
        });
      } else {
        setResult(res);
      }
    } catch (err) {
      const msg = err.message || 'Liver screening evaluation failed';
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
        moduleName="LIVER DISEASE SCREENING (ILPD)"
        modality="tabular"
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
        title="Liver Disease Screening Engine (ILPD)"
        moduleCode="M6"
        icon={Activity}
        iconColor="#d97706"
      />

      {/* Header Banner */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={13} /> Module M6 • Hepatology
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            ILPD Random Forest & GBDT Ensemble • 79.49% Benchmark Accuracy
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b1b1b', margin: 0 }}>
          Liver Disease Screening Engine (ILPD)
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '850px', fontSize: '0.92rem' }}>
          Evaluates multi-analyte Liver Function Test (LFT) panels—including hepatocellular transaminases (ALT/AST), cholestatic enzymes (ALP), serum bilirubin, and synthetic proteins—to stratify hepatic impairment risk.
        </p>
      </div>

      {/* Preset Selector */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Sparkles size={16} color="#d97706" />
          <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
            Load Verified LFT Clinical Profiles:
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
          {LIVER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="btn-secondary"
              onClick={() => applyPreset(preset)}
              style={{
                textAlign: 'left',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                background: '#ffffff',
                border: '1px solid #e2e8f0'
              }}
            >
              <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{preset.title}</strong>
              <small style={{ fontSize: '0.72rem', color: '#64748b' }}>{preset.desc}</small>
            </button>
          ))}
        </div>
      </div>

      {/* Main LFT Form */}
      <form className="glass-panel" onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
            Patient Liver Function Test (LFT) Biomarkers
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            10 Quantitative Clinical Parameters
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          
          <div className="form-group">
            <label className="form-label">Patient Age (Years)</label>
            <input 
              className="form-input" 
              type="number" 
              step="any"
              value={formData.age} 
              onChange={(e) => handleChange('age', e.target.value)} 
              min="1" max="110" required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Biological Sex</label>
            <select 
              className="form-input" 
              value={formData.gender} 
              onChange={(e) => handleChange('gender', e.target.value)}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Total Bilirubin (mg/dL)</label>
            <input 
              className="form-input" 
              type="number" 
              step="any" 
              value={formData.total_bilirubin} 
              onChange={(e) => handleChange('total_bilirubin', e.target.value)} 
              required 
            />
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Normal: 0.1 – 1.2 mg/dL</small>
          </div>

          <div className="form-group">
            <label className="form-label">Direct Bilirubin (mg/dL)</label>
            <input 
              className="form-input" 
              type="number" 
              step="any" 
              value={formData.direct_bilirubin} 
              onChange={(e) => handleChange('direct_bilirubin', e.target.value)} 
              required 
            />
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Normal: 0.0 – 0.3 mg/dL</small>
          </div>

          <div className="form-group">
            <label className="form-label">Alkaline Phosphatase (ALP) (IU/L)</label>
            <input 
              className="form-input" 
              type="number" 
              step="any"
              value={formData.alkaline_phosphotase} 
              onChange={(e) => handleChange('alkaline_phosphotase', e.target.value)} 
              required 
            />
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Normal: 44 – 147 IU/L</small>
          </div>

          <div className="form-group">
            <label className="form-label">ALT / SGPT (IU/L)</label>
            <input 
              className="form-input" 
              type="number" 
              step="any"
              value={formData.alamine_aminotransferase} 
              onChange={(e) => handleChange('alamine_aminotransferase', e.target.value)} 
              required 
            />
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Normal: 7 – 56 IU/L</small>
          </div>

          <div className="form-group">
            <label className="form-label">AST / SGOT (IU/L)</label>
            <input 
              className="form-input" 
              type="number" 
              step="any"
              value={formData.aspartate_aminotransferase} 
              onChange={(e) => handleChange('aspartate_aminotransferase', e.target.value)} 
              required 
            />
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Normal: 10 – 40 IU/L</small>
          </div>

          <div className="form-group">
            <label className="form-label">Total Proteins (g/dL)</label>
            <input 
              className="form-input" 
              type="number" 
              step="any" 
              value={formData.total_protiens} 
              onChange={(e) => handleChange('total_protiens', e.target.value)} 
              required 
            />
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Normal: 6.0 – 8.3 g/dL</small>
          </div>

          <div className="form-group">
            <label className="form-label">Serum Albumin (g/dL)</label>
            <input 
              className="form-input" 
              type="number" 
              step="any" 
              value={formData.albumin} 
              onChange={(e) => handleChange('albumin', e.target.value)} 
              required 
            />
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Normal: 3.5 – 5.0 g/dL</small>
          </div>

          <div className="form-group">
            <label className="form-label">Albumin / Globulin (A/G) Ratio</label>
            <input 
              className="form-input" 
              type="number" 
              step="any" 
              value={formData.ag_ratio} 
              onChange={(e) => handleChange('ag_ratio', e.target.value)} 
              required 
            />
            <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Normal: 1.0 – 2.2</small>
          </div>

        </div>

        {error && (
          <div style={{ marginTop: '1rem', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ padding: '10px 20px' }}
          >
            {loading ? 'Evaluating LFT Panel…' : 'Run Liver Disease Risk Screening'}
          </button>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => setTab?.('ocr')}
          >
            <FileText size={15} /> Upload LFT Report via OCR
          </button>
        </div>
      </form>

      {/* Result Display */}
      {result && (!onNavigateToDiagnosticReport ? (
        <DiagnosticResultCard 
          result={result} 
          title="Hepatic Function & ILPD Risk Assessment"
          diseaseKey="liver"
          inputs={formData}
          onReset={() => setResult(null)}
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
            <Activity size={20} color="#15803d" />
            <div>
              <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.92rem' }}>
                Active Liver Disease Assessment Available
              </div>
              <div style={{ fontSize: '0.8rem', color: '#166534' }}>
                ILPD hepatic panel evaluation and SHAP analysis are open on the dedicated report route.
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
                title: 'Hepatic Function & ILPD Risk Assessment',
                diseaseKey: 'liver',
                sourceTab: 'liver',
                inputs: formData,
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
