"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import type { Material } from "@/lib/types";

interface BomItemView {
  id: number;
  componente_id: number;
  componente_codigo: string;
  componente_descricao: string;
  componente_umc: string;
  pcs_por_umc: string;
}

function BomsContent() {
  const searchParams = useSearchParams();
  const [acabados, setAcabados] = useState<Material[]>([]);
  const [componentes, setComponentes] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState<string>(searchParams.get("materialId") ?? "");
  const [bomId, setBomId] = useState<number | null>(null);
  const [itens, setItens] = useState<BomItemView[]>([]);
  const [loadingBom, setLoadingBom] = useState(false);

  const [componenteId, setComponenteId] = useState<string>("");
  const [pcsPorUmc, setPcsPorUmc] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/materiais?tipo=acabado")
      .then((r) => r.json())
      .then(setAcabados);
    fetch("/api/materiais?tipo=componente")
      .then((r) => r.json())
      .then(setComponentes);
    if (materialId) {
      carregarBom(materialId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarBom(idMaterial: string) {
    if (!idMaterial) {
      setBomId(null);
      setItens([]);
      return;
    }
    setLoadingBom(true);
    setErro(null);
    try {
      const res = await fetch("/api/boms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: idMaterial }),
      });
      const bom = await res.json();
      setBomId(bom.id);

      const itensRes = await fetch(`/api/boms/${bom.id}/itens`);
      setItens(await itensRes.json());
    } catch {
      setErro("Erro ao carregar BOM.");
    } finally {
      setLoadingBom(false);
    }
  }

  function handleSelecionarAcabado(v: string) {
    setMaterialId(v);
    setResultadoImportacao(null);
    carregarBom(v);
  }

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const acabado = acabados.find((a) => String(a.id) === materialId);
    if (!file || !acabado) return;
    setImportando(true);
    setResultadoImportacao(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("materialCodigo", acabado.codigo);
      const res = await fetch("/api/boms/importar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao importar");
      setResultadoImportacao(
        `${data.importados}/${data.total} componentes importados` +
          (data.naoEncontrados.length > 0
            ? ` — não encontrados: ${data.naoEncontrados.join(", ")}`
            : "")
      );
      await carregarBom(materialId);
    } catch (err) {
      setResultadoImportacao(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setImportando(false);
      e.target.value = "";
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!bomId) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/boms/${bomId}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componenteId, pcsPorUmc }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao adicionar componente");
      }
      setComponenteId("");
      setPcsPorUmc("");
      const itensRes = await fetch(`/api/boms/${bomId}/itens`);
      setItens(await itensRes.json());
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSalvando(false);
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (!bomId) return;
    await fetch(`/api/boms/${bomId}/itens/${itemId}`, { method: "DELETE" });
    const itensRes = await fetch(`/api/boms/${bomId}/itens`);
    setItens(await itensRes.json());
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Selecionar acabado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Select value={materialId} onValueChange={handleSelecionarAcabado}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o material acabado" />
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
        </CardContent>
      </Card>

      {materialId && (
        <Card>
          <CardHeader>
            <CardTitle>Lista técnica (BOM)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportar}
                disabled={importando}
                className="max-w-xs"
              />
              {importando && (
                <span className="text-sm text-muted-foreground">Importando...</span>
              )}
            </div>
            {resultadoImportacao && (
              <p className="text-sm text-muted-foreground">{resultadoImportacao}</p>
            )}

            <form
              onSubmit={handleAddItem}
              className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-end"
            >
              <div className="grid gap-1.5">
                <Label>Componente</Label>
                <Select value={componenteId} onValueChange={setComponenteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o componente" />
                  </SelectTrigger>
                  <SelectContent>
                    {componentes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.codigo} — {c.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Peças por UMC</Label>
                <Input
                  value={pcsPorUmc}
                  onChange={(e) => setPcsPorUmc(e.target.value)}
                  placeholder="ex: 6"
                  type="number"
                  min="0"
                  step="any"
                  required
                />
              </div>
              <Button type="submit" disabled={salvando || !componenteId}>
                {salvando ? "Adicionando..." : "Adicionar"}
              </Button>
            </form>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            {loadingBom ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Componente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>UMC</TableHead>
                    <TableHead>Peças por UMC</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.componente_codigo}</TableCell>
                      <TableCell>{it.componente_descricao}</TableCell>
                      <TableCell>{it.componente_umc}</TableCell>
                      <TableCell>{it.pcs_por_umc}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(it.id)}>
                          Remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {itens.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum componente na BOM ainda.
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

export default function BomsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando...</p>}>
      <BomsContent />
    </Suspense>
  );
}
