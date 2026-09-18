'use client';

import { CreditCard, ExternalLink, ShieldCheck } from 'lucide-react';

interface SubscriptionCardProps {
    portalUrl?: string;
}

export default function SubscriptionCard({ portalUrl }: SubscriptionCardProps) {
    const effectiveUrl = portalUrl || process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL || 'https://billing.stripe.com/p/login/3cI7sL30jevG1f6frI2B200';

    return (
        <div className="glass-panel" style={{
            padding: '20px',
            borderRadius: '16px',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(125, 135, 210, 0.25)',
            background: 'linear-gradient(135deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 18, 0.85) 100%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        }}>
            {/* Ambient subtle glow */}
            <div style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(125, 135, 210, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: '12px',
                        background: 'rgba(125, 135, 210, 0.15)',
                        border: '1px solid rgba(125, 135, 210, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                    }}>
                        <CreditCard size={22} />
                    </div>
                    <div>
                        <div style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--foreground)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            Subscription & Billing
                            <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                            }}>
                                Active
                            </span>
                        </div>
                        <div style={{
                            fontSize: '0.78rem',
                            color: 'var(--secondary-foreground)',
                            opacity: 0.75,
                            marginTop: '2px',
                        }}>
                            Self-service coaching billing portal
                        </div>
                    </div>
                </div>
            </div>

            <p style={{
                fontSize: '0.825rem',
                color: 'var(--secondary-foreground)',
                lineHeight: 1.5,
                margin: '0 0 16px 0',
            }}>
                Manage your payment methods, view invoices, download payment receipts, or cancel your subscription directly through Stripe.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--secondary-foreground)', fontSize: '0.75rem', opacity: 0.8 }}>
                    <ShieldCheck size={14} style={{ color: '#10b981' }} />
                    <span>Secured by Stripe Billing</span>
                </div>

                <a
                    href={effectiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-button chat-press"
                    style={{
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, rgba(125, 135, 210, 0.25) 0%, rgba(99, 102, 241, 0.35) 100%)',
                        color: '#ffffff',
                        border: '1px solid rgba(125, 135, 210, 0.4)',
                        padding: '8px 16px',
                        borderRadius: '12px',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        boxShadow: '0 2px 10px rgba(99, 102, 241, 0.2)',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <span>Manage Subscription</span>
                    <ExternalLink size={14} />
                </a>
            </div>
        </div>
    );
}
