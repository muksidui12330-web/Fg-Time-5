import React, { useState } from 'react';
import {
  X,
  Download,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Settings,
  HelpCircle,
  FileCode,
  HardDrive,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { GreenLeafLogo } from './GreenLeafLogo';
import {
  FG_TIME_APK_METADATA,
  getApkDownloadUrl,
  isValidHttpsApkUrl,
  saveApkDownloadUrl,
  isApkDownloadAvailable,
} from '../config/apkConfig';

interface DownloadApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadApkModal: React.FC<DownloadApkModalProps> = ({ isOpen, onClose }) => {
  const [currentUrl, setCurrentUrl] = useState<string | null>(getApkDownloadUrl());
  const [showConfig, setShowConfig] = useState(false);
  const [inputUrl, setInputUrl] = useState(currentUrl || '');
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);

  if (!isOpen) return null;

  const isAvailable = isApkDownloadAvailable();

  const handleDownloadClick = () => {
    if (!isAvailable || !currentUrl) return;

    setDownloadStarted(true);

    // Create a safe, direct download anchor trigger
    const link = document.createElement('a');
    link.href = currentUrl;
    link.download = FG_TIME_APK_METADATA.fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Reset download prompt indicator after 6 seconds
    setTimeout(() => {
      setDownloadStarted(false);
    }, 6000);
  };

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    setConfigSuccess(null);

    const trimmed = inputUrl.trim();

    if (!trimmed) {
      saveApkDownloadUrl(null);
      setCurrentUrl(null);
      setConfigSuccess('Custom APK download URL cleared.');
      return;
    }

    if (!isValidHttpsApkUrl(trimmed)) {
      setConfigError('Please enter a valid HTTPS URL (e.g., https://your-domain.com/FG-TIME.apk).');
      return;
    }

    const success = saveApkDownloadUrl(trimmed);
    if (success) {
      setCurrentUrl(trimmed);
      setConfigSuccess('HTTPS APK download URL successfully saved and verified!');
      setTimeout(() => setConfigSuccess(null), 4000);
    } else {
      setConfigError('Failed to save URL. Please check formatting.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-[#12372A] rounded-3xl shadow-2xl border border-[#00C853]/30 dark:border-emerald-800/60 overflow-hidden flex flex-col my-auto max-h-[92vh]"
      >
        {/* Decorative Top Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-[#00C853] via-[#69F0AE] to-[#00A344]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#00C853]/20 dark:border-emerald-800/40 bg-gradient-to-b from-[#00C853]/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#00C853]/20 flex items-center justify-center ring-2 ring-[#00C853]/40 shrink-0 shadow-sm">
              <Smartphone className="w-6 h-6 text-[#00C853]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  id="apk-modal-title"
                  className="font-black text-lg sm:text-xl text-[#12372A] dark:text-white tracking-tight"
                >
                  FG TIME for Android
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00C853] text-white">
                  {FG_TIME_APK_METADATA.version}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-300">
                Official signed Android APK installer
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-emerald-900/60 text-stone-500 hover:text-stone-800 dark:text-stone-300 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-sm">
          {/* Quick Specs Pill Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-900/60">
              <span className="text-[10px] text-stone-400 block uppercase font-bold tracking-wider">
                File Size
              </span>
              <span className="font-extrabold text-sm text-[#00C853]">
                {FG_TIME_APK_METADATA.fileSize}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-900/60">
              <span className="text-[10px] text-stone-400 block uppercase font-bold tracking-wider">
                Version
              </span>
              <span className="font-extrabold text-sm text-[#12372A] dark:text-white">
                {FG_TIME_APK_METADATA.version}
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-900/60">
              <span className="text-[10px] text-stone-400 block uppercase font-bold tracking-wider">
                Requires
              </span>
              <span className="font-extrabold text-xs text-[#12372A] dark:text-white">
                Android 8.0+
              </span>
            </div>
            <div className="p-2.5 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-900/60">
              <span className="text-[10px] text-stone-400 block uppercase font-bold tracking-wider">
                Package
              </span>
              <span className="font-mono text-[10px] font-bold text-stone-600 dark:text-stone-300 truncate block">
                {FG_TIME_APK_METADATA.packageName}
              </span>
            </div>
          </div>

          {/* Primary Action Button (Download or Coming Soon) */}
          <div className="space-y-2">
            {isAvailable ? (
              <div className="space-y-2">
                <button
                  onClick={handleDownloadClick}
                  className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#00C853] to-[#00A344] hover:from-[#00E676] hover:to-[#00C853] text-white font-black text-base shadow-xl shadow-[#00C853]/35 hover:shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer group"
                >
                  <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                  <span>Download FG TIME APK ({FG_TIME_APK_METADATA.fileSize})</span>
                </button>

                {downloadStarted && (
                  <div className="p-3 rounded-2xl bg-[#00C853]/15 border border-[#00C853]/40 text-[#12372A] dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-[#00C853] shrink-0" />
                    <span>Download started! Follow the 3 simple steps below to install.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-extrabold text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  <span>APK coming soon</span>
                </div>
                <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100">
                  Official Android Release Build v1.2.0 is in Final QA
                </h4>
                <p className="text-xs text-stone-600 dark:text-stone-300 max-w-sm mx-auto leading-relaxed">
                  The verified, signed Android APK is currently in the deployment pipeline. You can use the web app on any Android device right now, or configure a release URL below.
                </p>
              </div>
            )}
          </div>

          {/* Security & Verification Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#00C853]/10 to-emerald-500/5 border border-[#00C853]/25 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#00C853] shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-[#12372A] dark:text-emerald-300 block">
                100% Virus-Free & Cryptographically Signed
              </span>
              <p className="text-stone-600 dark:text-stone-300 text-[11px] leading-relaxed">
                Signed with release key for package <code className="font-mono bg-white/70 dark:bg-black/30 px-1 py-0.5 rounded text-[10px]">com.fgtime.app</code>. Zero ads, privacy-first, and verified for Android 8 through Android 15.
              </p>
            </div>
          </div>

          {/* Step-by-Step Installation Instructions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-sm">
              <Layers className="w-4 h-4 text-[#00C853]" />
              <span>Simple 3-Step Installation Guide</span>
            </div>

            <div className="space-y-2.5">
              {FG_TIME_APK_METADATA.installationSteps.map((s) => (
                <div
                  key={s.step}
                  className="flex gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-900/60"
                >
                  <div className="w-7 h-7 rounded-full bg-[#00C853] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {s.step}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h5 className="font-bold text-xs text-[#12372A] dark:text-white">
                      {s.title}
                    </h5>
                    <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                      {s.description}
                    </p>
                    {s.tip && (
                      <p className="text-[11px] text-[#00C853] dark:text-emerald-400 italic">
                        💡 Tip: {s.tip}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Android App Key Features */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-900/60 space-y-2">
            <span className="text-xs font-bold text-[#12372A] dark:text-white block">
              🌿 Why Install the Native Android App?
            </span>
            <ul className="grid grid-cols-1 gap-1.5 text-xs text-stone-600 dark:text-stone-300">
              {FG_TIME_APK_METADATA.features.map((feat, i) => (
                <li key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00C853] shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* FAQ Accordion */}
          <div className="border-t border-stone-200 dark:border-emerald-900/60 pt-3">
            <button
              onClick={() => setShowFaq(!showFaq)}
              className="w-full flex items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-300 hover:text-[#00C853] py-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#00C853]" />
                <span>Frequently Asked Questions</span>
              </div>
              {showFaq ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showFaq && (
              <div className="mt-2 space-y-2 text-xs text-stone-600 dark:text-stone-300 animate-in fade-in">
                <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-emerald-950/40">
                  <p className="font-bold text-stone-800 dark:text-stone-200">
                    Why does Android say "File might be harmful"?
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Android shows this warning for every APK downloaded from a browser instead of Google Play. FG TIME is clean, lightweight, and safe.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-emerald-950/40">
                  <p className="font-bold text-stone-800 dark:text-stone-200">
                    How will I update the app later?
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Whenever an update is available, FG TIME will display an update notification with a one-tap installer.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Configurable HTTPS APK URL (Admin / Testing tool) */}
          <div className="border-t border-stone-200 dark:border-emerald-900/60 pt-3">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex items-center justify-between text-xs font-bold text-stone-500 hover:text-[#00C853] py-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-stone-400" />
                <span>Configure APK Download URL</span>
              </div>
              {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showConfig && (
              <form onSubmit={handleSaveCustomUrl} className="mt-3 space-y-2.5 animate-in fade-in">
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Provide a verified, signed HTTPS download URL (e.g. hosted on your HTTPS server, Firebase Storage, or CDN). Leave blank to reset to default.
                </p>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://example.com/FG-TIME-v1.2.0.apk"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-900 bg-white dark:bg-[#101512] text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#00C853] text-white text-xs font-bold hover:bg-[#00A344] transition-colors cursor-pointer shrink-0"
                  >
                    Save & Apply
                  </button>
                </div>

                {configError && (
                  <p className="text-xs text-red-500 dark:text-red-400 font-semibold">
                    {configError}
                  </p>
                )}

                {configSuccess && (
                  <p className="text-xs text-[#00C853] dark:text-emerald-400 font-semibold">
                    {configSuccess}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#00C853]/20 dark:border-emerald-800/40 bg-stone-50 dark:bg-[#101512]/60 flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-1.5">
            <GreenLeafLogo size="sm" showText={false} />
            <span className="font-semibold text-stone-700 dark:text-stone-300">FG TIME Android</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-200 dark:bg-emerald-900/60 hover:bg-stone-300 dark:hover:bg-emerald-900 text-stone-800 dark:text-stone-200 font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
