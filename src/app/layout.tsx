import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata = { title: 'Zibly CMS', description: 'Zibly News Content Management System' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
