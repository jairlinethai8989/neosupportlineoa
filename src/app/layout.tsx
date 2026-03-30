import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({ 
  subsets: ["latin", "thai"],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-prompt',
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
    <html lang="th">
      <body className={prompt.className}>
        {children}
      </body>
    </html>
  );
}
