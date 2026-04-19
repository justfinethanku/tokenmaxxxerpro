import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tokenmaxxerpro.com"),
  title: "TokenMaxxerPro | Brand New Technology for Extraordinary Token Consumption",
  description:
    "Real token burn protocols for professionals who believe no request should survive first contact with orchestration.",
  openGraph: {
    title: "TokenMaxxerPro",
    description:
      "Convert tiny prompts into wildly overbuilt token burn protocols, delivered as polished PDFs.",
    url: "https://tokenmaxxerpro.com",
    siteName: "TokenMaxxerPro",
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
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
