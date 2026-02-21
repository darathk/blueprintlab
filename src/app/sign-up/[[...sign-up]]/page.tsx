import { SignUp } from '@clerk/nextjs';

export default function Page() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--background)' }}>
            <SignUp path="/sign-up" routing="path" />
        </div>
    );
}
