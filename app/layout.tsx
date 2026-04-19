import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tokenmaxxerpro.com"),
  title: "tokenMAxXxERpro | Protocol Dossiers for Extraordinary Token Burn",
  description:
    "Structured PDF dossiers for operators who want ordinary tasks processed with maximum procedural heat.",
  openGraph: {
    title: "tokenMAxXxERpro",
    description:
      "Structured protocol dossiers for operators pursuing disciplined, visible, and unnecessary token burn.",
    url: "https://tokenmaxxerpro.com",
    siteName: "tokenMAxXxERpro",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrumentSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
