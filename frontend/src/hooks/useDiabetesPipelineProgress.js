import { useCallback, useState } from 'react';

export default function useDiabetesPipelineProgress() {
  const [state, setState] = useState({
    isOpen: false,
    stage: 'prediction_running',
    error: null,
    failedAt: null,
  });

  const start = useCallback(() => setState({
    isOpen: true,
    stage: 'prediction_running',
    error: null,
    failedAt: null,
  }), []);

  const transition = useCallback(stage => setState({
    isOpen: true,
    stage,
    error: null,
    failedAt: null,
  }), []);

  const fail = useCallback((error, failedAt = 'prediction') => setState({
    isOpen: true,
    stage: 'error',
    error,
    failedAt,
  }), []);

  const close = useCallback(() => {
    setState(previous => ({ ...previous, isOpen: false }));
  }, []);

  const reset = useCallback(() => setState({
    isOpen: false,
    stage: 'prediction_running',
    error: null,
    failedAt: null,
  }), []);

  const handleWorkflowStageChange = useCallback((stage, details = {}) => {
    if (stage === 'error') {
      fail(details.message || 'The pipeline stage failed.', details.failedAt);
      return;
    }
    transition(stage);
  }, [fail, transition]);

  return {
    ...state,
    start,
    transition,
    fail,
    close,
    reset,
    handleWorkflowStageChange,
  };
}
