// src/components/error-handling/GlobalErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    // In a real app, you would send this to a service like Sentry, LogRocket, etc.
    // Example: logErrorToMyService(error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>مشکلی پیش آمده است</h1>
            <p style={styles.message}>
              متاسفانه در زمان اجرای برنامه خطایی رخ داده است. تیم فنی ما از این موضوع مطلع شده است.
            </p>
            <details style={styles.details}>
              <summary>جزئیات خطا</summary>
              <pre style={styles.pre}>
                {this.state.error?.toString()}
              </pre>
            </details>
            <button onClick={this.handleReload} style={styles.button}>
              بارگذاری مجدد صفحه
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Basic inline styles to avoid dependency on CSS modules for this critical component.
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontFamily: 'sans-serif',
    backgroundColor: '#f0f2f5',
    direction: 'rtl',
  },
  card: {
    textAlign: 'center',
    padding: '40px',
    borderRadius: '8px',
    backgroundColor: 'white',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
  },
  title: {
    fontSize: '24px',
    color: '#d9534f',
    marginBottom: '16px',
  },
  message: {
    fontSize: '16px',
    color: '#333',
    marginBottom: '24px',
  },
  details: {
    textAlign: 'right',
    marginBottom: '24px',
    color: '#666',
  },
  pre: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    backgroundColor: '#f9f9f9',
    padding: '10px',
    borderRadius: '4px',
    marginTop: '10px',
    maxHeight: '150px',
    overflowY: 'auto',
    direction: 'ltr',
    textAlign: 'left',
  },
  button: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
  },
};

export default GlobalErrorBoundary;
