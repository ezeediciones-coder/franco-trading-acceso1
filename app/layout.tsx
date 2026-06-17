export const metadata = {
  title: 'Franco Trading | Acceso Comunidad',
  description: 'Verificación de UID para acceso a la comunidad privada de Franco Trading.'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
