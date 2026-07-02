import jsPDF from 'jspdf';
import { formatBRL, formatDate, kgToArrobas, supabase, TABLES } from './supabase';

interface ReciboData {
  tipo: 'COMPRA' | 'VENDA';
  data: string;
  valorTotal: number;
  qtdCabecas: number;
  pesoTotalKg: number;
  valorPorArroba: number;
  descricao: string;
  nomeLote: string;
  nomeUsuario: string;
}

/** Fetch the user's nome_fazenda from profiles, with fallback */
export async function fetchNomeUsuario(userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from(TABLES.profiles)
      .select('nome_fazenda')
      .eq('id', userId)
      .single();
    if (data && data.nome_fazenda) {
      return data.nome_fazenda;
    }
    return 'Produtor Rural';
  } catch {
    return 'Produtor Rural';
  }
}

export function gerarReciboPDF(dados: ReciboData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 25;

  const nomeUsuario = dados.nomeUsuario || 'Produtor Rural';

  // Header bar
  doc.setFillColor(85, 107, 47);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MANEJO CERTO', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestão Pecuária', margin, y);

  // Tipo badge
  const tipoText = dados.tipo === 'COMPRA' ? 'RECIBO DE COMPRA' : 'RECIBO DE VENDA';
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const tipoWidth = doc.getTextWidth(tipoText) + 16;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - margin - tipoWidth, 14, tipoWidth, 18, 3, 3, 'F');
  doc.setTextColor(85, 107, 47);
  doc.text(tipoText, pageWidth - margin - tipoWidth + 8, 26);

  y = 55;

  // Date and document info
  doc.setTextColor(54, 69, 79);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Data: ' + formatDate(dados.data), margin, y);
  const emitidoText = 'Emitido por: ' + nomeUsuario;
  doc.text(emitidoText, pageWidth - margin - doc.getTextWidth(emitidoText), y);
  y += 5;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // Lote info
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(85, 107, 47);
  doc.text('Lote: ' + dados.nomeLote, margin, y);
  y += 12;

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 5, pageWidth - margin * 2, 12, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('ITEM', margin + 4, y + 2);
  doc.text('VALOR', pageWidth - margin - 4, y + 2, { align: 'right' });
  y += 14;

  // Table rows
  const pesoMedioCab = dados.qtdCabecas > 0 ? dados.pesoTotalKg / dados.qtdCabecas : 0;
  const rows = [
    ['Tipo de Transação', dados.tipo === 'COMPRA' ? 'Compra de Gado' : 'Venda de Gado'],
    ['Data', formatDate(dados.data)],
    ['Quantidade de Cabeças', String(dados.qtdCabecas)],
    ['Peso Total (kg)', dados.pesoTotalKg.toFixed(2) + ' kg'],
    ['Peso Total (@)', kgToArrobas(dados.pesoTotalKg).toFixed(2) + ' @'],
    ['Peso Médio/Cabeça (kg)', pesoMedioCab.toFixed(2) + ' kg'],
    ['Valor por Arroba (@)', formatBRL(dados.valorPorArroba)],
    ['Valor Total', formatBRL(dados.valorTotal)],
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  rows.forEach(([label, value], idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 5, pageWidth - margin * 2, 10, 'F');
    }
    doc.setTextColor(80, 80, 80);
    doc.text(label, margin + 4, y + 1);
    const isTotal = label === 'Valor Total';
    if (isTotal) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(85, 107, 47);
      doc.setFontSize(12);
    } else {
      doc.setTextColor(54, 69, 79);
    }
    doc.text(value, pageWidth - margin - 4, y + 1, { align: 'right' });
    if (isTotal) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
    }
    y += 10;
  });

  y += 5;

  // Description
  if (dados.descricao) {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('DESCRIÇÃO:', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(54, 69, 79);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(dados.descricao, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 6 + 5;
  }

  // Signature area
  y = Math.max(y + 20, 210);
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([2, 2], 0);

  const sigWidth = (pageWidth - margin * 2 - 30) / 2;
  doc.line(margin, y, margin + sigWidth, y);
  doc.line(pageWidth - margin - sigWidth, y, pageWidth - margin, y);

  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Comprador', margin + sigWidth / 2, y, { align: 'center' });
  doc.text('Vendedor', pageWidth - margin - sigWidth / 2, y, { align: 'center' });

  // Footer
  doc.setLineDashPattern([], 0);
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Documento gerado pelo sistema Manejo Certo', margin, footerY);
  doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), pageWidth - margin, footerY, { align: 'right' });

  // Save
  const filename = 'recibo_' + dados.tipo.toLowerCase() + '_' + dados.nomeLote.replace(/\s+/g, '_') + '_' + dados.data + '.pdf';
  doc.save(filename);
}

// ─── Relatório financeiro (PDF + CSV) ───────────────────────────────

interface RelatorioTransacao {
  data: string;
  tipo: 'RECEITA' | 'DESPESA';
  categoria: string; // já traduzido (label)
  valor: number;
  descricao: string;
}

export interface RelatorioData {
  dataInicial: string; // yyyy-mm-dd
  dataFinal: string; // yyyy-mm-dd
  nomeUsuario: string;
  totalEntradas: number;
  totalSaidas: number;
  saldoLiquido: number;
  despesasPorCategoria: Array<{ name: string; value: number }>;
  transacoes: RelatorioTransacao[];
}

const brDate = (iso: string) => iso.split('-').reverse().join('/');

export function gerarRelatorioPDF(dados: RelatorioData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = 25;

  const nomeUsuario = dados.nomeUsuario || 'Produtor Rural';
  const periodo = brDate(dados.dataInicial) + ' a ' + brDate(dados.dataFinal);

  // Header bar
  doc.setFillColor(85, 107, 47);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MANEJO CERTO', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório Financeiro', margin, y);

  // Period badge
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const badgeWidth = doc.getTextWidth(periodo) + 16;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - margin - badgeWidth, 15, badgeWidth, 16, 3, 3, 'F');
  doc.setTextColor(85, 107, 47);
  doc.text(periodo, pageWidth - margin - badgeWidth + 8, 25);

  y = 52;
  doc.setTextColor(54, 69, 79);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Emitido por: ' + nomeUsuario, margin, y);
  y += 10;

  // KPI cards
  const kpis: Array<[string, string, [number, number, number]]> = [
    ['Total entradas', formatBRL(dados.totalEntradas), [5, 122, 85]],
    ['Total saídas', formatBRL(dados.totalSaidas), [220, 38, 38]],
    ['Saldo líquido', formatBRL(dados.saldoLiquido), dados.saldoLiquido >= 0 ? [5, 122, 85] : [220, 38, 38]],
  ];
  const gap = 6;
  const kpiWidth = (pageWidth - margin * 2 - gap * 2) / 3;
  kpis.forEach(([label, value, color], i) => {
    const x = margin + i * (kpiWidth + gap);
    doc.setFillColor(248, 249, 248);
    doc.roundedRect(x, y, kpiWidth, 22, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), x + 4, y + 7);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x + 4, y + 16);
  });
  y += 34;

  // Despesas por categoria
  if (dados.despesasPorCategoria.length > 0) {
    const totalDespesas = dados.despesasPorCategoria.reduce((s, d) => s + d.value, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(85, 107, 47);
    doc.text('Despesas por categoria', margin, y);
    y += 8;
    doc.setFontSize(9);
    dados.despesasPorCategoria.forEach((item) => {
      const pct = totalDespesas > 0 ? ((item.value / totalDespesas) * 100).toFixed(1) : '0';
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(item.name, margin + 2, y);
      doc.setTextColor(54, 69, 79);
      doc.text(formatBRL(item.value) + '  (' + pct + '%)', pageWidth - margin - 2, y, { align: 'right' });
      y += 6;
    });
    y += 6;
  }

  // Transactions table
  const drawTableHeader = () => {
    doc.setFillColor(85, 107, 47);
    doc.rect(margin, y - 5, pageWidth - margin * 2, 9, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('DATA', margin + 3, y + 1);
    doc.text('TIPO', margin + 30, y + 1);
    doc.text('CATEGORIA', margin + 52, y + 1);
    doc.text('VALOR', pageWidth - margin - 3, y + 1, { align: 'right' });
    y += 10;
  };

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(85, 107, 47);
  doc.text('Lançamentos (' + dados.transacoes.length + ')', margin, y);
  y += 8;
  drawTableHeader();

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  dados.transacoes.forEach((t, idx) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 25;
      drawTableHeader();
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 249, 248);
      doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F');
    }
    doc.setTextColor(80, 80, 80);
    doc.text(brDate(t.data), margin + 3, y);
    doc.setTextColor(t.tipo === 'RECEITA' ? 5 : 220, t.tipo === 'RECEITA' ? 122 : 38, t.tipo === 'RECEITA' ? 85 : 38);
    doc.text(t.tipo === 'RECEITA' ? 'Receita' : 'Despesa', margin + 30, y);
    doc.setTextColor(80, 80, 80);
    const cat = doc.splitTextToSize(t.categoria, 55)[0];
    doc.text(cat, margin + 52, y);
    doc.setTextColor(t.tipo === 'RECEITA' ? 5 : 220, t.tipo === 'RECEITA' ? 122 : 38, t.tipo === 'RECEITA' ? 85 : 38);
    doc.text((t.tipo === 'RECEITA' ? '+ ' : '- ') + formatBRL(t.valor), pageWidth - margin - 3, y, { align: 'right' });
    y += 8;
  });

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 12;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Gerado pelo Manejo Certo em ' + new Date().toLocaleString('pt-BR'), margin, footerY);
    doc.text('Página ' + p + ' de ' + pageCount, pageWidth - margin, footerY, { align: 'right' });
  }

  doc.save('relatorio_' + dados.dataInicial + '_a_' + dados.dataFinal + '.pdf');
}

export function gerarRelatorioCSV(dados: RelatorioData) {
  const sep = ';'; // Excel pt-BR usa ponto-e-vírgula
  const num = (v: number) => v.toFixed(2).replace('.', ','); // decimal com vírgula
  const esc = (s: string) => '"' + (s || '').replace(/"/g, '""') + '"';

  const linhas: string[] = [];
  linhas.push('Relatório Financeiro - Manejo Certo');
  linhas.push('Período' + sep + brDate(dados.dataInicial) + ' a ' + brDate(dados.dataFinal));
  linhas.push('Emitido por' + sep + esc(dados.nomeUsuario || 'Produtor Rural'));
  linhas.push('');
  linhas.push('Total entradas' + sep + num(dados.totalEntradas));
  linhas.push('Total saídas' + sep + num(dados.totalSaidas));
  linhas.push('Saldo líquido' + sep + num(dados.saldoLiquido));
  linhas.push('');
  linhas.push(['Data', 'Tipo', 'Categoria', 'Valor', 'Descrição'].join(sep));
  dados.transacoes.forEach((t) => {
    linhas.push([
      brDate(t.data),
      t.tipo === 'RECEITA' ? 'Receita' : 'Despesa',
      esc(t.categoria),
      num(t.valor),
      esc(t.descricao),
    ].join(sep));
  });

  // BOM para acentos abrirem certo no Excel
  const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio_' + dados.dataInicial + '_a_' + dados.dataFinal + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}