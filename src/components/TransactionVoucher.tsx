import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import type { ReceiptData } from './TransactionReceipt';

// ============================================================================
// LANDSCAPE US-LETTER REMITTANCE VOUCHER
//
// A second receipt FORMAT that sits alongside the 80mm thermal slip in
// TransactionReceipt.tsx. Used for money transfers / remittances, where a
// full voucher is expected: sender + receiver blocks, an amounts table,
// how the sender paid, a declaration, and signature lines.
//
// It consumes the SAME ReceiptData that buildReceiptData() already produces,
// so nothing about the existing receipt pipeline changes. Fields the voucher
// shows but ReceiptData doesn't carry (sender address/ID, receiver city,
// institution address/phone, payment collection details) are passed in as
// optional extras.
// ============================================================================

export interface VoucherExtras {
  institutionAddress?: string | null;
  institutionPhone?: string | null;
  senderAddress?: string | null;
  senderIdNumber?: string | null;
  receiverCity?: string | null;
  receiverCountry?: string | null;
  purpose?: string | null;
  /** Secondary staff field, as printed on standard remittance forms. */
  conductor?: string | null;
  /** How the sender paid: Cash, M-Pesa, Bank, Card, Cheque. */
  paymentMethod?: string | null;
  /** M-Pesa confirmation code, bank slip number, card auth code. */
  paymentReference?: string | null;
  /** Pre-joined supporting details: phone, bank, account, cheque number. */
  paymentDetails?: string | null;
  /** received | pending | failed | refunded */
  paymentStatus?: string | null;
}

function fmtAmount(value: number, currency: string): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function fmtVoucherDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  const time = d.toTimeString().slice(0, 8);
  return `${day}-${month}-${year} ${time}`;
}

// Funds that have not cleared must be visible on the printed voucher, so a
// cashier can never hand over a payout against an uncleared cheque or an
// unconfirmed bank deposit on the strength of the paper alone.
function fmtPaymentStatus(status?: string | null): string | null {
  if (!status) return null;
  switch (status) {
    case 'received':
      return 'Funds Received';
    case 'pending':
      return 'AWAITING FUNDS - NOT YET CLEARED';
    case 'failed':
      return 'PAYMENT FAILED';
    case 'refunded':
      return 'REFUNDED';
    default:
      return status;
  }
}

function isUncleared(status?: string | null): boolean {
  return status === 'pending' || status === 'failed';
}

function hasPaymentBlock(extras: VoucherExtras): boolean {
  return Boolean(
    extras.paymentMethod || extras.paymentReference || extras.paymentDetails || extras.paymentStatus
  );
}

const DECLARATION =
  'The Company shall not be responsible for delays resulting from incorrect information provided ' +
  'by the sender. Only the amount received, and not the service charge, is refundable. The rate of ' +
  'exchange will be set at the time the refund is requested. Claims arising from delays or ' +
  'interruption of activities including but not limited to acts of God, war, or civil disturbance ' +
  'are excluded. The customer confirms these funds are not derived from and will not be used for ' +
  'any unlawful purpose, including money laundering or the financing of terrorism, and hereby ' +
  'fully releases the Company from all claims or liability relating to this transaction after ' +
  '14 days without complaint.';

// ---------------------------------------------------------------------------
// On-screen / printable voucher sheet
// ---------------------------------------------------------------------------

function VoucherSheet({
  data,
  extras,
  qrDataUrl,
  copyLabel,
}: {
  data: ReceiptData;
  extras: VoucherExtras;
  qrDataUrl: string | null;
  copyLabel: string;
}) {
  const fee = data.chargesAmount ?? 0;
  const total = data.amount + fee;
  const payingAmount = data.amountReceived ?? null;
  const payingCurrency = data.toCurrency ?? null;
  const statusLabel = fmtPaymentStatus(extras.paymentStatus);
  const uncleared = isUncleared(extras.paymentStatus);
  const showPayment = hasPaymentBlock(extras);

  return (
    <div className="voucher-sheet">
      {/* Watermark for uncleared funds, so a photocopy can't be mistaken for
          a settled voucher. */}
      {uncleared && <div className="voucher-watermark">NOT CLEARED</div>}

      {/* Header: institution identity (left) / voucher meta (right) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4in' }}>
        <div style={{ maxWidth: '4.4in' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {data.institutionLogoUrl && (
              <img src={data.institutionLogoUrl} alt="" style={{ height: '0.6in', width: 'auto', objectFit: 'contain' }} />
            )}
            <div>
              <div style={{ fontSize: '17pt', fontWeight: 700, letterSpacing: '0.4px', lineHeight: 1.1 }}>
                {data.institutionName}
              </div>
              {extras.institutionAddress && (
                <div style={{ fontSize: '9pt' }}>{extras.institutionAddress}</div>
              )}
              {extras.institutionPhone && <div style={{ fontSize: '9pt' }}>T: {extras.institutionPhone}</div>}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', minWidth: '3in' }}>
          <div style={{ fontSize: '13pt', fontWeight: 700, textDecoration: 'underline', marginBottom: '4px' }}>
            Send Remittance Receipt
          </div>
          <div style={{ fontSize: '9.5pt' }}>Voucher No : <strong>{data.transactionReference}</strong></div>
          <div style={{ fontSize: '9.5pt' }}>Receipt No : {data.receiptNumber}</div>
          <div style={{ fontSize: '9.5pt' }}>Date : {fmtVoucherDate(data.dateTimeIso)}</div>
          {data.cashierName && <div style={{ fontSize: '9.5pt' }}>Teller : {data.cashierName}</div>}
          {data.branchName && <div style={{ fontSize: '9.5pt' }}>Branch : {data.branchName}</div>}
          {extras.conductor && <div style={{ fontSize: '9.5pt' }}>Conductor : {extras.conductor}</div>}
          <div style={{ fontSize: '8.5pt', marginTop: '3px', fontStyle: 'italic' }}>{copyLabel}</div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid #000', margin: '9px 0' }} />

      {/* Sender */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontWeight: 700, fontSize: '10.5pt', marginBottom: '3px' }}>SENDER</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 24px', fontSize: '10pt' }}>
          <div style={{ minWidth: '3.4in' }}>
            Name : <span className="voucher-dotline">{data.senderName ?? ''}</span>
          </div>
          <div style={{ minWidth: '2.6in' }}>
            Mobile : <span className="voucher-dotline">{data.senderPhone ?? ''}</span>
          </div>
          <div style={{ minWidth: '3.4in' }}>
            Address : <span className="voucher-dotline">{extras.senderAddress ?? ''}</span>
          </div>
          <div style={{ minWidth: '2.6in' }}>
            ID No : <span className="voucher-dotline">{extras.senderIdNumber ?? ''}</span>
          </div>
        </div>
      </div>

      {/* Transfer details table */}
      <div style={{ fontWeight: 700, fontSize: '10.5pt', margin: '8px 0 4px' }}>Transfer Details</div>
      <table className="voucher-table">
        <thead>
          <tr>
            <th style={{ width: '20%' }}>Receiver Name</th>
            <th style={{ width: '15%' }}>Receiver Mobile</th>
            <th style={{ width: '17%' }}>City / Country</th>
            {payingAmount !== null && <th style={{ width: '14%' }}>Paying Amount</th>}
            <th style={{ width: '14%' }}>Sending Amount</th>
            <th style={{ width: '10%' }}>Fee</th>
            <th style={{ width: '14%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{data.receiverName ?? ''}</td>
            <td>{data.receiverPhone ?? ''}</td>
            <td>{[extras.receiverCity, extras.receiverCountry].filter(Boolean).join(' - ')}</td>
            {payingAmount !== null && (
              <td>{fmtAmount(payingAmount, payingCurrency || data.currency)}</td>
            )}
            <td>{fmtAmount(data.amount, data.currency)}</td>
            <td>{fmtAmount(fee, data.chargesCurrency || data.currency)}</td>
            <td style={{ fontWeight: 700 }}>{fmtAmount(total, data.currency)}</td>
          </tr>
        </tbody>
      </table>

      {data.exchangeRate != null && data.exchangeRate > 0 && data.toCurrency && (
        <div style={{ fontSize: '9.5pt', marginTop: '5px' }}>
          Exchange rate applied: 1 {data.currency} ={' '}
          {data.exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {data.toCurrency}
        </div>
      )}

      {/* Payment received from the sender — method, reference and clearing
          state, so the voucher is evidence of how the money came in. */}
      {showPayment && (
        <>
          <div style={{ fontWeight: 700, fontSize: '10.5pt', margin: '9px 0 4px' }}>Payment Received</div>
          <table className="voucher-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Method</th>
                <th style={{ width: '24%' }}>Reference</th>
                <th style={{ width: '36%' }}>Details</th>
                <th style={{ width: '22%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700 }}>{extras.paymentMethod ?? '-'}</td>
                <td style={{ fontFamily: 'Courier New, Courier, monospace' }}>
                  {extras.paymentReference ?? '-'}
                </td>
                <td>{extras.paymentDetails ?? '-'}</td>
                <td style={{ fontWeight: uncleared ? 700 : 400 }}>{statusLabel ?? '-'}</td>
              </tr>
            </tbody>
          </table>
          {uncleared && (
            <div style={{ fontSize: '9pt', marginTop: '4px', fontWeight: 700 }}>
              These funds have not cleared. Do not release the payout against this voucher until the
              payment is confirmed.
            </div>
          )}
        </>
      )}

      {extras.purpose && (
        <div style={{ fontSize: '9.5pt', marginTop: '5px' }}>
          Purpose : <span className="voucher-dotline">{extras.purpose}</span>
        </div>
      )}

      {/* Declaration */}
      <div style={{ marginTop: '10px', fontSize: '8pt', lineHeight: 1.3, textAlign: 'justify' }}>
        <strong style={{ fontSize: '10pt' }}>THANK YOU FOR USING OUR SERVICES</strong>
        <br />
        <strong>Declaration:</strong> {DECLARATION}
      </div>

      {/* Signatures + QR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '18px', fontSize: '10pt' }}>
        <div>
          Customer Signature: <span className="voucher-signline" />
        </div>
        {qrDataUrl && (
          <div style={{ textAlign: 'center' }}>
            <img src={qrDataUrl} alt="Verification QR code" style={{ width: '0.85in', height: '0.85in' }} />
            <div style={{ fontSize: '7pt' }}>Scan to verify</div>
          </div>
        )}
        <div>
          Teller Signature: <span className="voucher-signline" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDF: landscape Letter, drawn with jsPDF so text stays crisp
// ---------------------------------------------------------------------------

export async function generateVoucherPdf(data: ReceiptData, extras: VoucherExtras): Promise<jsPDF> {
  // Letter landscape in mm: 279.4 x 215.9
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' });
  const pageW = 279.4;
  const pageH = 215.9;
  const m = 12;
  const tableW = pageW - m * 2;
  let y = 16;

  const uncleared = isUncleared(extras.paymentStatus);

  // Diagonal watermark for uncleared funds, drawn first so content sits on top.
  if (uncleared) {
    doc.saveGraphicsState();
    // @ts-expect-error GState is available at runtime in jsPDF 2.x
    doc.setGState(new doc.GState({ opacity: 0.12 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(64);
    doc.setTextColor(180, 0, 0);
    doc.text('NOT CLEARED', pageW / 2, pageH / 2, { align: 'center', angle: 30 });
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0);
  }

  // Header left
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.text(data.institutionName, m, y);
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  let leftY = y + 5;
  if (extras.institutionAddress) {
    doc.text(extras.institutionAddress, m, leftY);
    leftY += 4;
  }
  if (extras.institutionPhone) {
    doc.text(`T: ${extras.institutionPhone}`, m, leftY);
    leftY += 4;
  }

  // Header right
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('Send Remittance Receipt', pageW - m, y, { align: 'right' });
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  let rightY = y + 5;
  const rightRow = (label: string, value?: string | null) => {
    if (!value) return;
    doc.text(`${label} : ${value}`, pageW - m, rightY, { align: 'right' });
    rightY += 4;
  };
  rightRow('Voucher No', data.transactionReference);
  rightRow('Receipt No', data.receiptNumber);
  rightRow('Date', fmtVoucherDate(data.dateTimeIso));
  rightRow('Teller', data.cashierName);
  rightRow('Branch', data.branchName);
  rightRow('Conductor', extras.conductor);

  y = Math.max(leftY, rightY) + 2;
  doc.setLineWidth(0.3);
  doc.line(m, y, pageW - m, y);
  y += 6;

  // Sender block
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text('SENDER', m, y);
  y += 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`Name : ${data.senderName ?? ''}`, m, y);
  doc.text(`Mobile : ${data.senderPhone ?? ''}`, m + 130, y);
  y += 5;
  doc.text(`Address : ${extras.senderAddress ?? ''}`, m, y);
  doc.text(`ID No : ${extras.senderIdNumber ?? ''}`, m + 130, y);
  y += 7;

  // Shared single-row table renderer, used for both the transfer details and
  // the payment block so their geometry stays identical.
  const rowH = 8;
  const drawTable = (headers: string[], values: string[], widths: number[], startY: number): number => {
    let ty = startY;
    let x = m;
    doc.setFontSize(9);
    doc.setFont('times', 'bold');
    headers.forEach((h, i) => {
      doc.rect(x, ty, widths[i], rowH);
      doc.text(h, x + 1.5, ty + 5.2);
      x += widths[i];
    });
    ty += rowH;

    x = m;
    doc.setFont('times', 'normal');
    values.forEach((v, i) => {
      doc.rect(x, ty, widths[i], rowH);
      const text = doc.splitTextToSize(String(v), widths[i] - 3)[0] ?? '';
      doc.text(text, x + 1.5, ty + 5.2);
      x += widths[i];
    });
    return ty + rowH;
  };

  // Transfer details table
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text('Transfer Details', m, y);
  y += 4;

  const fee = data.chargesAmount ?? 0;
  const total = data.amount + fee;
  const hasPaying = data.amountReceived != null;

  const headers = hasPaying
    ? ['Receiver Name', 'Mobile', 'City / Country', 'Paying Amount', 'Sending Amount', 'Fee', 'Total']
    : ['Receiver Name', 'Mobile', 'City / Country', 'Sending Amount', 'Fee', 'Total'];
  const values = hasPaying
    ? [
        data.receiverName ?? '',
        data.receiverPhone ?? '',
        [extras.receiverCity, extras.receiverCountry].filter(Boolean).join(' - '),
        fmtAmount(data.amountReceived as number, data.toCurrency || data.currency),
        fmtAmount(data.amount, data.currency),
        fmtAmount(fee, data.chargesCurrency || data.currency),
        fmtAmount(total, data.currency),
      ]
    : [
        data.receiverName ?? '',
        data.receiverPhone ?? '',
        [extras.receiverCity, extras.receiverCountry].filter(Boolean).join(' - '),
        fmtAmount(data.amount, data.currency),
        fmtAmount(fee, data.chargesCurrency || data.currency),
        fmtAmount(total, data.currency),
      ];

  const colW = hasPaying
    ? [tableW * 0.2, tableW * 0.15, tableW * 0.17, tableW * 0.14, tableW * 0.14, tableW * 0.08, tableW * 0.12]
    : [tableW * 0.24, tableW * 0.16, tableW * 0.2, tableW * 0.16, tableW * 0.1, tableW * 0.14];

  y = drawTable(headers, values, colW, y) + 5;

  if (data.exchangeRate != null && data.exchangeRate > 0 && data.toCurrency) {
    doc.setFontSize(9.5);
    doc.text(
      `Exchange rate applied: 1 ${data.currency} = ${data.exchangeRate.toFixed(4)} ${data.toCurrency}`,
      m,
      y
    );
    y += 5;
  }

  // Payment received block
  if (hasPaymentBlock(extras)) {
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.text('Payment Received', m, y);
    y += 4;

    const payHeaders = ['Method', 'Reference', 'Details', 'Status'];
    const payValues = [
      extras.paymentMethod ?? '-',
      extras.paymentReference ?? '-',
      extras.paymentDetails ?? '-',
      fmtPaymentStatus(extras.paymentStatus) ?? '-',
    ];
    const payColW = [tableW * 0.18, tableW * 0.24, tableW * 0.36, tableW * 0.22];
    y = drawTable(payHeaders, payValues, payColW, y) + 4;

    if (uncleared) {
      doc.setFont('times', 'bold');
      doc.setFontSize(9);
      doc.text(
        'These funds have not cleared. Do not release the payout against this voucher until the payment is confirmed.',
        m,
        y
      );
      doc.setFont('times', 'normal');
      y += 5;
    }
  }

  if (extras.purpose) {
    doc.setFontSize(9.5);
    doc.text(`Purpose : ${extras.purpose}`, m, y);
    y += 5;
  }

  // Declaration
  y += 2;
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('THANK YOU FOR USING OUR SERVICES', m, y);
  y += 4.5;
  doc.setFont('times', 'normal');
  doc.setFontSize(7.6);
  const decl = doc.splitTextToSize(`Declaration: ${DECLARATION}`, tableW);
  doc.text(decl, m, y);
  y += decl.length * 3.2 + 6;

  // QR
  try {
    const qr = await QRCode.toDataURL(data.verificationPayload, { width: 200, margin: 0 });
    doc.addImage(qr, 'PNG', pageW / 2 - 11, y - 4, 22, 22);
    doc.setFontSize(6.5);
    doc.text('Scan to verify', pageW / 2, y + 21, { align: 'center' });
  } catch (err) {
    console.error('Error embedding QR code in voucher PDF:', err);
  }

  // Signature lines — clamped so the extra payment block can never push them
  // off the bottom of the sheet.
  const sigY = Math.min(y + 16, pageH - 14);
  doc.setFontSize(10);
  doc.setLineWidth(0.3);
  doc.text('Customer Signature:', m, sigY);
  doc.line(m + 34, sigY + 1, m + 90, sigY + 1);
  doc.text('Teller Signature:', pageW - m - 90, sigY);
  doc.line(pageW - m - 60, sigY + 1, pageW - m, sigY + 1);

  return doc;
}

export async function downloadVoucherPdf(data: ReceiptData, extras: VoucherExtras): Promise<void> {
  const doc = await generateVoucherPdf(data, extras);
  doc.save(`${data.receiptNumber}-voucher.pdf`);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function VoucherModal({
  data,
  extras = {},
  onClose,
  duplicate = true,
}: {
  data: ReceiptData;
  extras?: VoucherExtras;
  onClose: () => void;
  duplicate?: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(data.verificationPayload, { width: 160, margin: 0 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating voucher QR code:', err);
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data.verificationPayload]);

  // Escape closes, matching the transfer sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadVoucherPdf(data, extras);
    } catch (err) {
      console.error('Error generating voucher PDF:', err);
      setDownloadError(err instanceof Error ? err.message : 'Could not generate the PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 overflow-auto p-0 sm:p-4 flex items-start justify-center">
      {/* Print isolation: only the voucher sheets print, in landscape Letter. */}
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 0.35in; }
          body * { visibility: hidden !important; }
          #voucher-print-area, #voucher-print-area * { visibility: visible !important; }
          #voucher-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .voucher-sheet { width: 100% !important; min-height: auto !important; padding: 0 !important; margin: 0 !important; transform: none !important; }
          .voucher-scaler { transform: none !important; width: auto !important; height: auto !important; }
          .voucher-page-break { page-break-before: always; }
          #voucher-modal-chrome { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .voucher-sheet {
          position: relative;
          width: 11in; min-height: 8.5in; padding: 0.45in; margin: 0 auto;
          background: #fff; color: #000;
          font-family: 'Times New Roman', Times, Georgia, serif;
          font-size: 11pt; line-height: 1.35; box-sizing: border-box;
        }
        .voucher-table { width: 100%; border-collapse: collapse; }
        .voucher-table th, .voucher-table td {
          border: 1px solid #000; padding: 6px 8px; text-align: left;
          vertical-align: top; font-size: 10pt;
        }
        .voucher-dotline { border-bottom: 1px dotted #000; display: inline-block; min-width: 2.2in; }
        .voucher-signline { border-bottom: 1px solid #000; display: inline-block; min-width: 2.2in; height: 1.1em; }
        .voucher-watermark {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          transform: rotate(-24deg); pointer-events: none; z-index: 0;
          font-size: 72pt; font-weight: 700; letter-spacing: 6px;
          color: rgba(196, 96, 64, 0.13); white-space: nowrap;
        }
        /* Mobile: the sheet is a fixed 11in wide, so scale it down to fit the
           viewport rather than forcing a horizontal scroll. */
        .voucher-scaler { transform-origin: top left; }
      `}</style>

      <div className="bg-white sm:rounded-xl shadow-2xl my-0 sm:my-2 w-full sm:w-auto max-w-full min-h-full sm:min-h-0">
        <div
          id="voucher-modal-chrome"
          className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 py-3 border-b border-slate-200 sticky top-0 bg-white sm:rounded-t-xl z-10"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <h2 className="text-base sm:text-lg font-bold text-[#641f60] truncate">Remittance Voucher</h2>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => window.print()}
              className="px-3 sm:px-4 py-2 bg-[#641f60] hover:bg-[#4a1646] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden xs:inline">Print</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 sm:px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden xs:inline">PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="mx-3 mt-3 p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-xs sm:text-sm">
            {downloadError}
          </div>
        )}

        <div className="overflow-auto p-2 sm:p-3" style={{ maxWidth: '100vw' }}>
          <div id="voucher-print-area">
            <VoucherSheet data={data} extras={extras} qrDataUrl={qrDataUrl} copyLabel="Customer Copy" />
            {duplicate && (
              <div className="voucher-page-break">
                <VoucherSheet data={data} extras={extras} qrDataUrl={qrDataUrl} copyLabel="Branch Copy" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}