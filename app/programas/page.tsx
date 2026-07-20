"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Material, Programa } from "@/lib/types";

interface ProgramaItemView {
  id: number;
  material_id: number;
  material_codigo: string;
  material_descricao: string;
  qtd_produzir: string;
}

export default function ProgramasPage() {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [acabados, setAcabados] = useState<Material[]>([]);
  const [programaId, setProgramaId] = useState<string>("");
  const [itens, setItens] = useState<ProgramaItemView[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const [nomeNovoPrograma, setNomeNovoPrograma] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [qtdProduzir, setQtdProduzir] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregarProgramas() {
    const res = await fetch("/api/programas");
    setProgramas(await res.json());
  }

  useEffect(() => {
    carregarProgramas();
    fetch("/api/materiais?tipo=acabado")
      .then((r) => r.json())
      .then(setAcabados);
  }, []);

  async function carregarItens(id: string) {
    if (!id) {
      setItens([]);
      return;
    }
    setLoadingItens(true);
    const res = await fetch(`/api/programas/${id}/itens`);
    setItens(await res.json());
    setLoadingItens(false);
  }

  function handleSelecionarPrograma(v: string) {
    setProgramaId(v);
    carregarItens(v);
  }

  async function handleCriarPrograma(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeNovoPrograma) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/programas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeNovoPrograma }),
      });
      if (!res.ok) throw new Error("Erro ao criar programa");
      const novo: Programa = await res.json();
      setNomeNovoPrograma("");
      await carregarProgramas();
      setProgramaId(String(novo.id));
      setItens([]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSalvando(false);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!programaId) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/programas/${programaId}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId, qtdProduzir }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao adicionar item");
      }
      setMaterialId("");
      setQtdProduzir("");
      await carregarItens(programaId);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSalvando(false);
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (!programaId) return;
    await fetch(`/api/programas/${programaId}/itens/${itemId}`, { method: "DELETE" });
    await carregarItens(programaId);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Programa de produção</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Programa existente</Label>
            <Select value={programaId} onValueChange={handleSelecionarPrograma}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um programa" />
              </SelectTrigger>
              <SelectContent>
                {programas.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nome} ({p.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <form onSubmit={handleCriarPrograma} className="grid gap-1.5">
            <Label>Novo programa</Label>
            <div className="flex gap-2">
              <Input
                value={nomeNovoPrograma}
                onChange={(e) => setNomeNovoPrograma(e.target.value)}
                placeholder="ex: Programa semana 30"
              />
              <Button type="submit" disabled={salvando || !nomeNovoPrograma}>
                Criar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {programaId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Itens do programa</CardTitle>
              <Link href={`/resultado?programaId=${programaId}`}>
                <Button variant="outline">Ver resultado</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            <form
              onSubmit={handleAddItem}
              className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-end"
            >
              <div className="grid gap-1.5">
                <Label>Referência (acabado)</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a referência" />
                  </SelectTrigger>
                  <SelectContent>
                    {acabados.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.codigo} — {a.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Qtd. a produzir</Label>
                <Input
                  value={qtdProduzir}
                  onChange={(e) => setQtdProduzir(e.target.value)}
                  type="number"
                  min="0"
                  step="any"
                  required
                />
              </div>
              <Button type="submit" disabled={salvando || !materialId}>
                {salvando ? "Adicionando..." : "Adicionar"}
              </Button>
            </form>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            {loadingItens ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referência</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Qtd. a produzir</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.material_codigo}</TableCell>
                      <TableCell>{it.material_descricao}</TableCell>
                      <TableCell>{it.qtd_produzir}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(it.id)}>
                          Remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {itens.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhum item no programa ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
