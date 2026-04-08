import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const ibmPlex = IBM_Plex_Sans_Thai({ 
  subsets: ["latin", "thai"],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ibm-plex',
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
      <body className={ibmPlex.className}>
        {children}
      </body>
    </html>
  );
}
