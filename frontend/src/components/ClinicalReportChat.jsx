import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  RotateCcw, 
  Bot, 
  User, 
  Loader2, 
} from 'lucide-react';
import { sendLlmChatMessage } from '../services/api';

export default function ClinicalReportChat({
  reportContext,
  onRegenerateReport,
  onReportUpdated,
  onMessagesChange,
  isGeneratingReport = false,
  layoutMode = 'split',
  chatWidthPreset = 'standard',
  onWidthPresetChange,
}) {
  const [messages, setMessages] = useState(() => {
    const rawDoctor = (
      reportContext?.doctorInfo?.name ||
      reportContext?.tweakedDecisions?.doctorInfo?.name ||
      reportContext?.reviewedBy ||
      reportContext?.clinicalReport?.clinician_review?.reviewed_by ||
      localStorage.getItem('medsynapse_doctor_name') ||
      'Doctor'
    ).trim();
    const doctorName = rawDoctor && !rawDoctor.toLowerCase().includes('reviewing clinician') ? rawDoctor : 'Doctor';
    const hasTweaks = Boolean(reportContext?.tweakedDecisions?.hasTweaks);
    const overridesCount = [
      reportContext?.tweakedDecisions?.diagnosis,
      reportContext?.tweakedDecisions?.riskProbability,
      reportContext?.tweakedDecisions?.riskTier,
      reportContext?.tweakedDecisions?.decisionThreshold,
      reportContext?.tweakedDecisions?.recommendations,
      reportContext?.tweakedDecisions?.inputTweaks,
    ].filter(Boolean).length;

    return [
      {
        role: 'assistant',
        content: `Hello ${doctorName}. I've loaded the active ML diagnostic evaluation for **${
          reportContext?.diseaseTitle || 'this patient'
        }** (${
          reportContext?.prediction?.risk_probability !== undefined
            ? `${Math.round(reportContext.prediction.risk_probability * 100)}% risk probability`
            : 'evaluated'
        }, **${reportContext?.prediction?.risk_tier || 'Risk Tier'}**).${
          hasTweaks
            ? `\n\n👨‍⚕️ **Clinician Overrides Active ([DONE BY DOCTOR])**: Detected ${overridesCount} attending physician adjustment(s) on file. I have ingested your clinical rationales and am primed to analyze this case strictly from your clinical perspective.`
            : ''
        }

You can edit report sections on the left and enter your clinical rationale, or chat with me to:
- 👨‍⚕️ **Analyze the case from your clinical point of view**
- ⚖️ **Contrast raw AI baseline vs. Doctor overrides** with pathophysiological reasoning
- 🧬 Explain biomarker attributions & SHAP values
- 📋 Refine clinical protocols & follow-up recommendations
- ✨ Synthesize an updated complete report incorporating all doctor tweaks`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('Groq API (openai/gpt-oss-120b)');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const content = (textToSend || input).trim();
    if (!content || loading) return;

    const userMsg = {
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await sendLlmChatMessage({
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        report_context: reportContext,
      });

      if (res.provider) {
        setProvider(res.provider);
      }

      const assistantMsg = {
        role: 'assistant',
        content: res.reply || 'Clinical response completed.',
        provider: res.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      if (onMessagesChange) {
        onMessagesChange(finalMessages);
      }

      // Automatically update and merge the clinical report after each LLM response
      if (res.updated_report && onReportUpdated) {
        onReportUpdated(res.updated_report);
      } else if (onRegenerateReport) {
        onRegenerateReport();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Note: Local LLM generation encountered an interruption: ${err.message}. Your recorded edits and reasons remain active and will be compiled into the report.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResetChat = () => {
    const initial = [
      {
        role: 'assistant',
        content: `Chat history cleared. Context for **${
          reportContext?.diseaseTitle || 'this patient'
        }** and your active tweaks are maintained. How can I assist with this report?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(initial);
    if (onMessagesChange) {
      onMessagesChange(initial);
    }
  };

  const quickPrompts = [
    "👨‍⚕️ Analyze this diagnostic case from the doctor's point of view",
    "⚖️ Compare raw AI baseline vs. Doctor's overrides & explain rationale",
    "🎯 Customize Actionable Recommendations & Follow-Up Protocol",
    "🧬 Explain biomarker attributions and SHAP decision drivers",
    "📋 Update Clinical Protocol per attending physician review",
    "📝 Refine Executive Screening Summary with clinical context",
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: layoutMode === 'chat' ? '800px' : '850px',
        background: '#ffffff',
        border: '1.5px solid #bae6fd',
        borderRadius: '10px',
        boxShadow: layoutMode === 'chat' ? '0 12px 35px -8px rgba(2, 132, 199, 0.18), 0 2px 8px rgba(15, 23, 42, 0.06)' : '0 4px 20px rgba(2, 132, 199, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Chat Header */}
      <div
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          color: '#0f172a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #bae6fd',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              background: '#ffffff',
              border: '1px solid #bae6fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.08)',
            }}
          >
            <Bot size={17} color="#0284c7" />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
              <span>MedSynapse Clinical Copilot</span>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                  display: 'inline-block',
                }}
              />
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1px' }}>
              <span>Provider: <strong style={{ color: '#0284c7' }}>{provider}</strong></span>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '1px 5px', borderRadius: '4px' }}>
                ⚡ Auto-Syncs Report
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {layoutMode === 'chat' && onWidthPresetChange && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#ffffff',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => onWidthPresetChange('compact')}
                title="520px - matches Split view right pane"
                style={{
                  background: chatWidthPreset === 'compact' ? '#0284c7' : 'transparent',
                  color: chatWidthPreset === 'compact' ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                520px
              </button>
              <button
                type="button"
                onClick={() => onWidthPresetChange('standard')}
                title="640px - well-fitting standard chat"
                style={{
                  background: chatWidthPreset === 'standard' ? '#0284c7' : 'transparent',
                  color: chatWidthPreset === 'standard' ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                640px
              </button>
              <button
                type="button"
                onClick={() => onWidthPresetChange('wide')}
                title="780px - wide chat"
                style={{
                  background: chatWidthPreset === 'wide' ? '#0284c7' : 'transparent',
                  color: chatWidthPreset === 'wide' ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                780px
              </button>
            </div>
          )}

          <button
            onClick={handleResetChat}
            title="Reset conversation"
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#0284c7')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div
        style={{
          padding: '8px 12px',
          background: '#f8fafc',
          borderBottom: '1px solid #bae6fd',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (onRegenerateReport) onRegenerateReport();
          }}
          disabled={isGeneratingReport}
          style={{
            padding: '5px 10px',
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '16px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            flexShrink: 0,
          }}
        >
          {isGeneratingReport ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          <span>Generate Complete Tweaked Report</span>
        </button>

        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={loading}
            style={{
              padding: '4px 9px',
              background: '#ffffff',
              color: '#334155',
              border: '1px solid #bae6fd',
              borderRadius: '14px',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0284c7')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#bae6fd')}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Stream */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: '#fdfdfe',
        }}
      >
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
              }}
            >
              {!isUser && (
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <Bot size={15} />
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: isUser ? '#e0f2fe' : '#f1f5f9',
                    border: isUser ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                    color: isUser ? '#0c4a6e' : '#0f172a',
                    fontSize: '0.82rem',
                    lineHeight: '1.55',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>

                <div
                  style={{
                    fontSize: '0.65rem',
                    color: '#94a3b8',
                    marginTop: '3px',
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{msg.timestamp}</span>
                  {msg.provider && <span>• {msg.provider}</span>}
                </div>
              </div>

              {isUser && (
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    border: '1px solid #bae6fd',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <User size={14} />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={15} />
            </div>
            <div
              style={{
                padding: '8px 12px',
                background: '#f1f5f9',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                color: '#475569',
              }}
            >
              <Loader2 size={14} className="animate-spin" color="#0284c7" />
              <span>Groq AI is analyzing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div
        style={{
          padding: '10px 12px',
          background: '#ffffff',
          borderTop: '1px solid #bae6fd',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f8fafc',
            border: '1.5px solid #bae6fd',
            borderRadius: '8px',
            padding: '4px 8px',
          }}
        >
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Copilot to clarify, refine, or adjust the report (Press Enter to send)..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '0.8rem',
              resize: 'none',
              padding: '4px',
              fontFamily: 'inherit',
              color: '#0f172a',
            }}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              background: input.trim() && !loading ? '#0284c7' : '#e2e8f0',
              color: input.trim() && !loading ? '#ffffff' : '#94a3b8',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              transition: 'background 0.2s',
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
          Shift + Enter for new line • Enter to submit
        </div>
      </div>
    </div>
  );
}
