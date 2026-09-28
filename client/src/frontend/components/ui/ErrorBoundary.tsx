/**
 * App-level Error Boundary
 *
 * Catches unhandled React render errors and displays a recovery UI
 * instead of crashing the entire application.
 */

import React from "react";

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("[ErrorBoundary] Uncaught error:", error);
        console.error("[ErrorBoundary] Component stack:", info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen flex items-center justify-center bg-[#0e0e10] text-white p-8">
                    <div className="max-w-lg text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                            <span className="font-mono text-xs font-black tracking-widest text-red-400 uppercase">SYS_FAULT</span>
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Something Went Wrong</h1>
                        <p className="text-sm text-white/60 mb-4">
                            The application encountered an unexpected error. You can try
                            reloading the page to recover.
                        </p>
                        {this.state.error && (
                            <pre className="text-xs text-left text-red-300/80 bg-white/5 p-4 rounded-lg border border-white/10 mb-6 overflow-auto max-h-32">
                                {this.state.error.message}
                            </pre>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
