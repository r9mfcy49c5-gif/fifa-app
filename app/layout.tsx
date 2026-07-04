import './globals.css';

export const metadata = {
  title: 'Lytle Lemon FIFA World Cup Live',
  description: "Corby's Workshop LLC FIFA live family app"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
