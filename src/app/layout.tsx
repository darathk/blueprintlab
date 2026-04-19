import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import "./globals.css";
import dynamic from "next/dynamic";

const PushNotificationManager = dynamic(
  () => import("@/components/notifications/PushNotificationManager")
);

const GlobalUploadStatus = dynamic(
  () => import("@/components/chat/GlobalUploadStatus")
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#06b6d4',
};

export const metadata: Metadata = {
  title: 'BlueprintLab',
  description: 'Advanced Athlete Management System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BlueprintLab',
    startupImage: [
      {
        url: '/splash.png',
        media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' // iPhone 15 Pro Max
      },
      {
        url: '/splash.png',
        media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' // iPhone 15 Pro
      }
    ]
  },
  icons: {
    apple: '/apple-touch-icon.png',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={geistSans.variable}>
          <PushNotificationManager />
          <GlobalUploadStatus />
          {children}
          <footer style={{ marginTop: '4rem', padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.8rem', borderTop: '1px solid #333' }}>
            Athlete Analytics Tool v2.0 (Meta-Engine Active)
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
