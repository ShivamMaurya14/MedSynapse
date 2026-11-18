import React from 'react';
import ClinicalPipelineProgressModal from './ClinicalPipelineProgressModal';

export default function DiabetesPipelineProgressModal({
  moduleName = 'DIABETES MELLITUS PIPELINE',
  modality = 'tabular',
  ...props
}) {
  return (
    <ClinicalPipelineProgressModal
      moduleName={moduleName}
      modality={modality}
      {...props}
    />
  );
}
