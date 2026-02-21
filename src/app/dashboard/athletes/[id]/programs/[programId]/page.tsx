'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import ProgramBuilder from '@/components/program-builder/ProgramBuilder';

export default function EditProgramPage({ params }: { params: Promise<{ id: string; programId: string }> }) {
    const { id, programId } = use(params);
    const [program, setProgram] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProgram = async () => {
            const res = await fetch('/api/programs');
            const programs = await res.json();
            const found = programs.find((p: any) => p.id === programId);
            setProgram(found);
            setLoading(false);
        };
        fetchProgram();
    }, [programId]);

    if (loading) return <div style={{ padding: '2rem' }}>Loading Program...</div>;
    if (!program) return <div style={{ padding: '2rem' }}>Program not found.</div>;

    return <ProgramBuilder athleteId={id} initialData={program} />;
}
