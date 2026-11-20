import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
  apiKey: string;
  model: string;
  apiBaseUrl: string;
  provider: string;
  noAi: boolean;
  memberName: string;
  compactMode: boolean;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setApiBaseUrl: (url: string) => void;
  setProvider: (provider: string) => void;
  setNoAi: (noAi: boolean) => void;
  setMemberName: (name: string) => void;
  setCompactMode: (compact: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState('');
  const [model, setModelState] = useState('');
  const [apiBaseUrl, setApiBaseUrlState] = useState('');
  const [provider, setProviderState] = useState('offline');
  const [noAi, setNoAiState] = useState(false);
  const [memberName, setMemberNameState] = useState('Founder');
  const [compactMode, setCompactModeState] = useState(false);

  useEffect(() => {
    const savedApiKey = localStorage.getItem('akasha_api_key') || '';
    const savedModel = localStorage.getItem('akasha_model') || '';
    const savedApiBaseUrl = localStorage.getItem('akasha_api_base_url') || '';
    const savedProvider = localStorage.getItem('akasha_provider') || '';
    const savedNoAi = localStorage.getItem('akasha_no_ai');
    const savedMember = localStorage.getItem('akasha_member_name') || 'Founder';
    const savedCompact = localStorage.getItem('akasha_compact_mode');

    // Clean out legacy fake placeholder tokens
    const cleanKey = savedApiKey === 'antigravity-brain-active' ? '' : savedApiKey;
    const cleanModel = savedModel === 'antigravity-brain' ? '' : savedModel;
    const cleanUrl = savedApiBaseUrl === '/api/akasha' ? '' : savedApiBaseUrl;
    const cleanProv = savedProvider === 'antigravity' ? '' : savedProvider;

    setApiKeyState(cleanKey);
    setModelState(cleanModel);
    setApiBaseUrlState(cleanUrl);
    setProviderState(cleanProv || (cleanKey ? 'gemini' : 'offline'));
    if (savedNoAi) setNoAiState(savedNoAi === 'true');
    setMemberNameState(savedMember);
    if (savedCompact) setCompactModeState(savedCompact === 'true');
  }, []);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    if (key) localStorage.setItem('akasha_api_key', key);
    else localStorage.removeItem('akasha_api_key');
  };

  const setModel = (m: string) => {
    setModelState(m);
    if (m) localStorage.setItem('akasha_model', m);
    else localStorage.removeItem('akasha_model');
  };

  const setApiBaseUrl = (url: string) => {
    setApiBaseUrlState(url);
    if (url) localStorage.setItem('akasha_api_base_url', url);
    else localStorage.removeItem('akasha_api_base_url');
  };

  const setProvider = (p: string) => {
    setProviderState(p);
    if (p) localStorage.setItem('akasha_provider', p);
    else localStorage.removeItem('akasha_provider');
  };

  const setNoAi = (val: boolean) => {
    setNoAiState(val);
    localStorage.setItem('akasha_no_ai', String(val));
  };

  const setMemberName = (name: string) => {
    const clean = name.trim() || 'Founder';
    setMemberNameState(name);
    localStorage.setItem('akasha_member_name', clean);
  };

  const setCompactMode = (compact: boolean) => {
    setCompactModeState(compact);
    localStorage.setItem('akasha_compact_mode', String(compact));
  };

  return (
    <SettingsContext.Provider
      value={{
        apiKey,
        model,
        apiBaseUrl,
        provider,
        noAi,
        memberName,
        compactMode,
        setApiKey,
        setModel,
        setApiBaseUrl,
        setProvider,
        setNoAi,
        setMemberName,
        setCompactMode,
      }}
    >
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
