import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Catches render-time errors so the whole dashboard never goes blank
 * (previously a single exception inside a modal unmounted the entire app,
 * which looked like the modal "เด้งออก").
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || String(error) };
  }

  componentDidCatch(error: any, info: any) {
    // Keep a trace in the browser console for debugging deployed builds.
    console.error('[ErrorBoundary] Render crash:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-900 dark:text-zinc-100">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-base font-bold">เกิดข้อผิดพลาดในการแสดงผล</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              ระบบพบปัญหาขณะแสดงผลหน้านี้ ข้อมูลของคุณยังปลอดภัย กรุณากดปุ่มด้านล่างเพื่อลองใหม่
            </p>
            {this.state.errorMessage && (
              <pre className="text-[10px] font-mono bg-slate-100 dark:bg-[#0C0C0E] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 overflow-x-auto text-rose-600 dark:text-rose-400 whitespace-pre-wrap break-all">
                {this.state.errorMessage}
              </pre>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
              >
                ลองใหม่อีกครั้ง
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                รีเฟรชหน้าเว็บ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
