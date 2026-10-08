import React from 'react';
import { Droplets, Heart, Scan, Eye, Ribbon, FileText, ArrowRight, Shield, Cpu, Zap } from 'lucide-react';

export default function DashboardHome({ setTab, onSelectSample }) {
  const modules = [
    {
      id: 'diabetes',
      title: 'Diabetes Risk Engine',
      category: 'Metabolic & Endocrinology',
      desc: 'Predict diabetic risk and glycemic irregularities using Voting Classifier ensemble with BMI classification.',
      badge: '98% Cross-Val Acc',
      badgeColor: 'badge-danger',
      icon: Droplets,
      iconColor: '#b42318',
      gradient: '#f5faf6',
      borderColor: '#bcd8c3',
      keyInputs: 'Glucose, Insulin, BMI, Blood Pressure, Age'
    },
    {
      id: 'heart',
      title: 'Coronary Heart Health',
      category: 'Cardiovascular Risk',
      desc: 'Assess coronary arterial risk using 13 clinical biomarkers, exercise ECG metrics, and lipid profiles.',
      badge: 'Multi-Feature Scaled',
      badgeColor: 'badge-warning',
      icon: Heart,
      iconColor: '#c81e1e',
      gradient: '#f5faf6',
      borderColor: '#bcd8c3',
      keyInputs: 'Resting BP, Cholesterol, Max HR, Angina, ST Depression'
    },
    {
      id: 'xray',
      title: 'Pneumonia X-Ray Vision',
      category: 'Pulmonary Imaging',
      desc: 'Deep Convolutional Neural Network for rapid detection of acute bacterial and viral pneumonia infiltrates.',
      badge: 'Deep CNN Vision',
      badgeColor: 'badge-cyan',
      icon: Scan,
      iconColor: '#287a89',
      gradient: '#f5faf6',
      borderColor: '#bcd8c3',
      keyInputs: 'Chest Radiograph (JPEG, PNG, DICOM-derived)'
    },
    {
      id: 'eye',
      title: 'Eye Disease Analyzer',
      category: 'Ophthalmic Imaging',
      desc: 'Integration workspace for a future fundus or ocular image classifier.',
      badge: 'Model Slot',
      badgeColor: 'badge-purple',
      icon: Eye,
      iconColor: '#6b46c1',
      gradient: '#f5faf6',
      borderColor: '#bcd8c3',
      keyInputs: 'Fundus or ocular image'
    },
    {
      id: 'breast',
      title: 'Breast Cancer Analyzer',
      category: 'Breast Imaging',
      desc: 'Integration workspace for a future mammogram or breast-image classifier.',
      badge: 'Model Slot',
      badgeColor: 'badge-purple',
      icon: Ribbon,
      iconColor: '#b83280',
      gradient: '#f5faf6',
      borderColor: '#bcd8c3',
      keyInputs: 'Mammogram or breast scan'
    }
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Hero Banner */}
      <div 
        className="glass-panel glass-panel-glow" 
        style={{
          padding: '2.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '780px' }}>
          <h1 style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.15, color: '#1b1b1b', letterSpacing: '-1px' }}>
            Clinical AI Precision for <span>Multi-Disease Screening</span>
          </h1>

          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: 1.6 }}>
            Upload patient laboratory reports (PDF/images) or scan images. Our intelligent OCR parser extracts clinical parameters automatically and executes ML inference in seconds.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setTab('ocr')} 
              className="btn-primary"
              style={{ padding: '12px 24px', fontSize: '1rem' }}
            >
              <FileText size={18} />
              <span>Smart Lab Report OCR</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>3 Models</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Multi-Modal AI Ensemble</div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>Instant OCR</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PDF & Image Lab Reports</div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f43f5e', fontFamily: 'var(--font-mono)' }}>13+ Biomarkers</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-Extracted Parameters</div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#c084fc', fontFamily: 'var(--font-mono)' }}>Clinical PDF</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>One-Click Diagnostic Export</div>
          </div>
        </div>
      </div>

      {/* Disease Selection Cards */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>Select Diagnostic Workspace</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Choose a disease module to enter clinical parameters or upload diagnostic scans</p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem'
        }}>
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className="glass-panel"
                onClick={() => setTab(mod.id)}
                style={{
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: mod.gradient,
                  border: `1px solid ${mod.borderColor}`,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${mod.borderColor}`
                    }}>
                      <Icon size={24} color={mod.iconColor} />
                    </div>
                    <span className={`badge ${mod.badgeColor}`}>{mod.badge}</span>
                  </div>

                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {mod.category}
                  </span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginTop: '2px', marginBottom: '0.5rem' }}>
                    {mod.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
                    {mod.desc}
                  </p>
                </div>

                <div>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginBottom: '1rem'
                  }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Inputs:</strong> {mod.keyInputs}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: mod.iconColor, fontWeight: 600, fontSize: '0.9rem' }}>
                    <span>Launch Diagnosis</span>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Featured OCR Workflow Banner */}
      <div 
        className="glass-panel"
        style={{
          padding: '1.75rem',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(168, 85, 247, 0.1))',
          border: '1px solid rgba(14, 165, 233, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ maxWidth: '650px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <FileText size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
              Have a Lab Report or Clinical Document?
            </h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Upload your medical report PDF or lab picture. The OCR engine reads glucose, lipid profile, blood pressure, BMI, and auto-fills the diagnostic models for immediate evaluation.
          </p>
        </div>

        <button 
          onClick={() => setTab('ocr')} 
          className="btn-primary"
          style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}
        >
          <Zap size={16} /> Open OCR Studio
        </button>
      </div>
    </div>
  );
}
