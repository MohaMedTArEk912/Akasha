import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
  apiKey: string;
  model: string;
  apiBaseUrl: string;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setApiBaseUrl: (url: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState('');
  const [model, setModelState] = useState('google/gemma-3-4b-it:free');
  const [apiBaseUrl, setApiBaseUrlState] = useState('https://openrouter.ai/api/v1');

  // Load from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('akasha_api_key');
    const savedModel = localStorage.getItem('akasha_model');
    const savedApiBaseUrl = localStorage.getItem('akasha_api_base_url');
    
    if (savedApiKey) setApiKeyState(savedApiKey);
    if (savedModel) setModelState(savedModel);
    if (savedApiBaseUrl) setApiBaseUrlState(savedApiBaseUrl);
  }, []);

  // Persist to localStorage
  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem('akasha_api_key', key);
  };

  const setModel = (m: string) => {
    setModelState(m);
    localStorage.setItem('akasha_model', m);
  };

  const setApiBaseUrl = (url: string) => {
    setApiBaseUrlState(url);
    localStorage.setItem('akasha_api_base_url', url);
  };

  return (
    <SettingsContext.Provider value={{ apiKey, model, apiBaseUrl, setApiKey, setModel, setApiBaseUrl }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
