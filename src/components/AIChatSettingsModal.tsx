import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-lg hover:bg-white/10 text-white/80 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm text-slate-700">
          <Input
            label="Gemini API Key (Optional / Stored locally)"
            type="password"
            placeholder="Leave empty to use Academy built-in key..."
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            leftIcon={<Key className="w-4 h-4 text-[#0E3589]" />}
            helperText="If left blank, the assistant automatically uses the Academy's server-managed Gemini engine."
          />

          <Select
            label="AI Model"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
          >
            <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended • Stable & Ultra Fast)</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash (Fast & Multimodal)</option>
            <option value="gemini-1.5-flash">gemini-1.5-flash (High Availability)</option>
            <option value="gemini-3.7-flash">gemini-3.7-flash (Latest Preview)</option>
            <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Deep Reasoning)</option>
          </Select>

          <Input
            label="API URL / Proxy Endpoint"
            type="text"
            placeholder="https://generativelanguage.googleapis.com"
            value={config.apiUrl}
            onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
            leftIcon={<Globe className="w-4 h-4 text-[#0E3589]" />}
          />

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
            <Button
              type="button"
              variant="outline"
              size="md"
              fullWidth
              onClick={handleTestConnection}
              isLoading={isTesting}
              loadingText="Verifying AI Connection..."
              leftIcon={<Shield className="w-3.5 h-3.5 text-[#0E3589]" />}
            >
              Test Connection
            </Button>

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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline underline-offset-2"
          >
            Reset Defaults
          </Button>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Save Configuration
            </Button>
          </div>
        </div>
    </Modal>
  );
};
