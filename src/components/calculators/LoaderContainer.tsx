'use client';
import { useState } from 'react';
import PlateLoader from '@/components/athlete/PlateLoader';
import ReverseCalculator from '@/components/calculators/ReverseCalculator';
import { Dumbbell, Calculator } from 'lucide-react';

export default function LoaderContainer() {
    const [activeTab, setActiveTab] = useState<'loader' | 'strategist'>('loader');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--background)' }}>
            {/* Top Level Tabs for the Section */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--background)' }}>
                <button
                    onClick={() => setActiveTab('loader')}
                    style={{
                        flex: 1, padding: '16px', background: activeTab === 'loader' ? 'rgba(125, 135, 210, 0.1)' : 'transparent',
                        border: 'none', borderBottom: activeTab === 'loader' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: activeTab === 'loader' ? 'var(--primary)' : 'var(--secondary-foreground)',
                        fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'all 0.2s'
                    }}
                >
                    <Dumbbell size={18} /> Plate Loader
                </button>
                <button
                    onClick={() => setActiveTab('strategist')}
                    style={{
                        flex: 1, padding: '16px', background: activeTab === 'strategist' ? 'rgba(125, 135, 210, 0.1)' : 'transparent',
                        border: 'none', borderBottom: activeTab === 'strategist' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: activeTab === 'strategist' ? 'var(--primary)' : 'var(--secondary-foreground)',
                        fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'all 0.2s'
                    }}
                >
                    <Calculator size={18} /> Calculator
                </button>
            </div>

            {/* Active Component */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {activeTab === 'loader' ? (
                    <PlateLoader inline={false} />
                ) : (
                    <ReverseCalculator />
                )}
            </div>
        </div>
    );
}
