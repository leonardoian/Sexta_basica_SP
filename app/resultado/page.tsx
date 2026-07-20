"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { Programa, ResultadoCalculoRow } from "@/lib/types";

function ResultadoContent() {
  const searchParams = useSearchParams();
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [programaId, setProgramaId] = useState(searchParams.get("programaId") ?? "");
  const [linhas, setLinhas] = useState<ResultadoCalculoRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/programas")
      .then((r) => r.json())
      .then(setProgramas);
  }, []);

  useEffect(() => {
    if (!programaId) {
      setLinhas([]);
      return;
    }
    setLoading(true);
    fetch(`/api/calculo?programaId=${programaId}`)
      .then((r) => r.json())
      .then(setLinhas)
      .finally(() => setLoading(false));
  }, [programaId]);

  function handleExportar() {
    const dados = linhas.map((l) => ({
      Componente: l.componente_codigo,
      Descrição: l.componente_descricao,
      UMC: l.umc,
      "Necessidade total": Number(l.necessidade_total),
      "Estoque atual": Number(l.estoque_atual),
      "A comprar": Number(l.a_comprar),
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Necessidade de compra");
    const programaNome = programas.find((p) => String(p.id) === programaId)?.nome ?? programaId;
    XLSX.writeFile(wb, `necessidade-compra-${programaNome}.xlsx`);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Resultado do cálculo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
          <div className="grid gap-1.5 max-w-sm w-full">
            <Select value={programaId} onValueChange={setProgramaId}>
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
          <Button onClick={handleExportar} disabled={linhas.length === 0}>
            Exportar Excel
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Calculando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Componente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>UMC</TableHead>
                  <TableHead className="text-right">Necessidade total</TableHead>
                  <TableHead className="text-right">Estoque atual</TableHead>
                  <TableHead className="text-right">A comprar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => {
                  const aComprar = Number(l.a_comprar);
                  return (
                    <TableRow
                      key={l.componente_id}
                      className={cn(aComprar > 0 && "bg-destructive/10")}
                    >
                      <TableCell className="font-medium">{l.componente_codigo}</TableCell>
                      <TableCell>{l.componente_descricao}</TableCell>
                      <TableCell>{l.umc}</TableCell>
                      <TableCell className="text-right">{l.necessidade_total}</TableCell>
                      <TableCell className="text-right">{l.estoque_atual}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold",
                          aComprar > 0 && "text-destructive"
                        )}
                      >
                        {l.a_comprar}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {programaId
                        ? "Nenhum componente calculado para este programa."
                        : "Escolha um programa para calcular."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResultadoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando...</p>}>
      <ResultadoContent />
    </Suspense>
  );
}
