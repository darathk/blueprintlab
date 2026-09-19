import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import StrengthSuite from '@/components/strength-suite/StrengthSuite';

export default async function DashboardPlateLoaderPage() {
    const user = await currentUser();
    if (!user) redirect('/sign-in');

    return (
        <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6">
            <StrengthSuite initialTab="barbell" />
        </div>
    );
}
