import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scourr — Trade Show Orders',
  description: 'Order-taking app for Scourr reusable cleaning cloths at trade shows.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
