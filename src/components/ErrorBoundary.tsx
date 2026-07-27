import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('💥 [SabanOS ErrorBoundary Caught]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.href = '/';
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <div className="w-20 h-20 bg-amber-500/20 border-2 border-amber-500/50 rounded-3xl flex items-center justify-center mb-6 text-amber-400 shadow-2xl shadow-amber-500/20 animate-pulse">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black mb-2 text-white">נועה | התרחשה שגיאה במערכת</h1>
          <p className="text-sm text-slate-400 mb-6 max-w-md leading-relaxed">
            המערכת זיהתה תקלה בעת טעינת התצוגה במכשיר שלך. ניתן לרענן את העמוד או לאפס את המטמון המקומי לשחזור מהיר.
          </p>

          {this.state.error && (
            <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-right text-xs font-mono text-rose-300 overflow-x-auto mb-6 max-h-36">
              <p className="font-bold text-rose-400 mb-1">{this.state.error.toString()}</p>
              {this.state.errorInfo?.componentStack && (
                <p className="text-[10px] text-slate-500 whitespace-pre-wrap">{this.state.errorInfo.componentStack.slice(0, 300)}...</p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReset}
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <span>רענן עמוד</span>
            </button>

            <button
              onClick={this.handleClearCache}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <span>איפוס מטמון וטעינה מחדש</span>
            </button>
          </div>

          <div className="mt-8 text-[11px] text-slate-500 font-bold">
            באדיבות נועה ❤️ | ח. סבן חומרי בניין
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
