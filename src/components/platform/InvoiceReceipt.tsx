import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { PlatformInvoice } from '../../types';
import {
  X,
  Printer,
  Download,
  MessageSquare,
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle,
  Send,
  Smartphone,
  FileText,
  Receipt as ReceiptIcon,
} from 'lucide-react';

// ============================================================================
// Invoice receipt — mirrors the transaction receipt pattern, but for platform
// subscription billing.
//
// TWO FORMATS from one data source:
//   A4      — a document an institution can file or forward to an accountant
//   THERMAL — 80mm slip, same as the transaction receipt, for counter printing
//
// A PAID invoice prints as a RECEIPT; an unpaid one prints as an INVOICE.
// Calling an unpaid bill a receipt would be wrong, so the wording changes.
//
// When an institution settles a USD invoice in local currency (M-Pesa in KES),
// the receipt shows the local amount and the exchange rate AS RECORDED AT THE
// TIME OF PAYMENT, read from the invoice row. It is never recomputed from
// today's rate, which would misstate what was actually collected.
// ============================================================================

export type InvoiceFormat = 'a4' | 'thermal';

export interface InvoiceReceiptContext {
  institutionName: string;
  issuerName?: string;
  issuerAddress?: string | null;
  issuerEmail?: string | null;
  /** Path under /public, e.g. "/logo.png". */
  logoUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function usd(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function localMoney(value: number | null | undefined, currency: string | null): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${currency ?? ''} ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`.trim();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function periodLabel(startIso: string): string {
  const s = new Date(startIso);
  return Number.isNaN(s.getTime())
    ? startIso
    : s.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/** Scannable payload so an invoice can be verified or looked up later. */
export function invoiceVerificationPayload(inv: PlatformInvoice): string {
  return JSON.stringify({
    inv: inv.invoice_number,
    id: inv.id,
    amt: Number(inv.amount_usd),
    cur: 'USD',
    status: inv.status,
    period: inv.period_start,
  });
}

// ---------------------------------------------------------------------------
// Logo loading — jsPDF.addImage needs the bytes, not a URL, so fetch and
// convert first. Failure is non-fatal: the PDF falls back to text-only.
// ---------------------------------------------------------------------------

async function loadImageAsDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, w: dims.w, h: dims.h };
  } catch (err) {
    console.error('Could not load logo for PDF:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// On-screen preview — A4
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`flex items-start justify-between gap-3 py-1 ${strong ? 'font-bold' : ''}`}>
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-right text-slate-900 break-words min-w-0">{value}</span>
    </div>
  );
}

export function InvoiceSheetA4({
  invoice,
  ctx,
  qrDataUrl,
}: {
  invoice: PlatformInvoice;
  ctx: InvoiceReceiptContext;
  qrDataUrl: string | null;
}) {
  const isPaid = invoice.status === 'paid';
  const usesLocal = invoice.amount_paid_local != null && invoice.fx_rate != null;

  return (
    <div
      id="invoice-sheet"
      className="w-[520px] mx-auto bg-white text-slate-900 p-8 text-[13px] leading-relaxed"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-5">
        <div className="min-w-0">
          {ctx.logoUrl && (
            <img src={ctx.logoUrl} alt="" className="h-12 mb-2 object-contain object-left" />
          )}
          <p className="font-bold text-base">{ctx.issuerName ?? 'Trust Seed'}</p>
          {ctx.issuerAddress && <p className="text-slate-500 text-xs">{ctx.issuerAddress}</p>}
          {ctx.issuerEmail && <p className="text-slate-500 text-xs">{ctx.issuerEmail}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold tracking-tight">{isPaid ? 'RECEIPT' : 'INVOICE'}</p>
          <p className="font-mono text-xs text-slate-500 mt-1">{invoice.invoice_number}</p>
        </div>
      </div>

      <div className="border-t border-slate-300 my-4" />

      {/* Billed to / meta */}
      <div className="grid grid-cols-2 gap-6 mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Billed to
          </p>
          <p className="font-semibold">{ctx.institutionName}</p>
        </div>
        <div className="text-[12px]">
          <Row label="Issued" value={fmtDate(invoice.issued_at)} />
          <Row label="Due" value={fmtDate(invoice.due_at)} />
          {isPaid && <Row label="Paid" value={fmtDate(invoice.paid_at)} />}
          <Row label="Status" value={invoice.status.toUpperCase()} />
        </div>
      </div>

      {/* Line item */}
      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2">
              Description
            </th>
            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="px-3 py-2.5 align-top">
              <p className="font-medium">{planLabel(invoice.plan)} plan subscription</p>
              <p className="text-[11px] text-slate-500">
                {periodLabel(invoice.period_start)} &middot; {fmtDate(invoice.period_start)} to{' '}
                {fmtDate(invoice.period_end)} &middot; {invoice.billing_cycle}
              </p>
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums align-top">
              {usd(invoice.amount_usd)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-end mb-5">
        <div className="w-56">
          <div className="flex items-center justify-between py-2 border-t-2 border-slate-800">
            <span className="font-bold">Total due</span>
            <span className="font-bold text-base tabular-nums">{usd(invoice.amount_usd)}</span>
          </div>
        </div>
      </div>

      {/* Settlement */}
      {isPaid ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-4 mb-5 text-[12px]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-2">
            Payment received
          </p>
          <Row
            label="Method"
            value={
              invoice.payment_method
                ? invoice.payment_method.charAt(0).toUpperCase() + invoice.payment_method.slice(1)
                : '—'
            }
          />
          <Row label="Amount settled" value={usd(invoice.amount_paid_usd ?? invoice.amount_usd)} />
          {usesLocal && (
            <>
              <Row
                label="Local amount"
                value={localMoney(invoice.amount_paid_local, invoice.local_currency)}
              />
              <Row
                label="Exchange rate"
                value={`1 USD = ${Number(invoice.fx_rate).toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })} ${invoice.local_currency ?? ''}`}
              />
            </>
          )}
          <Row label="Reference" value={invoice.provider_reference} />
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-5 text-[12px] text-amber-800">
          This invoice is {invoice.status}. Payment is due by {fmtDate(invoice.due_at)}.
        </div>
      )}

      {invoice.notes && (
        <div className="mb-5 text-[12px]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
          <p className="text-slate-700">{invoice.notes}</p>
        </div>
      )}

      {/* QR */}
      {qrDataUrl && (
        <div className="flex flex-col items-center mt-6">
          <img src={qrDataUrl} alt="Verification QR code" className="w-24 h-24" />
          <p className="text-[9px] text-slate-400 mt-1">Scan to verify this invoice</p>
        </div>
      )}

      <p className="text-center text-[9px] text-slate-400 mt-5">
        All subscription amounts are stated in US Dollars.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// On-screen preview — 80mm thermal
// ---------------------------------------------------------------------------

export function InvoiceSlipThermal({
  invoice,
  ctx,
  qrDataUrl,
}: {
  invoice: PlatformInvoice;
  ctx: InvoiceReceiptContext;
  qrDataUrl: string | null;
}) {
  const isPaid = invoice.status === 'paid';
  const usesLocal = invoice.amount_paid_local != null && invoice.fx_rate != null;

  return (
    <div
      id="invoice-sheet"
      className="w-[300px] mx-auto bg-white text-slate-900 font-mono text-[11px] leading-snug p-4"
    >
      <div className="text-center mb-2">
        {ctx.logoUrl && <img src={ctx.logoUrl} alt="" className="h-10 mx-auto mb-1.5 object-contain" />}
        <p className="font-bold text-sm">{ctx.issuerName ?? 'Trust Seed'}</p>
        {ctx.issuerEmail && <p className="text-slate-600">{ctx.issuerEmail}</p>}
      </div>

      <div className="border-t border-dashed border-slate-400 my-2" />

      <div className="text-center mb-2">
        <p className="font-bold uppercase tracking-wide">
          {isPaid ? 'Payment Receipt' : 'Subscription Invoice'}
        </p>
        <p className="text-slate-500 uppercase">{invoice.status}</p>
      </div>

      <div className="border-t border-dashed border-slate-400 my-2" />

      <Row label="Invoice No." value={invoice.invoice_number} />
      <Row label="Institution" value={ctx.institutionName} />
      <Row label="Period" value={periodLabel(invoice.period_start)} />
      <Row label="Issued" value={fmtDate(invoice.issued_at)} />
      <Row label="Due" value={fmtDate(invoice.due_at)} />
      {isPaid && <Row label="Paid" value={fmtDate(invoice.paid_at)} />}

      <div className="border-t border-dashed border-slate-400 my-2" />

      <Row label="Plan" value={`${planLabel(invoice.plan)} (${invoice.billing_cycle})`} />
      <Row label="Amount" value={usd(invoice.amount_usd)} strong />

      {isPaid && (
        <>
          <div className="border-t border-dashed border-slate-400 my-2" />
          <Row
            label="Method"
            value={
              invoice.payment_method
                ? invoice.payment_method.charAt(0).toUpperCase() + invoice.payment_method.slice(1)
                : '—'
            }
          />
          <Row label="Settled" value={usd(invoice.amount_paid_usd ?? invoice.amount_usd)} strong />
          {usesLocal && (
            <>
              <Row
                label="Local Amount"
                value={localMoney(invoice.amount_paid_local, invoice.local_currency)}
              />
              <Row
                label="Rate Used"
                value={`1 USD = ${Number(invoice.fx_rate).toLocaleString('en-US', {
                  maximumFractionDigits: 4,
                })} ${invoice.local_currency ?? ''}`}
              />
            </>
          )}
          <Row label="Reference" value={invoice.provider_reference} />
        </>
      )}

      {qrDataUrl && (
        <div className="flex flex-col items-center mt-3">
          <img src={qrDataUrl} alt="Verification QR code" className="w-24 h-24" />
          <p className="text-[9px] text-slate-400 mt-1">Scan to verify this invoice</p>
        </div>
      )}

      <p className="text-center text-[9px] text-slate-400 mt-3">
        Amounts stated in US Dollars.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDF — A4
// ---------------------------------------------------------------------------

export async function generateInvoicePdfA4(
  invoice: PlatformInvoice,
  ctx: InvoiceReceiptContext
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = 210;
  const m = 18;
  const isPaid = invoice.status === 'paid';
  let y = 20;

  // Logo
  if (ctx.logoUrl) {
    const logo = await loadImageAsDataUrl(ctx.logoUrl);
    if (logo) {
      const maxH = 16;
      const ratio = logo.w > 0 && logo.h > 0 ? logo.w / logo.h : 1;
      const h = maxH;
      const w = Math.min(h * ratio, 55);
      try {
        doc.addImage(logo.data, 'PNG', m, y - 6, w, h);
        y += h - 2;
      } catch (err) {
        console.error('Could not embed logo:', err);
      }
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(ctx.issuerName ?? 'Trust Seed', m, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let leftY = y + 5;
  if (ctx.issuerAddress) {
    doc.text(ctx.issuerAddress, m, leftY);
    leftY += 4.2;
  }
  if (ctx.issuerEmail) {
    doc.text(ctx.issuerEmail, m, leftY);
    leftY += 4.2;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(isPaid ? 'RECEIPT' : 'INVOICE', pageW - m, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(invoice.invoice_number, pageW - m, 30, { align: 'right' });

  y = Math.max(leftY, 36) + 4;
  doc.setDrawColor(210);
  doc.setLineWidth(0.3);
  doc.line(m, y, pageW - m, y);
  y += 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILLED TO', m, y);
  doc.text('DETAILS', pageW / 2 + 6, y);
  y += 5;

  doc.setFontSize(11);
  doc.text(ctx.institutionName, m, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  let metaY = y;
  const metaRow = (k: string, v: string) => {
    doc.setTextColor(110);
    doc.text(k, pageW / 2 + 6, metaY);
    doc.setTextColor(20);
    doc.text(v, pageW - m, metaY, { align: 'right' });
    metaY += 5;
  };
  metaRow('Issued', fmtDate(invoice.issued_at));
  metaRow('Due', fmtDate(invoice.due_at));
  if (isPaid) metaRow('Paid', fmtDate(invoice.paid_at));
  metaRow('Status', invoice.status.toUpperCase());
  doc.setTextColor(20);

  y = Math.max(y + 10, metaY) + 6;

  const tableW = pageW - m * 2;
  const rowH = 9;
  doc.setFillColor(245, 246, 248);
  doc.rect(m, y, tableW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DESCRIPTION', m + 3, y + 6);
  doc.text('AMOUNT', pageW - m - 3, y + 6, { align: 'right' });
  y += rowH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${planLabel(invoice.plan)} plan subscription`, m + 3, y + 6);
  doc.text(usd(invoice.amount_usd), pageW - m - 3, y + 6, { align: 'right' });
  y += rowH - 2;
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text(
    `${periodLabel(invoice.period_start)}  ·  ${fmtDate(invoice.period_start)} to ${fmtDate(
      invoice.period_end
    )}  ·  ${invoice.billing_cycle}`,
    m + 3,
    y + 4
  );
  doc.setTextColor(20);
  y += 9;

  doc.line(m, y, pageW - m, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total due', pageW - m - 60, y);
  doc.setFontSize(13);
  doc.text(usd(invoice.amount_usd), pageW - m - 3, y, { align: 'right' });
  y += 10;

  if (isPaid) {
    const usesLocal = invoice.amount_paid_local != null && invoice.fx_rate != null;
    const boxH = usesLocal ? 34 : 22;
    doc.setFillColor(240, 250, 245);
    doc.rect(m, y, tableW, boxH, 'F');
    let payY = y + 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('PAYMENT RECEIVED', m + 4, payY);
    payY += 6;
    doc.setFont('helvetica', 'normal');
    const payRow = (k: string, v: string) => {
      doc.setTextColor(110);
      doc.text(k, m + 4, payY);
      doc.setTextColor(20);
      doc.text(v, pageW - m - 4, payY, { align: 'right' });
      payY += 5;
    };
    payRow(
      'Method',
      invoice.payment_method
        ? invoice.payment_method.charAt(0).toUpperCase() + invoice.payment_method.slice(1)
        : '—'
    );
    payRow('Amount settled', usd(invoice.amount_paid_usd ?? invoice.amount_usd));
    if (usesLocal) {
      payRow('Local amount', localMoney(invoice.amount_paid_local, invoice.local_currency));
      payRow(
        'Exchange rate',
        `1 USD = ${Number(invoice.fx_rate).toLocaleString('en-US', {
          maximumFractionDigits: 4,
        })} ${invoice.local_currency ?? ''}`
      );
    }
    if (invoice.provider_reference) payRow('Reference', invoice.provider_reference);
    doc.setTextColor(20);
    y += boxH + 8;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150, 60, 40);
    doc.text(
      `This invoice is ${invoice.status}. Payment is due by ${fmtDate(invoice.due_at)}.`,
      m,
      y
    );
    doc.setTextColor(20);
    y += 10;
  }

  // QR
  try {
    const qr = await QRCode.toDataURL(invoiceVerificationPayload(invoice), {
      width: 220,
      margin: 0,
    });
    const size = 26;
    doc.addImage(qr, 'PNG', pageW / 2 - size / 2, y, size, size);
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text('Scan to verify this invoice', pageW / 2, y + size + 4, { align: 'center' });
    doc.setTextColor(20);
  } catch (err) {
    console.error('Could not embed QR in invoice PDF:', err);
  }

  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('All subscription amounts are stated in US Dollars.', pageW / 2, 278, {
    align: 'center',
  });

  return doc;
}

// ---------------------------------------------------------------------------
// PDF — 80mm thermal
// ---------------------------------------------------------------------------

export async function generateInvoicePdfThermal(
  invoice: PlatformInvoice,
  ctx: InvoiceReceiptContext
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: [80, 210] });
  const mx = 5;
  const isPaid = invoice.status === 'paid';
  let y = 8;

  if (ctx.logoUrl) {
    const logo = await loadImageAsDataUrl(ctx.logoUrl);
    if (logo) {
      const h = 12;
      const ratio = logo.w > 0 && logo.h > 0 ? logo.w / logo.h : 1;
      const w = Math.min(h * ratio, 40);
      try {
        doc.addImage(logo.data, 'PNG', 40 - w / 2, y, w, h);
        y += h + 3;
      } catch (err) {
        console.error('Could not embed logo:', err);
      }
    }
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(ctx.issuerName ?? 'Trust Seed', 40, y, { align: 'center' });
  y += 5;
  if (ctx.issuerEmail) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(ctx.issuerEmail, 40, y, { align: 'center' });
    y += 5;
  }

  doc.setLineDashPattern([1, 1], 0);
  doc.line(mx, y, 80 - mx, y);
  y += 4;

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text(isPaid ? 'Payment Receipt' : 'Subscription Invoice', 40, y, { align: 'center' });
  y += 4;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text(invoice.status.toUpperCase(), 40, y, { align: 'center' });
  y += 4;
  doc.line(mx, y, 80 - mx, y);
  y += 4;

  const row = (k: string, v: string | null | undefined, bold = false) => {
    if (!v) return;
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.text(k, mx, y);
    doc.text(v, 80 - mx, y, { align: 'right' });
    y += 4;
  };
  const divider = () => {
    doc.line(mx, y, 80 - mx, y);
    y += 4;
  };

  row('Invoice No.', invoice.invoice_number);
  row('Institution', ctx.institutionName);
  row('Period', periodLabel(invoice.period_start));
  row('Issued', fmtDate(invoice.issued_at));
  row('Due', fmtDate(invoice.due_at));
  if (isPaid) row('Paid', fmtDate(invoice.paid_at));

  divider();
  row('Plan', `${planLabel(invoice.plan)} (${invoice.billing_cycle})`);
  row('Amount', usd(invoice.amount_usd), true);

  if (isPaid) {
    divider();
    row(
      'Method',
      invoice.payment_method
        ? invoice.payment_method.charAt(0).toUpperCase() + invoice.payment_method.slice(1)
        : '-'
    );
    row('Settled', usd(invoice.amount_paid_usd ?? invoice.amount_usd), true);
    if (invoice.amount_paid_local != null && invoice.fx_rate != null) {
      row('Local Amount', localMoney(invoice.amount_paid_local, invoice.local_currency));
      row(
        'Rate Used',
        `1 USD = ${Number(invoice.fx_rate).toFixed(4)} ${invoice.local_currency ?? ''}`
      );
    }
    row('Reference', invoice.provider_reference);
  }

  try {
    const qr = await QRCode.toDataURL(invoiceVerificationPayload(invoice), {
      width: 200,
      margin: 0,
    });
    y += 2;
    const size = 22;
    doc.addImage(qr, 'PNG', 40 - size / 2, y, size, size);
    y += size + 4;
    doc.setFontSize(6.5);
    doc.text('Scan to verify this invoice', 40, y, { align: 'center' });
    y += 5;
  } catch (err) {
    console.error('Could not embed QR in thermal invoice PDF:', err);
  }

  doc.setFont('courier', 'italic');
  doc.setFontSize(7);
  doc.text('Amounts stated in US Dollars.', 40, y, { align: 'center' });

  return doc;
}

export async function downloadInvoicePdf(
  invoice: PlatformInvoice,
  ctx: InvoiceReceiptContext,
  format: InvoiceFormat = 'a4'
): Promise<void> {
  const doc =
    format === 'thermal'
      ? await generateInvoicePdfThermal(invoice, ctx)
      : await generateInvoicePdfA4(invoice, ctx);
  const kind = invoice.status === 'paid' ? 'receipt' : 'invoice';
  doc.save(`${invoice.invoice_number}-${kind}.pdf`);
}

// ---------------------------------------------------------------------------
// Send hooks
// ---------------------------------------------------------------------------
// These do not send anything themselves. Delivering a message needs a real
// provider (SMS gateway, WhatsApp Business API, email service) with keys that
// must never reach the browser, so each call only invokes a Supabase Edge
// Function and reports what it returns. Until those functions are deployed
// these fail with a clear message rather than pretending to have sent.
// ---------------------------------------------------------------------------

export interface SendResult {
  success: boolean;
  message: string;
}

async function invokeSend(fn: string, body: Record<string, unknown>): Promise<SendResult> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) throw error;
    if (!data || typeof data.success !== 'boolean') {
      return { success: false, message: 'Unexpected response from the send function.' };
    }
    return {
      success: data.success,
      message: data.message || (data.success ? 'Sent' : 'Failed to send'),
    };
  } catch (err) {
    console.error(`Error invoking ${fn}:`, err);
    return {
      success: false,
      message:
        err instanceof Error
          ? `Couldn't send: ${err.message}. Has the "${fn}" Edge Function been deployed?`
          : `Couldn't send. Has the "${fn}" Edge Function been deployed?`,
    };
  }
}

export function sendInvoiceSms(inv: PlatformInvoice, phone: string): Promise<SendResult> {
  if (!phone.trim()) return Promise.resolve({ success: false, message: 'Enter a phone number first.' });
  return invokeSend('send-invoice-sms', { phone: phone.trim(), invoice: inv });
}

export function sendInvoiceWhatsApp(inv: PlatformInvoice, phone: string): Promise<SendResult> {
  if (!phone.trim()) return Promise.resolve({ success: false, message: 'Enter a phone number first.' });
  return invokeSend('send-invoice-whatsapp', { phone: phone.trim(), invoice: inv });
}

export function sendInvoiceEmail(inv: PlatformInvoice, email: string): Promise<SendResult> {
  if (!email.trim()) return Promise.resolve({ success: false, message: 'Enter an email address first.' });
  return invokeSend('send-invoice-email', { email: email.trim(), invoice: inv });
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function InvoiceReceiptModal({
  invoice,
  ctx,
  onClose,
}: {
  invoice: PlatformInvoice;
  ctx: InvoiceReceiptContext;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<InvoiceFormat>('a4');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<'sms' | 'whatsapp' | 'email' | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [showSendPanel, setShowSendPanel] = useState<'sms' | 'whatsapp' | 'email' | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const isPaid = invoice.status === 'paid';

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(invoiceVerificationPayload(invoice), { width: 160, margin: 0 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating invoice QR code:', err);
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [invoice]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice, ctx, format);
    } catch (err) {
      console.error('Error generating invoice PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleSend = async (channel: 'sms' | 'whatsapp' | 'email') => {
    setSendingChannel(channel);
    setSendResult(null);
    try {
      const result =
        channel === 'sms'
          ? await sendInvoiceSms(invoice, phoneInput)
          : channel === 'whatsapp'
          ? await sendInvoiceWhatsApp(invoice, phoneInput)
          : await sendInvoiceEmail(invoice, emailInput);
      setSendResult(result);
    } finally {
      setSendingChannel(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 print:bg-white print:p-0 print:static">
      {/* Print isolation: only the sheet prints, at the right paper size. */}
      <style>{`
        @media print {
          @page { size: ${format === 'thermal' ? '80mm auto' : 'A4 portrait'}; margin: ${
        format === 'thermal' ? '0' : '12mm'
      }; }
          body * { visibility: hidden; }
          #invoice-sheet, #invoice-sheet * { visibility: visible; }
          #invoice-sheet { position: fixed; top: 0; left: 0; width: ${
            format === 'thermal' ? '80mm' : 'auto'
          }; }
          #invoice-modal-chrome { display: none !important; }
        }
      `}</style>

      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden print:shadow-none print:max-h-none print:h-auto print:w-auto">
        <div id="invoice-modal-chrome" className="flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-bold text-[#641f60] flex items-center gap-2">
              {isPaid ? (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              ) : (
                <FileText className="w-5 h-5 text-[#ee7b22]" />
              )}
              {isPaid ? 'Payment Receipt' : 'Subscription Invoice'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
            {/* Format switch */}
            <div className="flex bg-slate-100 rounded-lg p-1 text-sm">
              <button
                onClick={() => setFormat('a4')}
                className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
                  format === 'a4' ? 'bg-white text-[#641f60] shadow-sm' : 'text-slate-500'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                A4 document
              </button>
              <button
                onClick={() => setFormat('thermal')}
                className={`flex-1 px-3 py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
                  format === 'thermal' ? 'bg-white text-[#641f60] shadow-sm' : 'text-slate-500'
                }`}
              >
                <ReceiptIcon className="w-3.5 h-3.5" />
                80mm slip
              </button>
            </div>

            {/* Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto">
              {format === 'a4' ? (
                <InvoiceSheetA4 invoice={invoice} ctx={ctx} qrDataUrl={qrDataUrl} />
              ) : (
                <InvoiceSlipThermal invoice={invoice} ctx={ctx} qrDataUrl={qrDataUrl} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#641f60] hover:bg-[#4a1646] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download PDF
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['sms', 'whatsapp', 'email'] as const).map((channel) => (
                <button
                  key={channel}
                  onClick={() => setShowSendPanel(showSendPanel === channel ? null : channel)}
                  className={`inline-flex flex-col items-center justify-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                    showSendPanel === channel
                      ? 'border-[#1ebcb2] bg-[#1ebcb2]/10 text-[#641f60]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {channel === 'sms' && <MessageSquare className="w-4 h-4" />}
                  {channel === 'whatsapp' && <Smartphone className="w-4 h-4" />}
                  {channel === 'email' && <Mail className="w-4 h-4" />}
                  {channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </button>
              ))}
            </div>

            {showSendPanel && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                {showSendPanel === 'email' ? (
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="finance@institution.co.ke"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                ) : (
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1ebcb2]"
                  />
                )}
                <button
                  onClick={() => handleSend(showSendPanel)}
                  disabled={sendingChannel === showSendPanel}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {sendingChannel === showSendPanel ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send {isPaid ? 'receipt' : 'invoice'}
                </button>
              </div>
            )}

            {sendResult && (
              <div
                className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                  sendResult.success
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-rose-50 text-rose-800'
                }`}
              >
                {sendResult.success ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{sendResult.message}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
            <button
              onClick={onClose}
              className="w-full px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}