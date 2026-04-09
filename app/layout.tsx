import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Todo App',
  description: 'A modern todo application with WebAuthn authentication',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
