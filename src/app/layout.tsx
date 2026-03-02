import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: "So Food Service",
    template: "%s | So Food Service",
  },
  description:
    "Plateforme B2B pour la vente de produits alimentaires avec paiement immediat.",
  metadataBase: new URL("https://sofoodservice.example"),
  openGraph: {
    title: "So Food Service",
    description:
      "Catalogue, commande, paiement immediat, stock, livraison et support pour professionnels.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
