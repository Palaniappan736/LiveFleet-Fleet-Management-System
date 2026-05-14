import React from 'react';

/**
 * ErrorBoundary — Catches any render-time error in the tree and shows
 * a friendly error UI instead of a blank white screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, info: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || 'Unknown error';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6">
        <div className="bg-gray-900 border border-red-700 rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-400 text-sm mb-4">The application encountered an unexpected error.</p>
          <div className="bg-gray-800 rounded-lg px-4 py-3 text-left mb-6">
            <p className="text-red-400 text-xs font-mono break-all">{msg}</p>
          </div>
          <button
            onClick={this.handleReload}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
