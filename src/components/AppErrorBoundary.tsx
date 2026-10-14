import React, { Component, ErrorInfo, ReactNode } from 'react';
import { GreenLeafLogo } from './GreenLeafLogo';
import { RotateCcw, AlertTriangle, Home, Sparkles } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[FG TIME] Uncaught component error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleSoftRecover = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-[#EAF8EF] via-white to-[#EAF8EF] dark:from-[#101512] dark:via-[#12372A] dark:to-[#101512] text-[#12372A] dark:text-white flex flex-col items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-white/95 dark:bg-[#12372A]/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#00C853]/30 dark:border-emerald-800 text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
            {/* Logo */}
            <div className="relative">
              <div className="absolute -inset-3 bg-[#00C853]/20 rounded-full blur-lg animate-pulse" />
              <GreenLeafLogo size="lg" />
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold mt-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Garden Refresh Required</span>
            </div>

            <h2 className="text-xl font-black text-[#12372A] dark:text-white tracking-tight">
              {this.props.fallbackTitle || 'A Sudden Breeze Caught FG TIME'}
            </h2>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              We encountered a temporary rendering issue. Your posts and account data are safely preserved in Cloud Firestore.
            </p>

            {this.state.error?.message && (
              <div className="w-full p-3 rounded-2xl bg-stone-100 dark:bg-emerald-950/60 border border-stone-200 dark:border-emerald-900 text-left overflow-hidden">
                <p className="text-[10px] font-mono text-stone-500 dark:text-emerald-300/80 truncate">
                  Details: {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full mt-2">
              <button
                onClick={this.handleSoftRecover}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-stone-100 dark:bg-emerald-900/50 hover:bg-stone-200 dark:hover:bg-emerald-900 text-stone-700 dark:text-stone-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#00C853]" />
                <span>Try Recovering</span>
              </button>

              <button
                onClick={this.handleReset}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#00C853] to-[#00A344] hover:from-[#00A344] hover:to-[#008f3a] text-white text-xs font-bold shadow-lg shadow-[#00C853]/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Garden</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
