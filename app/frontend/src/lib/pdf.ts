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
  doc.text('Sistema de Gestao Pecuaria', margin, y);

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
    ['Tipo de Transacao', dados.tipo === 'COMPRA' ? 'Compra de Gado' : 'Venda de Gado'],
    ['Data', formatDate(dados.data)],
    ['Quantidade de Cabecas', String(dados.qtdCabecas)],
    ['Peso Total (kg)', dados.pesoTotalKg.toFixed(2) + ' kg'],
    ['Peso Total (@)', kgToArrobas(dados.pesoTotalKg).toFixed(2) + ' @'],
    ['Peso Medio/Cabeca (kg)', pesoMedioCab.toFixed(2) + ' kg'],
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
    doc.text('DESCRICAO:', margin, y);
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