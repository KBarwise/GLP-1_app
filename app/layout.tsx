import './globals.css';
import { Providers } from './providers';
import { PRODUCT_DESCRIPTION, PRODUCT_FULL_NAME, PRODUCT_NAME } from '@/lib/clinic/branding';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: PRODUCT_FULL_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: PRODUCT_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
