import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onErrorCapture?: (error: Error, info: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (this.props.onErrorCapture) {
      this.props.onErrorCapture(error, info);
    } else {
      console.error('[UI ErrorBoundary]', error, info);
    }
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold">خطا در بارگذاری بخش</h2>
          <p className="text-sm text-muted-foreground direction-rtl">لطفاً دوباره تلاش کنید.</p>
          <button onClick={this.reset} className="px-3 py-1.5 rounded-md bg-primary text-white text-sm">تلاش مجدد</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
