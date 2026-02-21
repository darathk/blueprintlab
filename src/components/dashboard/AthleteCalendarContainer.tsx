'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MasterProgramCalendar from './MasterProgramCalendar';
import SessionDetailsModal from './SessionDetailsModal';

export default function AthleteCalendarContainer({ programs, athleteId, currentProgramId, logs = [] }) {
    const [selectedSession, setSelectedSession] = useState(null);
    const [localLogs, setLocalLogs] = useState(logs);
    const router = useRouter(); // You'll need to import useRouter

    // Update local logs when props change (e.g. after refresh)
    useEffect(() => {
        setLocalLogs(logs);
    }, [logs]);

    const handleSelectSession = (program, weekNum, dayNum) => {
        const week = program.weeks.find(w => w.weekNumber === weekNum);
        const session = week?.sessions.find(s => s.day === dayNum);

        if (session) {
            // Find latest log from LOCAL state
            const sessionLog = localLogs
                .filter(l => l.sessionId === session.id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            setSelectedSession({
                session,
                programName: program.name,
                programId: program.id,
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
                logs={localLogs}
            />

            {selectedSession && (
                <SessionDetailsModal
                    session={selectedSession.session}
                    programName={selectedSession.programName}
                    programId={selectedSession.programId}
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
