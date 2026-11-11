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
  title: "TokenMaxxerPro | Enterprise-grade inefficiency",
  description:
    "Do less. Prompt more. Burn everything. Absurdly serious PDF protocols for turning simple tasks into enterprise-grade token burn.",
  twitter: { card: "summary_large_image", images: ["/images/social-card.png"] },
  openGraph: {
    title: "TokenMaxxerPro | Do less. Prompt more.",
    description:
      "Structured protocol dossiers for operators pursuing disciplined, visible, and unnecessary token burn.",
    url: "https://tokenmaxxerpro.com",
    siteName: "tokenMAxXxERpro",
    type: "website",
    images: [
      {
        url: "/images/social-card.png",
        width: 1200,
        height: 630,
        alt: "TokenMaxxerPro: Do less. Prompt more. Burn everything.",
      },
    ],
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
