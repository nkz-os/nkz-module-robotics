import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Copy, Download, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { useFleet } from '../../hooks/useFleet';
import { roboticsApi } from '../../services/roboticsApi';

interface AddRobotWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToCockpit: (robotId: string) => void;
}

type Step = 1 | 2 | 3;

const AddRobotWizard: React.FC<AddRobotWizardProps> = ({ isOpen, onClose, onNavigateToCockpit }) => {
  const { t } = useTranslation('robotics');
  const { provision } = useFleet();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [name, setName] = useState('');
  const [robotType, setRobotType] = useState('AgriRobot');
  const [parcelId, setParcelId] = useState('');

  // Step 2 state
  const [deviceUuid, setDeviceUuid] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [vpnStatus, setVpnStatus] = useState<{ checked: boolean; available: boolean }>({ checked: false, available: false });

  // Step 3 state
  const [result, setResult] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const checkVpn = async () => {
    try {
      const status = await roboticsApi.checkVpnStatus();
      setVpnStatus({ checked: true, available: status.vpn_available });
    } catch {
      setVpnStatus({ checked: true, available: false });
    }
  };

  const handleStep2Enter = async () => {
    setError(null);
    if (!vpnStatus.checked) {
      await checkVpn();
    }
  };

  const handleProvision = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await provision({
        name: name.trim(),
        robot_id: name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, ''),
        robot_type: robotType,
        parcel_id: parcelId || null,
        device_uuid: deviceUuid.trim(),
        claim_code: claimCode.trim(),
      });
      setResult(res);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Provisioning failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (!result) return;
    const text = [
      `ZENOH_ENDPOINT=${result.credentials.endpoint}`,
      `ZENOH_USERNAME=${result.credentials.username}`,
      `ZENOH_PASSWORD=${result.credentials.password}`,
      `TAILSCALE_AUTH_KEY=${result.tailscale_auth_key || ''}`,
      `TAILSCALE_LOGIN_SERVER=${result.tailscale_login_server || 'https://vpn.robotika.cloud'}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
  };

  const handleDownloadEnv = () => {
    if (!result) return;
    const text = [
      `ZENOH_ENDPOINT=${result.credentials.endpoint}`,
      `ZENOH_USERNAME=${result.credentials.username}`,
      `ZENOH_PASSWORD=${result.credentials.password}`,
      `TAILSCALE_AUTH_KEY=${result.tailscale_auth_key || ''}`,
      `TAILSCALE_LOGIN_SERVER=${result.tailscale_login_server || 'https://vpn.robotika.cloud'}`,
      `ROBOT_ID=${result.robot_id}`,
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robot-${result.robot_id}.env`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚜</span>
            <div>
              <h2 className="text-lg font-bold text-white">{t('wizard.title')}</h2>
              <p className="text-xs text-slate-500">{t('wizard.step', { current: step, total: 3 })}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex px-6 py-3 gap-2 border-b border-slate-800">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                s < step ? 'bg-emerald-500' : s === step ? 'bg-rose-500' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Name + Type */}
        {step === 1 && (
          <div className="px-6 py-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('wizard.name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('wizard.namePlaceholder')}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('wizard.type')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'AgriRobot', label: t('wizard.typeAgriRobot'), desc: t('wizard.typeAgriRobotDesc') },
                  { value: 'Rover', label: t('wizard.typeRover'), desc: t('wizard.typeRoverDesc') },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setRobotType(opt.value)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      robotType === opt.value
                        ? 'bg-rose-500/10 border-rose-500/50 text-white'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs mt-1 opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('wizard.parcel')}</label>
              <input
                type="text"
                value={parcelId}
                onChange={(e) => setParcelId(e.target.value)}
                placeholder={t('wizard.parcelPlaceholder')}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => { setStep(2); handleStep2Enter(); }}
                disabled={!name.trim()}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center gap-2 transition-colors"
              >
                {t('wizard.next')}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Claim Code */}
        {step === 2 && (
          <div className="px-6 py-6 space-y-5">
            {vpnStatus.checked && !vpnStatus.available && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300">{t('wizard.vpnNotAvailable')}</p>
                  <p className="text-xs text-amber-400/70 mt-1">{t('wizard.vpnNotAvailableHint')}</p>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('wizard.claimCode')}</label>
              <input
                type="text"
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value)}
                placeholder="V1-XXXX-XXXX"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-2">{t('wizard.claimCodeHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('wizard.deviceUuid')}</label>
              <input
                type="text"
                value={deviceUuid}
                onChange={(e) => setDeviceUuid(e.target.value)}
                placeholder="550e8400-e29b-41d4-a716-446655440000"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
            {vpnStatus.checked && vpnStatus.available && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Check size={14} />
                <span>{t('wizard.vpnDetected')}</span>
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-sm text-red-400">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl flex items-center gap-2 transition-colors"
              >
                <ChevronLeft size={16} />
                {t('wizard.back')}
              </button>
              <button
                onClick={handleProvision}
                disabled={loading || !claimCode.trim() || !deviceUuid.trim()}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('wizard.provisioning')}
                  </>
                ) : (
                  t('wizard.register')
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Credentials */}
        {step === 3 && result && (
          <div className="px-6 py-6 space-y-5">
            <div className="flex items-center gap-2 text-emerald-400">
              <Check size={20} />
              <span className="font-semibold">{t('wizard.success')}</span>
            </div>
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">{t('wizard.credentialsWarning')}</p>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">{t('wizard.zenohEndpoint')}</span>
                  <p className="text-white font-mono text-xs mt-0.5 break-all">{result.credentials.endpoint}</p>
                </div>
                <div>
                  <span className="text-slate-500">{t('wizard.zenohUser')}</span>
                  <p className="text-white font-mono text-xs mt-0.5 break-all">{result.credentials.username}</p>
                </div>
                <div>
                  <span className="text-slate-500">{t('wizard.zenohPass')}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-white font-mono text-xs break-all">
                      {showPassword ? result.credentials.password : '••••••••••••••••••••••••'}
                    </p>
                    <button onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-white">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(result.credentials.password)}
                      className="text-slate-500 hover:text-white"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                {result.tailscale_auth_key && (
                  <div>
                    <span className="text-slate-500">{t('wizard.tailscaleKey')}</span>
                    <p className="text-white font-mono text-xs mt-0.5 break-all">{result.tailscale_auth_key}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyAll}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Copy size={14} />
                {t('wizard.copyAll')}
              </button>
              <button
                onClick={handleDownloadEnv}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Download size={14} />
                {t('wizard.downloadEnv')}
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
              >
                {t('wizard.backToFleet')}
              </button>
              <button
                onClick={() => { onClose(); onNavigateToCockpit(result.robot_id); }}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {t('wizard.goToCockpit')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddRobotWizard;
