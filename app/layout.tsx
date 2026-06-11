import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureExam — Anti-Leak Exam Distribution System",
  description: "A cryptographically secured, multi-signature exam paper distribution system with AES-256 encryption and time-lock mechanisms.",
  keywords: "exam security, encrypted exam, anti-leak, multi-signature, time-lock",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="page-grid">
        {children}
      </body>
    </html>
  );
}
