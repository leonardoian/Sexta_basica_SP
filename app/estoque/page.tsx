"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EstoqueRow {
  material_id: number;
  codigo: string;
  descricao: string;
  umc: string;
  qtd_atual: string;
  atualizado_em: string | null;
}

export default function EstoquePage() {
  const [linhas, setLinhas] = useState<EstoqueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edicoes, setEdicoes] = useState<Record<number, string>>({});
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const res = await fetch("/api/estoque");
    setLinhas(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    setResultadoImportacao(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/estoque/importar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao importar");
      setResultadoImportacao(
        `${data.atualizados}/${data.total} materiais atualizados` +
          (data.naoEncontrados.length > 0
            ? ` — não encontrados: ${data.naoEncontrados.join(", ")}`
            : "")
      );
      await carregar();
    } catch (err) {
      setResultadoImportacao(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setImportando(false);
      e.target.value = "";
    }
  }

  async function handleSalvar(materialId: number) {
    const valor = edicoes[materialId];
    if (valor === undefined) return;
    setSalvandoId(materialId);
    try {
      await fetch(`/api/estoque/${materialId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtdAtual: valor }),
      });
      setEdicoes((prev) => {
        const next = { ...prev };
        delete next[materialId];
        return next;
      });
      await carregar();
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estoque atual</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-3">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportar}
            disabled={importando}
            className="max-w-xs"
          />
          {importando && <span className="text-sm text-muted-foreground">Importando...</span>}
        </div>
        {resultadoImportacao && (
          <p className="text-sm text-muted-foreground">{resultadoImportacao}</p>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>UMC</TableHead>
                <TableHead>Qtd. atual</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => {
                const editando = edicoes[l.material_id] !== undefined;
                return (
                  <TableRow key={l.material_id}>
                    <TableCell className="font-medium">{l.codigo}</TableCell>
                    <TableCell>{l.descricao}</TableCell>
                    <TableCell>{l.umc}</TableCell>
                    <TableCell className="w-40">
                      <Input
                        type="number"
                        step="any"
                        value={editando ? edicoes[l.material_id] : l.qtd_atual}
                        onChange={(e) =>
                          setEdicoes((prev) => ({
                            ...prev,
                            [l.material_id]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        disabled={!editando || salvandoId === l.material_id}
                        onClick={() => handleSalvar(l.material_id)}
                      >
                        {salvandoId === l.material_id ? "Salvando..." : "Salvar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum material cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
