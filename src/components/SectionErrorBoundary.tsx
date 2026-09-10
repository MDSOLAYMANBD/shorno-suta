import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional name for logging (e.g. "best_selling") */
  name?: string;
  /** Optional fallback UI; defaults to silent (null) so the rest of the page keeps rendering */
  fallback?: React.ReactNode;
}

interface State { hasError: boolean }

/**
 * Wraps a single homepage / storefront section. If the section throws
 * (e.g. an unexpected data shape, a missing column after a migration, or a
 * runtime crash inside a child component) the rest of the page keeps
 * rendering instead of going completely blank.
 */
export default class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[SectionErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`, error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
