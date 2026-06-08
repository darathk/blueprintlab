import React from 'react';
import { CompetitorProfile } from '@/lib/openpowerlifting';
import { calculateDots } from '@/lib/dots';

export default function CompareAllView({ 
    saved, 
    athleteTotals, 
    athleteBodyweight, 
    athleteGender 
}: { 
    saved: CompetitorProfile[], 
    athleteTotals?: any, 
    athleteBodyweight: number, 
    athleteGender?: 'male'|'female' 
}) {
    const athletePlannedTotal = athleteTotals?.planned || 0;
    const athleteDots = (athleteGender && athleteBodyweight > 0 && athletePlannedTotal > 0) 
        ? calculateDots(athletePlannedTotal, athleteBodyweight, athleteGender) 
        : 0;

    // Sort competitors by heaviest total descending
    const sorted = [...saved].sort((a, b) => b.heaviestTotal - a.heaviestTotal);

    return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--card-border)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Master Comparison Table
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--card-border)', fontSize: 11, textTransform: 'uppercase', color: 'var(--secondary-foreground)' }}>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Competitor</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Projected Total</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>vs Athlete</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Best DOTS</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Overall Hit Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Athlete Row */}
                        <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'rgba(34, 211, 238, 0.05)' }}>
                            <td style={{ padding: '12px 16px' }}>
                                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Your Athlete (PLN)</div>
                                <div style={{ fontSize: 11, color: 'var(--secondary-foreground)' }}>{athleteBodyweight}kg Class</div>
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--foreground)' }}>
                                {athletePlannedTotal > 0 ? `${athletePlannedTotal.toFixed(1)} kg ` : '—'}
                                {athletePlannedTotal > 0 && <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>({(athletePlannedTotal * 2.20462).toFixed(1)} lbs)</span>}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--secondary-foreground)' }}>—</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#ec4899' }}>{athleteDots > 0 ? athleteDots.toFixed(2) : '—'}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--secondary-foreground)' }}>—</td>
                        </tr>
                        {/* Competitor Rows */}
                        {sorted.map(c => {
                            const target = c.heaviestTotal > 0 ? c.heaviestTotal : c.projectedTotal;
                            const diff = athletePlannedTotal - target;
                            const isWinning = diff >= 0;

                            return (
                                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{c.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--secondary-foreground)' }}>{c.heaviestTotalWeightClass ? `${c.heaviestTotalWeightClass}kg Class` : 'Unknown Class'}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--foreground)' }}>
                                        {target.toFixed(1)} kg <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>({(target * 2.20462).toFixed(1)} lbs)</span>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontWeight: 700, color: isWinning ? 'var(--success)' : 'var(--error)' }}>
                                        {athletePlannedTotal > 0 ? `${isWinning ? '+' : ''}${diff.toFixed(1)} kg ` : '—'}
                                        {athletePlannedTotal > 0 && <span style={{ fontSize: 11, opacity: 0.8 }}>({isWinning ? '+' : ''}{(diff * 2.20462).toFixed(1)} lbs)</span>}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--foreground)' }}>
                                        {c.historicalBests?.dots?.value > 0 ? c.historicalBests.dots.value.toFixed(2) : '—'}
                                    </td>
                                    <td style={{ padding: '12px 16px', color: 'var(--foreground)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                                                <div style={{ width: `${c.hitRates.overall.percent}%`, height: '100%', background: c.hitRates.overall.percent > 70 ? 'var(--success)' : 'var(--warning)', borderRadius: 2 }} />
                                            </div>
                                            <span style={{ fontSize: 12 }}>{c.hitRates.overall.percent}%</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
