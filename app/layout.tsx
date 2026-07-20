import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planej. Compras",
  description: "Planejamento de necessidade de compras a partir de BOM",
};

const NAV_ITEMS = [
  { href: "/referencias/nova", label: "Nova referência" },
  { href: "/materiais", label: "Materiais" },
  { href: "/boms", label: "BOMs" },
  { href: "/estoque", label: "Estoque" },
  { href: "/programas", label: "Programa" },
  { href: "/resultado", label: "Resultado" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b">
            <div className="container flex h-14 items-center gap-6">
              <span className="font-semibold">Planej. Compras</span>
              <nav className="flex gap-4 text-sm">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </header>
          <main className="container flex-1 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
