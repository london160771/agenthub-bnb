import { Component } from 'react';

/**
 * Top-level error boundary. Prevents a render error anywhere in the tree from
 * showing a blank screen; offers a reload path. Route-level errors should be
 * handled closer to the data, but this is the last line of defence.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-2xl font-black text-black">
            !
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
            <p className="max-w-md text-sm text-muted">
              An unexpected error interrupted the page. You can head back to the homepage and try
              again.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-black transition-colors hover:bg-brand-2"
          >
            Back to AgentHub
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
