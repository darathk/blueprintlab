import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'BlueprintLab',
  description: 'Advanced Athlete Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
          {children}
          <footer style={{ marginTop: '4rem', padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.8rem', borderTop: '1px solid #333' }}>
            Athlete Analytics Tool v2.0 (Meta-Engine Active)
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
