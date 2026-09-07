import { Modal } from './ui/Modal';
import React, { useState, useEffect } from 'react';
import { Settings, Key, Globe, Cpu, Check, AlertCircle, RefreshCw, X, Sparkles, Shield } from 'lucide-react';
import { api } from '../services/api';

export interface AIModelConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  temperature: number;
}

interface AIChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AIModelConfig) => void;
  currentConfig: AIModelConfig;
}

const DEFAULT_CONFIG: AIModelConfig = {
  apiKey: '',
  apiUrl: 'https://generativelanguage.googleapis.com',
  model: 'gemini-2.5-flash',
  temperature: 0.7
};

export const AIChatSettingsModal: React.FC<AIChatSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentConfig
}) => {
  const [config, setConfig] = useState<AIModelConfig>(currentConfig || DEFAULT_CONFIG);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; mode?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(currentConfig || DEFAULT_CONFIG);
      setTestResult(null);
    }
  }, [isOpen, currentConfig]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testAIConfig({
        apiKey: config.apiKey,
        model: config.model,
        apiUrl: config.apiUrl
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setTestResult(null);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="lg"
      showCloseButton={false}
      className="p-0 border-0 overflow-hidden"
      bodyClassName="p-0 flex flex-col"
    >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#0E3589] to-[#1546b3] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">AI Model & API Configuration</h2>
              <p className="text-xs text-blue-100">Configure Gemini model parameters & custom endpoints</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm text-slate-700">
          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-[#0E3589]" />
                Gemini API Key
              </label>
              <span className="text-[11px] text-slate-500 font-medium">(Optional / Stored locally)</span>
            </div>
            <input
              type="password"
              placeholder="Leave empty to use Academy built-in key..."
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0E3589] focus:border-transparent text-sm bg-slate-50 font-mono text-xs"
            />
            <p className="text-[11px] text-slate-500">
              If left blank, the assistant automatically uses the Academy's server-managed Gemini engine.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#0E3589]" />
              AI Model
            </label>
            <select
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0E3589] bg-white text-sm"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended • Stable & Ultra Fast)</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash (Fast & Multimodal)</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash (High Availability)</option>
              <option value="gemini-3.7-flash">gemini-3.7-flash (Latest Preview)</option>
              <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Deep Reasoning)</option>
            </select>
          </div>

          {/* API Base URL */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#0E3589]" />
              API URL / Proxy Endpoint
            </label>
            <input
              type="text"
              placeholder="https://generativelanguage.googleapis.com"
              value={config.apiUrl}
              onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0E3589] text-sm bg-white font-mono text-xs"
            />
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#F46E20]" />
                Temperature (Creativity)
              </label>
              <span className="font-bold text-slate-800 text-xs px-2 py-0.5 bg-slate-100 rounded-md">
                {config.temperature}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="w-full accent-[#0E3589] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-600 font-medium">
              <span>0.0 (Strict / Deterministic)</span>
              <span>1.0 (Creative)</span>
            </div>
          </div>

          {/* Test Connection Button & Result */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-300"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0E3589]" />
                  <span>Verifying AI Connection...</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-[#0E3589]" />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            {testResult && (
              <div
                className={`mt-2.5 p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-red-50 text-red-900 border-red-200'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{testResult.message}</p>
                  {testResult.mode && (
                    <p className="text-[11px] opacity-85 mt-0.5">Mode: {testResult.mode}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline underline-offset-2 cursor-pointer"
          >
            Reset Defaults
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-[#0E3589] hover:bg-[#0a2868] text-white font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Save Configuration
            </button>
          </div>
        </div>
    </Modal>
  );
};
