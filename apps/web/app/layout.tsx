// Root layout is a passthrough. The real html/body shell lives in
// app/[locale]/layout.tsx so that <html lang> matches the active locale.
// Next.js still requires a root layout — this satisfies that.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
