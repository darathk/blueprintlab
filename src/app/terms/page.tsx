import React from 'react';
import Footer from '@/components/layout/Footer';

export const metadata = {
    title: 'Terms of Service | BlueprintLab',
    description: 'Terms of Service for BlueprintLab athlete management platform.',
};

export default function TermsOfService() {
    return (
        <>
            <div className="min-h-screen bg-white text-black py-20 px-4 sm:px-6 lg:px-8 font-serif flex flex-col items-center">
                <div className="w-full max-w-4xl space-y-8">

                    <div className="text-center space-y-4 mb-12">
                        <h1 className="text-3xl font-extrabold tracking-tight text-[#e31837] uppercase">
                            Terms of Service
                        </h1>
                        <p className="text-black font-bold">
                            BlueprintLab – Terms of Service / Terms of Use
                        </p>
                        <p className="text-gray-600 text-sm italic">
                            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>

                    <div className="space-y-8 text-[15px] leading-[1.6]">

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">OVERVIEW</h2>
                            <p className="mb-4">
                                This website is operated by BlueprintLab. Throughout the site, the terms &quot;we&quot;, &quot;us&quot; and &quot;our&quot; refer to BlueprintLab. BlueprintLab offers this website, including all information, tools and services available from this site to you, the user, conditioned upon your acceptance of all terms, conditions, policies and notices stated here.
                            </p>
                            <p>
                                By visiting our site and/ or purchasing something from us, you engage in our &quot;Service&quot; and agree to be bound by the following terms and conditions (&quot;Terms of Service&quot;, &quot;Terms&quot;), including those additional terms and conditions and policies referenced herein and/or available by hyperlink. These Terms of Service apply to all users of the site, including without limitation users who are browsers, coaches, athletes, and/ or contributors of content.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">1. ACCEPTANCE OF TERMS</h2>
                            <p>
                                By accessing and using BlueprintLab (&quot;the Service&quot;), whether as a designated Coach or an Athlete, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">2. HEALTH AND MEDICAL DISCLAIMER</h2>
                            <p className="font-bold mb-3 block">
                                BlueprintLab is an analytics and communication tool, not a medical device or healthcare provider.
                            </p>
                            <p className="mb-4 text-red-700 font-bold">
                                PLEASE READ CAREFULLY: Any training programs, exercises, analytics, or advice provided through the Service by your Coach are undertaken at your own risk. You should always consult with a qualified healthcare professional before beginning any new exercise or physical training program, especially if you have pre-existing health conditions or injuries.
                            </p>
                            <p>
                                We are not responsible for any direct, indirect, or consequential injuries, damages, or health complications that may result from using the Service or participating in training programs hosted on the platform.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">3. USER ACCOUNTS AND ROLES</h2>
                            <p className="mb-4 font-bold">
                                THE SERVICE DISTINGUISHES BETWEEN COACHES AND ATHLETES.
                            </p>
                            <ul className="list-disc ml-6 pl-6 space-y-2">
                                <li>
                                    <strong>COACHES</strong> are responsible for the programming, advice, and analytics they provide to their associated Athletes. Coaches agree to use the platform in a professional manner and respect the privacy of their Athletes.
                                </li>
                                <li>
                                    <strong>ATHLETES</strong> are responsible for accurately entering their training data, submitting authentic technique videos, and communicating truthfully about their physical readiness and limitations.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">4. ACCEPTABLE USE</h2>
                            <p className="mb-4">You agree not to use the Service to:</p>
                            <ul className="list-disc ml-6 pl-6 space-y-2">
                                <li>Upload or share any illegal, harmful, threatening, or explicit content.</li>
                                <li>Share login credentials or access another user&apos;s account without authorization.</li>
                                <li>Attempt to scrape, reverse-engineer, or disrupt the Service&apos;s infrastructure.</li>
                                <li>Upload media files (images or videos) that do not directly pertain to athletic training, coaching, or technique review.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">5. INTELLECTUAL PROPERTY</h2>
                            <p className="mb-4">
                                The BlueprintLab application, its original code, features, design, and analytics algorithms are owned by the developers of BlueprintLab.
                            </p>
                            <p>
                                However, <strong>COACHES RETAIN OWNERSHIP</strong> of the specific intellectual property contained within their custom training programs, methodologies, and communication shared with their Athletes. <strong>ATHLETES RETAIN OWNERSHIP</strong> of their personal performance data and uploaded media.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-bold uppercase mb-4 underline decoration-1 underline-offset-4">6. TERMINATION</h2>
                            <p>
                                We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties, or for any other reason.
                            </p>
                        </section>

                        <section className="border-t border-gray-300 pt-8 mt-12 text-sm text-gray-600 italic">
                            <p>
                                These terms are subject to change. Continued use of the Service following any modifications indicates your acceptance of the new terms.
                            </p>
                        </section>

                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}
