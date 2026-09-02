import React from 'react';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer style={{
            marginTop: '3rem',
            background: 'rgba(10, 10, 14, 0.75)',
            backdropFilter: 'blur(var(--glass-blur-lg))',
            WebkitBackdropFilter: 'blur(var(--glass-blur-lg))',
            borderTop: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-specular)',
            padding: '2.5rem 0 2rem'
        }}>
            <div className="container mx-auto px-4 max-w-6xl">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start gap-1">
                        <span style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            display: 'inline-block'
                        }}>
                            BlueprintLab
                        </span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--secondary-foreground)' }}>
                            Advanced Athlete Management System
                        </span>
                    </div>

                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium">
                        <Link
                            href="/"
                            className="chat-press text-[var(--secondary-foreground)] hover:text-[var(--primary)] transition-colors duration-150"
                        >
                            Home
                        </Link>
                        <Link
                            href="/privacy"
                            className="chat-press text-[var(--secondary-foreground)] hover:text-[var(--primary)] transition-colors duration-150"
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            href="/terms"
                            className="chat-press text-[var(--secondary-foreground)] hover:text-[var(--primary)] transition-colors duration-150"
                        >
                            Terms of Service
                        </Link>
                    </div>
                </div>

                <div style={{
                    marginTop: '2rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.4)'
                }}>
                    <p>© {new Date().getFullYear()} BlueprintLab. All rights reserved.</p>
                    <p style={{ marginTop: '0.5rem', textAlign: 'center', maxWidth: 600, fontSize: '0.6875rem', lineHeight: 1.5, opacity: 0.7 }}>
                        For professional coaches and athletes. Not a substitute for medical advice or professional healthcare.
                    </p>
                </div>
            </div>
        </footer>
    );
}
