'use client';

import { use } from 'react';
import ProgramBuilder from '@/components/program-builder/ProgramBuilder';

export default function NewProgramPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <ProgramBuilder athleteId={id} />;
}
