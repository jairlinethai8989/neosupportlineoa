import { Inter, Prompt, IBM_Plex_Sans_Thai } from 'next/font/google';
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

const ibmPlexThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-thai',
  display: 'swap',
});

export const metadata = {
  title: "Neo Support | Customer Support Omnichannel",
  description: "Enterprise-grade customer support platform for LINE OA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" data-theme="light" className={`${inter.variable} ${prompt.variable} ${ibmPlexThai.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
