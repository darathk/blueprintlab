import React from 'react';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="footer-glow mt-auto bg-slate-950/80 border-t border-cyan-900/40 backdrop-blur-md py-8 mt-12">
            <div className="container mx-auto px-4 max-w-6xl">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start gap-2">
                        <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                            BlueprintLab
                        </span>
                        <span className="text-sm text-slate-400">
                            Advanced Athlete Management System
                        </span>
                    </div>

                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium">
                        <Link
                            href="/"
                            className="text-slate-400 hover:text-cyan-400 transition-colors duration-200"
                        >
                            Home
                        </Link>
                        <Link
                            href="/privacy"
                            className="text-slate-400 hover:text-cyan-400 transition-colors duration-200"
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            href="/terms"
                            className="text-slate-400 hover:text-cyan-400 transition-colors duration-200"
                        >
                            Terms of Service
                        </Link>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-800/50 flex flex-col items-center text-xs text-slate-500">
                    <p>© {new Date().getFullYear()} BlueprintLab. All rights reserved.</p>
                    <p className="mt-2 text-center max-w-2xl text-[10px] leading-relaxed opacity-70">
                        For professional coaches and athletes. Not a substitute for medical advice or professional healthcare.
                    </p>
                </div>
            </div>
        </footer>
    );
}
