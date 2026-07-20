import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const SECTIONS = [
  {
    href: "/referencias/nova",
    title: "Nova referência",
    description: "Cadastrar acabado e a lista técnica completa de uma vez",
  },
  {
    href: "/materiais",
    title: "Materiais",
    description: "Cadastro de materiais acabados e componentes",
  },
  {
    href: "/boms",
    title: "BOMs",
    description: "Consultar/editar a lista técnica de uma referência já cadastrada",
  },
  {
    href: "/estoque",
    title: "Estoque",
    description: "Consultar e editar estoque atual por material",
  },
  {
    href: "/programas",
    title: "Programa de produção",
    description: "Lançar itens do programa: referência + quantidade",
  },
  {
    href: "/resultado",
    title: "Resultado",
    description: "Necessidade x estoque x a comprar",
  },
];

export default function HomePage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href}>
          <Card className="h-full hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle>{s.title}</CardTitle>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
