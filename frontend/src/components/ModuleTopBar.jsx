import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function ModuleTopBar({
  setTab,
  onBack,
  title,
  moduleCode,
  icon: Icon,
  iconColor,
  rightContent
}) {
  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
    } else if (typeof setTab === 'function') {
      setTab('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '0.85rem 1.25rem',
      borderRadius: '12px',
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleBack}
          className="btn-secondary"
          style={{
            padding: '6px 14px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#94a3b8' }}>/</span>
            <span style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {Icon && <Icon size={16} color={iconColor || '#059669'} />}
              {moduleCode && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '6px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569'
                }}>
                  {moduleCode}
                </span>
              )}
              <span>{title}</span>
            </span>
          </div>
        )}
      </div>

      {rightContent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rightContent}
        </div>
      )}
    </div>
  );
}
