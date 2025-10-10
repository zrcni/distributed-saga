import React, { useContext } from 'react';

export interface UIConfig {
  boardTitle?: string;
}

export const UIConfigContext = React.createContext<UIConfig>({});

export function useUIConfig() {
  return useContext(UIConfigContext);
}
