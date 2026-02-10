export const metadata = {
  title: 'AI-Assisted Cloud Config Risk Scanner',
  description: 'Analyze AWS configurations for common security risks',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
