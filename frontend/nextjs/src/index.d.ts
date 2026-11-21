declare module 'gpt-researcher-ui' {
  import React from 'react';

  export interface InquireXResearcherProps {
    apiUrl?: string;
    apiKey?: string;
    defaultPrompt?: string;
    onResultsChange?: (results: any) => void;
    theme?: any;
  }

  export const InquireXResearcher: React.FC<InquireXResearcherProps>;
}