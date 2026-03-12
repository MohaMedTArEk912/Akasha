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
                        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                            <svg
                                className="w-10 h-10 text-red-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
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
