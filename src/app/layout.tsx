import { Kanit } from "next/font/google";
import "./globals.css";

const kanit = Kanit({ 
  subsets: ["latin", "thai"],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-kanit',
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
      <body className={kanit.className}>
        {children}
      </body>
    </html>
  );
}
