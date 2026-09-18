import { redirect } from 'next/navigation';
import { getCoachAuthState } from '@/lib/auth-cache';

export default async function RevenueLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // STRICT SECURITY: Only the master owner can view revenue
    const auth = await getCoachAuthState();

    if (!auth.user) {
        redirect('/sign-in');
    }

    if (!auth.isCoach || !auth.isOwner) {
        console.warn(`[SECURITY AUDIT] Unauthorized user ${auth.user.email} attempted to load revenue dashboard.`);
        redirect('/dashboard');
    }

    return <>{children}</>;
}
