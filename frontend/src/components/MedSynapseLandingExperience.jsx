import React, { useRef } from 'react';
import MedSynapseLogoEmblem from './MedSynapseLogoEmblem';
import DashboardHome from './DashboardHome';
import { 
  Brain, 
  FileText, 
  Activity, 
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Award,
  Layers
} from 'lucide-react';

export default function MedSynapseLandingExperience({ setTab }) {
  const dashboardRef = useRef(null);

  const dynamicFeatures = [
    {
      icon: Brain,
      color: '#7c3aed',
      badge: '99.25% Peak Acc',
      badgeBg: 'rgba(124, 58, 237, 0.08)',
      badgeBorder: 'rgba(124, 58, 237, 0.25)',
      title: '9 Diagnostic AI Modules',
      category: 'Multi-Specialty ML & Vision',
      desc: 'Unifies 9 specialized high-precision diagnostic backbones spanning metabolic, cardiovascular, pulmonary, neuro-oncological, cytopathological, hepatic, nephrological, dermatological, and ophthalmic domains.',
      bullets: [
        'Multi-Modal: Clinical blood panels & radiological DICOM/JPEG scans',
        '70% measured reduction in preliminary screening latency',
        'Continuous calibration against clinical threshold baselines'
      ],
      tags: ['MobileNetV2', 'ResNet-18', 'Xception', 'Voting Ensemble']
    },
    {
      icon: FileText,
      color: '#0284c7',
      badge: 'Tesseract 5 + PyMuPDF',
      badgeBg: 'rgba(2, 132, 199, 0.08)',
      badgeBorder: 'rgba(2, 132, 199, 0.25)',
      title: 'Automated Lab Report OCR',
      category: 'Document Intelligence',
      desc: 'End-to-end automated optical ingestion extracting multi-analyte lab panels, lipid profiles, blood pressure, transaminases (ALT/AST), and cytology parameters directly from raw patient PDFs and photos.',
      bullets: [
        'Zero manual transcription overhead or entry errors',
        'Automated regex biomarker entity extraction & unit normalization',
        'One-click multi-model population from a single document'
      ],
      tags: ['Auto-Extraction', 'Bio-Matching', 'PDF & Scan Parser']
    },
    {
      icon: Sparkles,
      color: '#059669',
      badge: 'Dual Fused XAI',
      badgeBg: 'rgba(5, 150, 105, 0.08)',
      badgeBorder: 'rgba(5, 150, 105, 0.25)',
      title: 'SHAP & Grad-CAM++ Explainability',
      category: 'Transparent Decision Support',
      desc: 'Solves the clinical "black-box" dilemma via dual-modality interpretability: game-theoretic SHAP feature attributions for tabular biomarkers paired with Grad-CAM++ neural activation heatmaps for imaging.',
      bullets: [
        'Anatomical lesion localization (infiltrates, tumors, stones, retinal lesions)',
        'Quantified biomarker delta contributions vs healthy population norms',
        'Full clinician-auditable reasoning for every diagnostic prediction'
      ],
      tags: ['SHAP Attributions', 'Grad-CAM++ Heatmaps', 'Zero Black-Box']
    },
    {
      icon: Activity,
      color: '#b42318',
      badge: 'Clinician-in-the-Loop',
      badgeBg: 'rgba(180, 35, 24, 0.08)',
      badgeBorder: 'rgba(180, 35, 24, 0.25)',
      title: 'Real-Time Differential & Audit',
      category: 'Decision Oversight & Reports',
      desc: 'Real-time multi-disease differential assessment coupled with the Clinician Decision Tweak Center—empowering physicians to inspect risk tiers, calibrate decision thresholds, and attach validated clinical rationales.',
      bullets: [
        'Comprehensive cross-comorbidity risk correlation (e.g. Diabetes & Retinopathy)',
        'Physician override logging with full tamper-evident audit trail',
        'Automated publication-grade A4 clinical diagnostic PDF generation'
      ],
      tags: ['Decision Tweak Center', 'A4 PDF Report', 'Cross-Comorbidity']
    }
  ];

  return (
    <div 
      className="medsynapse-landing-wrapper"
      style={{
        backgroundColor: '#f8fafc',
        backgroundImage: `
          radial-gradient(circle at 50% 8%, rgba(16, 185, 129, 0.09) 0%, transparent 50%),
          radial-gradient(circle at 85% 38%, rgba(14, 165, 233, 0.07) 0%, transparent 45%),
          radial-gradient(circle at 15% 68%, rgba(16, 185, 129, 0.06) 0%, transparent 45%)
        `,
        overflow: 'visible'
      }}
    >
      {/* PAGE 1: The Centered MedSynapse Logo Emblem Hero */}
      <section 
        id="page-1"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 1.5rem',
          position: 'relative'
        }}
      >
        <MedSynapseLogoEmblem size={145} scale={1} opacity={1} />
      </section>

      {/* PAGE 2: Dynamic Capability Cards (Engineered for Clinical Trust & Transparency) */}
      <section 
        id="page-2"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5rem 1.5rem 6rem 1.5rem',
          position: 'relative'
        }}
      >
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '840px', marginBottom: '2.75rem', padding: '0 1rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 14px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            marginBottom: '0.85rem'
          }}>
            <ShieldCheck size={14} color="#059669" />
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.8px',
              color: '#047857',
              textTransform: 'uppercase'
            }}>
              Core Architectural Pillars & Research Innovations
            </span>
          </div>

          <h2 style={{
            fontSize: 'clamp(2rem, 3.8vw, 2.75rem)',
            fontWeight: 900,
            color: '#0f172a',
            letterSpacing: '-0.8px',
            lineHeight: 1.2,
            margin: '0 0 0.85rem 0'
          }}>
            Engineered for Clinical Trust, Transparency & Speed
          </h2>

          <p style={{
            fontSize: '1rem',
            color: '#475569',
            lineHeight: 1.6,
            margin: 0
          }}>
            MedSynapse resolves the medical &quot;black-box&quot; dilemma by uniting 9 specialized multi-modal diagnostic models under automated lab OCR, dual-engine explainability, and physician-in-the-loop decision safeguards.
          </p>
        </div>

        {/* 4 Feature Pillars Grid: Strict 2x2 on Desktop/Tablet, 1-col on Mobile */}
        <div className="capability-cards-grid">
          {dynamicFeatures.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                className="glass-panel"
                style={{
                  background: 'rgba(255, 255, 255, 0.94)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '1.75rem 1.5rem',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = item.color;
                  e.currentTarget.style.boxShadow = `0 16px 32px -8px ${item.color}22`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.03)';
                }}
              >
                <div>
                  {/* Top Bar: Icon + Category + Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: `${item.color}14`,
                      border: `1px solid ${item.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={24} color={item.color} strokeWidth={2.2} />
                    </div>

                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.4px',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      backgroundColor: item.badgeBg,
                      color: item.color,
                      border: `1px solid ${item.badgeBorder}`,
                      textTransform: 'uppercase'
                    }}>
                      {item.badge}
                    </span>
                  </div>

                  {/* Title & Category */}
                  <div>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {item.category}
                    </span>
                    <h3 style={{
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: '2px 0 0.5rem 0',
                      letterSpacing: '-0.3px',
                      lineHeight: 1.3
                    }}>
                      {item.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p style={{
                    fontSize: '0.84rem',
                    color: '#475569',
                    lineHeight: 1.55,
                    margin: '0 0 1rem 0'
                  }}>
                    {item.desc}
                  </p>

                  {/* Key Highlights Bullet List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1.25rem' }}>
                    {item.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <CheckCircle2 size={15} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ fontSize: '0.79rem', color: '#334155', lineHeight: 1.45, fontWeight: 500 }}>
                          {bullet}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technology Badges */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  {item.tags.map((tag, tIdx) => (
                    <span 
                      key={tIdx}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#475569',
                        background: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* High-Impact Clinical Research Stats Strip: 4-Col on Desktop, 2x2 on Tablet, 1-col on Mobile */}
        <div 
          className="capability-stats-grid"
          style={{
            padding: '1.5rem 1.75rem',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1.5px solid #cbd5e1',
            boxShadow: '0 8px 24px -6px rgba(15, 23, 42, 0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(5, 150, 105, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Award size={24} color="#059669" />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', lineHeight: 1.1 }}>
                99.25%
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                Peak Diagnostic Accuracy
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(124, 58, 237, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Layers size={24} color="#7c3aed" />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', lineHeight: 1.1 }}>
                9 Domains
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                Multi-Specialty ML & Vision
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(2, 132, 199, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Zap size={24} color="#0284c7" />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', lineHeight: 1.1 }}>
                70% Faster
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                Screening & Triage Latency
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(180, 35, 24, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldCheck size={24} color="#b42318" />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', lineHeight: 1.1 }}>
                100% Audited
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                Dual SHAP & CAM Oversight
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PAGE 3: The Clinical Workspace (DashboardHome: OCR Studio Banner at Top, All 9 Diseases Underneath) */}
      <section 
        id="page-3"
        ref={dashboardRef}
        style={{
          minHeight: '100vh',
          maxWidth: '1240px',
          width: '100%',
          margin: '0 auto',
          padding: '3rem 1.25rem 6rem 1.25rem',
          position: 'relative'
        }}
      >
        {/* Quick Breadcrumb/Anchor Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.75rem',
          padding: '0.65rem 0.5rem',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              MedSynapse Clinical Workspace Active
            </span>
          </div>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              fontSize: '0.75rem',
              color: '#64748b',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
          >
            ↑ Back to Top
          </button>
        </div>

        {/* DashboardHome: Contains "Have a Lab Report or Clinical PDF?" at top, followed by all 9 diseases */}
        <DashboardHome setTab={setTab} />
      </section>
    </div>
  );
}
