import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebRTC Meet",
  description: "跨裝置視訊會議，即時開始",
};

// viewport-fit=cover allows layout to extend under iPhone notch/home bar
// so we can manually add env(safe-area-inset-*) padding where needed
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="antialiased bg-gray-950 text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
