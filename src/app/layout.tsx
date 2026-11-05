import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "chatLOL",
  description: "A simple, friendly AI chat app.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Dark is the default. This runs before paint and switches to light only if the user chose it.
const themeScript = `try{if(localStorage.getItem("chatlol:theme")==="light"){document.documentElement.classList.remove("dark")}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${bricolage.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
