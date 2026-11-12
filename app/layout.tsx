import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bessinski.com"),
  title: "BESSINSKI — Site officiel",
  description: "Entre indie pop et rock alternatif, découvrez l’univers de Bessinski : des guitares mélodiques, une voix brute, des chansons et des clips à explorer.",
  openGraph: {
    type: "website",
    siteName: "BESSINSKI",
    locale: "fr_FR",
    description: "Entre indie pop et rock alternatif, découvrez l’univers de Bessinski : des guitares mélodiques, une voix brute, des chansons et des clips à explorer.",
    images: [{ url: "/bess/bessinski-share.png", width: 1200, height: 630, type: "image/png", alt: "BESSINSKI — portrait sur fond bleu et rouge" }],
  },
  twitter: {
    card: "summary_large_image",
    description: "Entre indie pop et rock alternatif, découvrez l’univers de Bessinski : des guitares mélodiques, une voix brute, des chansons et des clips à explorer.",
    images: ["/bess/bessinski-share.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
