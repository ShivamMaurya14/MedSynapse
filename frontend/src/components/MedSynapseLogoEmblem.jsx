import React from 'react';
import { Activity } from 'lucide-react';

export default function MedSynapseLogoEmblem({ size = 120, showText = true, scale = 1, opacity = 1 }) {
  return (
    <div 
      className="medsynapse-hero-emblem"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale})`,
        opacity: opacity,
        transition: 'transform 0.05s ease-out, opacity 0.05s ease-out',
        willChange: 'transform, opacity, filter',
        pointerEvents: opacity < 0.1 ? 'none' : 'auto',
        userSelect: 'none',
        textAlign: 'center'
      }}
    >
      {/* Ambient Radial Glow behind the emblem */}
      <div 
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: showText ? '1.75rem' : 0
        }}
      >
        <div 
          className="emblem-ambient-glow"
          style={{
            position: 'absolute',
            width: size * 1.8,
            height: size * 1.8,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(5, 150, 105, 0.12) 45%, transparent 70%)',
            filter: 'blur(28px)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />

        {/* Outer Pulsing Concentric Rings */}
        <div 
          className="emblem-outer-ring"
          style={{
            position: 'absolute',
            width: size * 1.35,
            height: size * 1.35,
            borderRadius: size * 0.42,
            border: '1.5px solid rgba(16, 185, 129, 0.25)',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.15)',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />

        {/* Core Squircle Icon Badge */}
        <div 
          className="emblem-core-badge"
          style={{
            position: 'relative',
            zIndex: 2,
            width: size,
            height: size,
            borderRadius: size * 0.28,
            background: 'linear-gradient(135deg, #090d16 0%, #0f172a 45%, #1e293b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.35), 0 0 28px rgba(16, 185, 129, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
            border: '2px solid rgba(255, 255, 255, 0.18)',
            overflow: 'hidden'
          }}
        >
          {/* Subtle Internal Specular Highlight & Synapse Web Grid */}
          <svg 
            width={size} 
            height={size} 
            viewBox="0 0 120 120" 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <defs>
              <linearGradient id="emblemSpec" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                <stop offset="40%" stopColor="#ffffff" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="synapsePulse" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>

            {/* Specular Diagonal Reflection */}
            <rect width="120" height="120" fill="url(#emblemSpec)" />

            {/* Neural Synapse Nodes and Connecting Axons */}
            <circle cx="28" cy="32" r="3" fill="#10b981" opacity="0.6" />
            <circle cx="92" cy="28" r="2.5" fill="#34d399" opacity="0.5" />
            <circle cx="24" cy="88" r="2.5" fill="#10b981" opacity="0.4" />
            <circle cx="96" cy="84" r="3" fill="#059669" opacity="0.5" />

            {/* Delicate Connecting Synaptic Threads */}
            <path d="M 28 32 Q 50 45 60 60" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" fill="none" />
            <path d="M 92 28 Q 75 42 60 60" stroke="#34d399" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" fill="none" />
            <path d="M 24 88 Q 45 75 60 60" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" fill="none" />
            <path d="M 96 84 Q 78 72 60 60" stroke="#059669" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" fill="none" />
          </svg>

          {/* Central Vital Activity ECG Line with Glowing Stroke */}
          <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity 
              size={Math.round(size * 0.54)} 
              color="#10b981" 
              strokeWidth={2.8}
              style={{
                filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.75))'
              }}
            />
          </div>
        </div>
      </div>

      {showText && (
        <div style={{ maxWidth: '780px', padding: '0 1rem' }}>
          {/* Version / Category Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '0.9rem' }}>
            <span 
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                padding: '5px 14px',
                borderRadius: '9999px',
                background: 'rgba(15, 23, 42, 0.06)',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                color: '#0f172a',
                backdropFilter: 'blur(8px)'
              }}
            >
              MedSynapse • Clinical Diagnostic Intelligence
            </span>
          </div>

          {/* Massive Apple-Grade Brand Title */}
          <h1 
            style={{
              fontSize: 'clamp(2.8rem, 6.2vw, 4.6rem)',
              fontWeight: 900,
              letterSpacing: '-1.8px',
              lineHeight: 1.08,
              margin: '0 0 1rem 0',
              color: '#0f172a'
            }}
          >
            Med<span 
              style={{
                background: 'linear-gradient(135deg, #15803d 0%, #10b981 40%, #059669 80%, #047857 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: '#10b981'
              }}
            >
              Synapse
            </span>
          </h1>

          {/* Subheading / Clinical Mission */}
          <p 
            style={{
              fontSize: 'clamp(1.05rem, 2.1vw, 1.35rem)',
              color: '#334155',
              lineHeight: 1.5,
              fontWeight: 500,
              maxWidth: '680px',
              margin: '0 auto 1.5rem auto'
            }}
          >
            Unified Multi-Modal Clinical Intelligence Framework.
            <br />
            <span style={{ color: '#64748b', fontSize: '0.95em' }}>
              Bridging 9 deep diagnostic disease networks, automated lab OCR, and fused SHAP explainability into a single synchronized workflow.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
