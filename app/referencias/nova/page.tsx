"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Material } from "@/lib/types";

const NOVO_COMPONENTE = "__novo__";

interface ItemForm {
  key: string;
  componenteId: string; // valor do Select: id do componente ou NOVO_COMPONENTE
  novoCodigo: string;
  novoDescricao: string;
  novoUmc: string;
  pcsPorUmc: string;
}

function novoItem(): ItemForm {
  return {
    key: crypto.randomUUID(),
    componenteId: "",
    novoCodigo: "",
    novoDescricao: "",
    novoUmc: "PC",
    pcsPorUmc: "",
  };
}

export default function NovaReferenciaPage() {
  const router = useRouter();
  const [componentes, setComponentes] = useState<Material[]>([]);

  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [umc, setUmc] = useState("PC");
  const [itens, setItens] = useState<ItemForm[]>([novoItem()]);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/materiais?tipo=componente")
      .then((r) => r.json())
      .then(setComponentes);
  }, []);

  function atualizarItem(key: string, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function adicionarItem() {
    setItens((prev) => [...prev, novoItem()]);
  }

  function removerItem(key: string) {
    setItens((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const itensPayload = itens.map((it) => {
      if (it.componenteId === NOVO_COMPONENTE) {
        return {
          componenteCodigo: it.novoCodigo,
          componenteDescricao: it.novoDescricao,
          componenteUmc: it.novoUmc,
          pcsPorUmc: Number(it.pcsPorUmc),
        };
      }
      return {
        componenteId: Number(it.componenteId),
        pcsPorUmc: Number(it.pcsPorUmc),
      };
    });

    setSalvando(true);
    try {
      const res = await fetch("/api/referencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, descricao, umc, itens: itensPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar referência");

      router.push(`/boms?materialId=${data.materialId}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Referência (acabado)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="ex: 9057"
              required
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="umc">UMC</Label>
            <Input id="umc" value={umc} onChange={(e) => setUmc(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista técnica</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {itens.map((it) => (
            <div
              key={it.key}
              className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-3 items-end border-b pb-4 last:border-0 last:pb-0"
            >
              <div className="grid gap-1.5">
                <Label>Componente</Label>
                <Select
                  value={it.componenteId}
                  onValueChange={(v) => atualizarItem(it.key, { componenteId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha ou crie um componente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOVO_COMPONENTE}>+ Novo componente</SelectItem>
                    {componentes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.codigo} — {c.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {it.componenteId === NOVO_COMPONENTE && (
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <Input
                      placeholder="Código"
                      value={it.novoCodigo}
                      onChange={(e) => atualizarItem(it.key, { novoCodigo: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="Descrição"
                      value={it.novoDescricao}
                      onChange={(e) =>
                        atualizarItem(it.key, { novoDescricao: e.target.value })
                      }
                      required
                    />
                    <Input
                      placeholder="UMC"
                      value={it.novoUmc}
                      onChange={(e) => atualizarItem(it.key, { novoUmc: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label>Peças por UMC</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={it.pcsPorUmc}
                  onChange={(e) => atualizarItem(it.key, { pcsPorUmc: e.target.value })}
                  placeholder="ex: 6"
                  required
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removerItem(it.key)}
                disabled={itens.length === 1}
              >
                Remover
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={adicionarItem} className="w-fit">
            + Adicionar item
          </Button>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" disabled={salvando} className="w-fit">
        {salvando ? "Salvando..." : "Salvar referência e lista técnica"}
      </Button>
    </form>
  );
}
