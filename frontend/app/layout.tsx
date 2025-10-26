export const metadata = {
  title: "syllaCal",
  description: "syllaCal turns syllabi into study plans and calendar events.",
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Optional header */}
        <header className="p-4 shadow bg-white">
          <h1 className="text-2xl font-semibold">syllaCal</h1>
        </header>
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}