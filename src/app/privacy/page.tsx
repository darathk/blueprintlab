import React from 'react';
import Footer from '@/components/layout/Footer';

export const metadata = {
    title: 'Privacy Policy | BlueprintLab',
    description: 'Privacy Policy for BlueprintLab athlete management platform.',
};

export default function PrivacyPolicy() {
    return (
        <>
            <div className="min-h-screen bg-white text-black py-20 px-4 sm:px-6 lg:px-8 font-serif flex flex-col items-center">
                <div className="w-full max-w-4xl space-y-8">

                    <div className="text-center space-y-4 mb-12">
                        <h1 className="text-3xl font-extrabold tracking-tight text-[#e31837] uppercase">
                            Privacy Policy
                        </h1>
                        <p className="text-black font-bold">
                            BlueprintLab – Privacy Policy / Data Protection
                        </p>
                        <p className="text-gray-600 text-sm italic">
                            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>

                    <div className="space-y-8 text-[15px] leading-[1.6]">

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">1. INTRODUCTION</h2>
                            <p className="mb-4">
                                BlueprintLab (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information about you when you use our athlete analytics and coaching platform.
                            </p>
                            <p>
                                By using BlueprintLab, you agree to the collection and use of information in accordance with this policy.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">2. INFORMATION WE COLLECT</h2>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-bold mb-2 italics">A. ACCOUNT & AUTHENTICATION INFORMATION</h3>
                                    <p>
                                        We use Clerk as our authentication provider. When you sign up, whether via email or a social provider (e.g., Google), we store standard profile information such as your name, email address, and profile picture.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-bold mb-2">B. HEALTH & PERFORMANCE DATA</h3>
                                    <p className="mb-4">
                                        As a core function of the platform, we collect detailed athletic and physiological data. This includes, but is not limited to:
                                    </p>
                                    <ul className="list-disc ml-6 pl-6 space-y-2">
                                        <li>Workout logs, sets, reps, and weights lifted.</li>
                                        <li>Estimated One-Rep Max (1RM), Readiness scores (e.g., sleep quality, fatigue levels, stress levels).</li>
                                        <li>Daily check-ins, program assignments, block reviews, and calculated Strain/Stress indexes.</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="font-bold mb-2">C. COMMUNICATION & MEDIA</h3>
                                    <p>
                                        We store messages sent between Coaches and Athletes, as well as media files (such as technique evaluation videos or images) uploaded directly to the platform.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">3. HOW WE USE YOUR INFORMATION</h2>
                            <p className="mb-4">We use the information we collect to:</p>
                            <ul className="list-disc ml-6 pl-6 space-y-2">
                                <li>Provide, maintain, and improve the BlueprintLab application and its analytical engines.</li>
                                <li>Allow Coaches to track, analyze, and optimize their Athletes&apos; performance through data visualizations.</li>
                                <li>Facilitate real-time communication between Coaches and Athletes.</li>
                                <li>Calculate and estimate performance metrics based on your logged workout history.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">4. DATA VISIBILITY AND SECURITY</h2>
                            <p className="mb-4">
                                <strong>STRICT ROLE SEGREGATION:</strong> BlueprintLab implements strict data isolation.
                            </p>
                            <ul className="list-disc ml-6 pl-6 space-y-2 mb-4">
                                <li><strong>ATHLETES</strong> can only view their own personal performance data, training programs, and direct messages with their Coach. They cannot see data belonging to other Athletes.</li>
                                <li><strong>COACHES</strong> can view the performance data, history, and uploaded media of the Athletes explicitly managed by them within the platform.</li>
                            </ul>
                            <p>
                                We use secure industry-standard databases to encrypt and store your data safely. However, no absolute security guarantee can be made for any internet transmission.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">5. THIRD-PARTY SERVICES</h2>
                            <p className="mb-4">
                                BlueprintLab relies on specific third-party infrastructure to function, and your data may be processed by them:
                            </p>
                            <ul className="list-disc ml-6 pl-6 space-y-2 mb-4">
                                <li><strong>CLERK:</strong> For secure user authentication and session management.</li>
                                <li><strong>SUPABASE:</strong> For relational database hosting, real-time subscriptions, and secure media file storage.</li>
                                <li><strong>VERCEL:</strong> For application hosting and serverless API execution.</li>
                            </ul>
                            <p className="mt-4 italic">
                                We do not sell your personal, health, or performance data to advertising networks or external third parties.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">6. YOUR RIGHTS</h2>
                            <p>
                                You have the right to request access to, correction of, or deletion of your personal and athletic data stored on BlueprintLab. Because your data may be tied to a Coach&apos;s programming history, data deletion requests may result in anonymization rather than complete destruction if necessary to preserve aggregate analytical functionality for the Coach, subject to applicable law.
                            </p>
                        </section>

                        <section className="border-t border-gray-300 pt-8 mt-12 text-sm text-gray-600 italic">
                            <p>
                                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot; date.
                            </p>
                        </section>

                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}
