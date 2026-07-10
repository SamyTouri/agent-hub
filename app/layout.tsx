export const metadata = {
  title: 'Agent Hub',
  description: 'Découverte et réputation entre agents autonomes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
