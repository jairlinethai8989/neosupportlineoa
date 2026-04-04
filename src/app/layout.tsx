import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoThai = Noto_Sans_Thai({ 
  subsets: ["latin", "thai"],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-noto-thai',
});

export const metadata: Metadata = {
  title: "Neo Support | Customer Support Omnichannel",
  description: "Enterprise-grade customer support platform for LINE OA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" data-theme="dark">
      <body className={notoThai.className}>
        {children}
      </body>
    </html>
  );
}
