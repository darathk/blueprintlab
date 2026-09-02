'use client';

import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * A React Error Boundary that catches client-side rendering errors
 * and displays a recovery UI instead of the "Application error" white screen.
 * Wraps critical page sections (athlete dashboard, program builder, schedule view).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught rendering error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="glass-panel" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: 300, padding: '2.5rem 2rem', textAlign: 'center',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    boxShadow: '0 0 30px rgba(239, 68, 68, 0.08), var(--glass-specular)'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem', filter: 'drop-shadow(0 2px 8px rgba(239,68,68,0.3))' }}>⚠️</div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
                        Something went wrong
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--secondary-foreground)', marginBottom: '1.5rem', maxWidth: 400, lineHeight: 1.5 }}>
                        {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
                    </p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false, error: null });
                        }}
                        className="glass-button glass-button-primary chat-press"
                        style={{ padding: '0.6rem 1.75rem', fontWeight: 600 }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
