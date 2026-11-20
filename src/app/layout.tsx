import { Prompt } from 'next/font/google';
import './globals.css';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

export const metadata = {
  title: 'Neo Support | Customer Support Omnichannel',
  description: 'Enterprise-grade customer support platform for LINE OA',
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved;
    if (saved === 'blue' || saved === 'cyan' || saved === 'gray') {
      theme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else if (saved === 'system') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else if (saved !== 'light' && saved !== 'dark') {
      theme = 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      data-theme="light"
      suppressHydrationWarning
      className={`${prompt.variable} ${prompt.className}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <a href="#main-content" className="skip-link">
          ข้ามไปยังเนื้อหาหลัก / Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
