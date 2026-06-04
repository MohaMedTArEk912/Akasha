import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
  apiKey: string;
  model: string;
  apiBaseUrl: string;
  provider: string;
  noAi: boolean;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setApiBaseUrl: (url: string) => void;
  setProvider: (provider: string) => void;
  setNoAi: (noAi: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState('');
  const [model, setModelState] = useState('google/gemma-3-4b-it:free');
  const [apiBaseUrl, setApiBaseUrlState] = useState('https://openrouter.ai/api/v1');
  const [provider, setProviderState] = useState('openrouter');
  const [noAi, setNoAiState] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('akasha_api_key');
    const savedModel = localStorage.getItem('akasha_model');
    const savedApiBaseUrl = localStorage.getItem('akasha_api_base_url');
    const savedProvider = localStorage.getItem('akasha_provider');
    const savedNoAi = localStorage.getItem('akasha_no_ai');
    
    if (savedApiKey) setApiKeyState(savedApiKey);
    if (savedModel) setModelState(savedModel);
    if (savedApiBaseUrl) setApiBaseUrlState(savedApiBaseUrl);
    if (savedNoAi) setNoAiState(savedNoAi === 'true');
    
    if (savedProvider) {
      setProviderState(savedProvider);
    } else if (savedApiBaseUrl) {
      if (savedApiBaseUrl.includes('api.openai.com')) {
        setProviderState('openai');
      } else if (savedApiBaseUrl.includes('googleapis.com')) {
        setProviderState('gemini');
      } else if (savedApiBaseUrl.includes('openrouter.ai')) {
        setProviderState('openrouter');
      } else {
        setProviderState('custom');
      }
    }
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

  const setProvider = (p: string) => {
    setProviderState(p);
    localStorage.setItem('akasha_provider', p);
  };

  const setNoAi = (val: boolean) => {
    setNoAiState(val);
    localStorage.setItem('akasha_no_ai', String(val));
  };

  return (
    <SettingsContext.Provider value={{ apiKey, model, apiBaseUrl, provider, noAi, setApiKey, setModel, setApiBaseUrl, setProvider, setNoAi }}>
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

