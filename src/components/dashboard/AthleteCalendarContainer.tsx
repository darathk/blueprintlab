'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MasterProgramCalendar from './MasterProgramCalendar';
import SessionDetailsModal from './SessionDetailsModal';

export default function AthleteCalendarContainer({ programs, athleteId, currentProgramId, logs = [], travelEvents = [], nextMeetDate = null }) {
    const [selectedSession, setSelectedSession] = useState(null);
    const [localLogs, setLocalLogs] = useState(logs);
    const [localTravelDates, setLocalTravelDates] = useState(travelEvents.map(e => e.date));
    const router = useRouter();

    useEffect(() => {
        setLocalLogs(logs);
    }, [logs]);

    useEffect(() => {
        setLocalTravelDates(travelEvents.map(e => e.date));
    }, [travelEvents]);

    const handleToggleTravel = async (date) => {
        // Optimistic update
        const isCurrentlyTravel = localTravelDates.includes(date);
        if (isCurrentlyTravel) {
            setLocalTravelDates(prev => prev.filter(d => d !== date));
        } else {
            setLocalTravelDates(prev => [...prev, date]);
        }

        try {
            const res = await fetch('/api/athletes/travel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ athleteId, date })
            });
            if (!res.ok) throw new Error('Failed to toggle travel');
            router.refresh(); // Sync potential DB changes
        } catch (err) {
            console.error(err);
            // Rollback on error
            if (isCurrentlyTravel) {
                setLocalTravelDates(prev => [...prev, date]);
            } else {
                setLocalTravelDates(prev => prev.filter(d => d !== date));
            }
            alert('Error updating travel status');
        }
    };

    const handleSelectSession = (program, weekNum, dayNum) => {
        const week = program.weeks.find(w => w.weekNumber === weekNum);
        const session = week?.sessions.find(s => s.day === dayNum);

        if (session) {
            // Build the same session key the athlete side uses: "programId_wX_dY"
            const sKey = `${program.id}_w${weekNum}_d${dayNum}`;

            // Find latest log from LOCAL state using the athlete's sessionId format
            const sessionLog = localLogs
                .filter(l => l.sessionId === sKey)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            setSelectedSession({
                session,
                programName: program.name,
                programId: program.id,
                sessionKey: sKey,
                existingLog: sessionLog
            });
        }
    };

    return (
        <>
            <MasterProgramCalendar
                programs={programs}
                athleteId={athleteId}
                currentProgramId={currentProgramId}
                onSelectSession={handleSelectSession}
                onToggleTravel={handleToggleTravel}
                logs={localLogs}
                travelDates={localTravelDates}
                nextMeetDate={nextMeetDate}
            />

            {selectedSession && (
                <SessionDetailsModal
                    session={selectedSession.session}
                    programName={selectedSession.programName}
                    programId={selectedSession.programId}
                    sessionKey={selectedSession.sessionKey}
                    athleteId={athleteId}
                    existingLog={selectedSession.existingLog}
                    onClose={() => setSelectedSession(null)}
                    onSaveLog={async (log) => {
                        const newLog = { ...log, athleteId };

                        // Optimistic update
                        setLocalLogs(prev => [...prev, newLog]);

                        // Close validation immediately
                        setSelectedSession(null);

                        await fetch('/api/logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newLog)
                        });

                        alert('Workout Saved!');
                        router.refresh(); // Sync server state
                    }}
                />
            )}
        </>
    );
}
