import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex bg-red-50 text-red-900 border border-red-500 rounded-lg p-6 max-w-lg mx-auto mt-10 shadow-lg">
           <div className="flex-1">
             <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
             <summary className="text-sm font-semibold opacity-75">
               {this.state.error && this.state.error.toString()}
             </summary>
             <pre className="mt-4 p-4 text-xs font-mono bg-white dark:bg-black/10 overflow-auto max-w-full rounded border border-red-200">
               {this.state.errorInfo?.componentStack}
             </pre>
             <button
               onClick={() => {
                 this.setState({ hasError: false, error: null, errorInfo: null });
                 window.location.reload();
               }}
               className="mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium shadow"
             >
               Refresh Page
             </button>
           </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
