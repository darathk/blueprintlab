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
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: 300, padding: '2rem', textAlign: 'center',
                    background: 'rgba(18, 18, 18, 0.6)', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
                        Something went wrong
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', maxWidth: 400 }}>
                        {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
                    </p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false, error: null });
                        }}
                        style={{
                            background: 'var(--primary)', color: '#000', border: 'none',
                            borderRadius: 8, padding: '0.6rem 1.5rem', fontSize: '0.875rem',
                            fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s',
                        }}
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
