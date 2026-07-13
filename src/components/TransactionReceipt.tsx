import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
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
} from 'lucide-react';

// ============================================================================
// Receipt data model — deliberately generic so ONE component covers every
// transaction type (deposit, withdrawal, transfer, forex, loan disbursement/
// repayment, savings, float top-up). Fields that only apply to some types
// (exchange rate, sender/receiver, remaining float) are optional; the
// component only renders the rows that have a value.
// ============================================================================

export interface ReceiptData {
  institutionName: string;
  institutionLogoUrl?: string | null;
  branchName?: string | null;
  transactionReference: string;
  receiptNumber: string;
  transactionType: string;
  status: string;
  dateTimeIso: string;
  customerName?: string | null;
  customerAccountNumber?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  amount: number;
  currency: string;
  chargesAmount?: number | null;
  chargesCurrency?: string | null;
  exchangeRate?: number | null;
  toCurrency?: string | null;
  amountReceived?: number | null;
  remainingWalletBalance?: number | null;
  remainingWalletCurrency?: string | null;
  remainingFloatBalance?: number | null;
  remainingFloatCurrency?: string | null;
  cashierName?: string | null;
  // Encoded into the QR code so a receipt can be scanned and looked up /
  // verified later. Keep this small — QR codes get dense fast.
  verificationPayload: string;
}

export interface BuildReceiptParams {
  institutionName: string;
  institutionLogoUrl?: string | null;
  branchName?: string | null;
  transactionId: string;
  reference: string;
  transactionType: string;
  status: string;
  createdAtIso: string;
  customerName?: string | null;
  customerAccountNumber?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  amount: number;
  currency: string;
  chargesAmount?: number | null;
  chargesCurrency?: string | null;
  exchangeRate?: number | null;
  toCurrency?: string | null;
  amountReceived?: number | null;
  remainingWalletBalance?: number | null;
  remainingWalletCurrency?: string | null;
  remainingFloatBalance?: number | null;
  remainingFloatCurrency?: string | null;
  cashierName?: string | null;
}

// Builds a ReceiptData object from whatever a given page has on hand right
// after a transaction succeeds (or when reprinting an old one from a stored
// transaction row). Every page that creates transactions calls this the
// same way, so the receipt is consistent no matter where it was generated.
export function buildReceiptData(p: BuildReceiptParams): ReceiptData {
  const verificationPayload = JSON.stringify({
    ref: p.reference,
    txId: p.transactionId,
    amount: p.amount,
    currency: p.currency,
    type: p.transactionType,
    date: p.createdAtIso,
  });
  return {
    institutionName: p.institutionName,
    institutionLogoUrl: p.institutionLogoUrl ?? null,
    branchName: p.branchName ?? null,
    transactionReference: p.reference,
    receiptNumber: `RCPT-${p.reference}`,
    transactionType: p.transactionType,
    status: p.status,
    dateTimeIso: p.createdAtIso,
    customerName: p.customerName ?? null,
    customerAccountNumber: p.customerAccountNumber ?? null,
    senderName: p.senderName ?? null,
    senderPhone: p.senderPhone ?? null,
    receiverName: p.receiverName ?? null,
    receiverPhone: p.receiverPhone ?? null,
    amount: p.amount,
    currency: p.currency,
    chargesAmount: p.chargesAmount ?? null,
    chargesCurrency: p.chargesCurrency ?? null,
    exchangeRate: p.exchangeRate ?? null,
    toCurrency: p.toCurrency ?? null,
    amountReceived: p.amountReceived ?? null,
    remainingWalletBalance: p.remainingWalletBalance ?? null,
    remainingWalletCurrency: p.remainingWalletCurrency ?? null,
    remainingFloatBalance: p.remainingFloatBalance ?? null,
    remainingFloatCurrency: p.remainingFloatCurrency ?? null,
    cashierName: p.cashierName ?? null,
    verificationPayload,
  };
}

function fmt(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// The printable/downloadable receipt itself — narrow, thermal-receipt-width
// layout. Rendered identically on screen, in the print view, and (via
// generateReceiptPdf below) in the downloaded PDF, so what the cashier sees
// is exactly what gets printed or saved.
// ============================================================================

function ReceiptRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`flex items-start justify-between gap-3 py-0.5 ${strong ? 'font-bold' : ''}`}>
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-right text-slate-900 break-words min-w-0">{value}</span>
    </div>
  );
}

export function ReceiptSlip({ data, qrDataUrl }: { data: ReceiptData; qrDataUrl: string | null }) {
  const hasParties = data.senderName || data.receiverName;
  return (
    <div id="receipt-slip" className="w-[300px] mx-auto bg-white text-slate-900 font-mono text-[11px] leading-snug p-4">
      {/* Header */}
      <div className="text-center mb-2">
        {data.institutionLogoUrl && (
          <img src={data.institutionLogoUrl} alt="" className="h-10 mx-auto mb-1.5 object-contain" />
        )}
        <p className="font-bold text-sm">{data.institutionName}</p>
        {data.branchName && <p className="text-slate-600">{data.branchName}</p>}
      </div>

      <div className="border-t border-dashed border-slate-400 my-2" />

      <div className="text-center mb-2">
        <p className="font-bold uppercase tracking-wide">{typeLabel(data.transactionType)} Receipt</p>
        <p className="text-slate-500">{data.status}</p>
      </div>

      <div className="border-t border-dashed border-slate-400 my-2" />

      <ReceiptRow label="Receipt No." value={data.receiptNumber} />
      <ReceiptRow label="Reference" value={data.transactionReference} />
      <ReceiptRow label="Date &amp; Time" value={fmtDateTime(data.dateTimeIso)} />

      {(data.customerName || data.customerAccountNumber) && (
        <>
          <div className="border-t border-dashed border-slate-400 my-2" />
          <ReceiptRow label="Customer" value={data.customerName} />
          <ReceiptRow label="Account No." value={data.customerAccountNumber} />
        </>
      )}

      {hasParties && (
        <>
          <div className="border-t border-dashed border-slate-400 my-2" />
          <ReceiptRow label="Sender" value={data.senderName} />
          <ReceiptRow label="Sender Phone" value={data.senderPhone} />
          <ReceiptRow label="Receiver" value={data.receiverName} />
          <ReceiptRow label="Receiver Phone" value={data.receiverPhone} />
        </>
      )}

      <div className="border-t border-dashed border-slate-400 my-2" />

      <ReceiptRow label="Amount" value={fmt(data.amount, data.currency)} strong />
      {data.chargesAmount != null && data.chargesAmount > 0 && (
        <ReceiptRow label="Charges" value={fmt(data.chargesAmount, data.chargesCurrency || data.currency)} />
      )}
      {data.exchangeRate != null && data.exchangeRate > 0 && data.toCurrency && (
        <ReceiptRow
          label="Exchange Rate"
          value={`1 ${data.currency} = ${data.exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${data.toCurrency}`}
        />
      )}
      {data.amountReceived != null && data.toCurrency && (
        <ReceiptRow label="Amount Received" value={fmt(data.amountReceived, data.toCurrency)} strong />
      )}

      {(data.remainingWalletBalance != null || data.remainingFloatBalance != null) && (
        <>
          <div className="border-t border-dashed border-slate-400 my-2" />
          {data.remainingWalletBalance != null && (
            <ReceiptRow
              label="Wallet Balance"
              value={fmt(data.remainingWalletBalance, data.remainingWalletCurrency || data.currency)}
            />
          )}
          {data.remainingFloatBalance != null && (
            <ReceiptRow
              label="Float Balance"
              value={fmt(data.remainingFloatBalance, data.remainingFloatCurrency || data.currency)}
            />
          )}
        </>
      )}

      <div className="border-t border-dashed border-slate-400 my-2" />
      <ReceiptRow label="Served By" value={data.cashierName} />

      {qrDataUrl && (
        <div className="flex flex-col items-center mt-3">
          <img src={qrDataUrl} alt="Verification QR code" className="w-24 h-24" />
          <p className="text-[9px] text-slate-400 mt-1">Scan to verify this transaction</p>
        </div>
      )}

      <p className="text-center text-[9px] text-slate-400 mt-3">Thank you for banking with us.</p>
    </div>
  );
}

// ============================================================================
// PDF generation — draws the same fields directly with jsPDF (not a DOM
// screenshot), so text stays crisp at receipt-narrow widths regardless of
// screen resolution. Requires: npm install jspdf qrcode @types/qrcode
// ============================================================================

export async function generateReceiptPdf(data: ReceiptData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  const marginX = 5;
  let y = 8;

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(data.institutionName, 40, y, { align: 'center' });
  y += 5;
  if (data.branchName) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(data.branchName, 40, y, { align: 'center' });
    y += 5;
  }

  doc.setLineDashPattern([1, 1], 0);
  doc.line(marginX, y, 80 - marginX, y);
  y += 4;

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text(`${typeLabel(data.transactionType)} Receipt`, 40, y, { align: 'center' });
  y += 4;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text(data.status, 40, y, { align: 'center' });
  y += 4;
  doc.line(marginX, y, 80 - marginX, y);
  y += 4;

  const row = (label: string, value: string | null | undefined, bold = false) => {
    if (!value) return;
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.text(label, marginX, y);
    doc.text(value, 80 - marginX, y, { align: 'right' });
    y += 4;
  };

  const divider = () => {
    doc.line(marginX, y, 80 - marginX, y);
    y += 4;
  };

  row('Receipt No.', data.receiptNumber);
  row('Reference', data.transactionReference);
  row('Date & Time', fmtDateTime(data.dateTimeIso));

  if (data.customerName || data.customerAccountNumber) {
    divider();
    row('Customer', data.customerName);
    row('Account No.', data.customerAccountNumber);
  }

  if (data.senderName || data.receiverName) {
    divider();
    row('Sender', data.senderName);
    row('Sender Phone', data.senderPhone);
    row('Receiver', data.receiverName);
    row('Receiver Phone', data.receiverPhone);
  }

  divider();
  row('Amount', fmt(data.amount, data.currency), true);
  if (data.chargesAmount != null && data.chargesAmount > 0) {
    row('Charges', fmt(data.chargesAmount, data.chargesCurrency || data.currency));
  }
  if (data.exchangeRate != null && data.exchangeRate > 0 && data.toCurrency) {
    row('Exchange Rate', `1 ${data.currency} = ${data.exchangeRate.toFixed(4)} ${data.toCurrency}`);
  }
  if (data.amountReceived != null && data.toCurrency) {
    row('Amount Received', fmt(data.amountReceived, data.toCurrency), true);
  }

  if (data.remainingWalletBalance != null || data.remainingFloatBalance != null) {
    divider();
    if (data.remainingWalletBalance != null) {
      row('Wallet Balance', fmt(data.remainingWalletBalance, data.remainingWalletCurrency || data.currency));
    }
    if (data.remainingFloatBalance != null) {
      row('Float Balance', fmt(data.remainingFloatBalance, data.remainingFloatCurrency || data.currency));
    }
  }

  divider();
  row('Served By', data.cashierName);

  try {
    const qrDataUrl = await QRCode.toDataURL(data.verificationPayload, { width: 200, margin: 0 });
    y += 2;
    const qrSize = 22;
    doc.addImage(qrDataUrl, 'PNG', 40 - qrSize / 2, y, qrSize, qrSize);
    y += qrSize + 4;
    doc.setFontSize(6.5);
    doc.text('Scan to verify this transaction', 40, y, { align: 'center' });
    y += 5;
  } catch (err) {
    console.error('Error embedding QR code in receipt PDF:', err);
  }

  doc.setFont('courier', 'italic');
  doc.setFontSize(7);
  doc.text('Thank you for banking with us.', 40, y, { align: 'center' });

  return doc;
}

export async function downloadReceiptPdf(data: ReceiptData): Promise<void> {
  const doc = await generateReceiptPdf(data);
  doc.save(`${data.receiptNumber}.pdf`);
}

// ============================================================================
// Send hooks — SMS / WhatsApp / Email
// ============================================================================
// IMPORTANT: none of these send anything themselves. Actually delivering a
// message requires a real backend integration (an SMS gateway like Africa's
// Talking or Twilio, the WhatsApp Business API, and an email service like
// Resend or SendGrid) with API keys that must never be exposed to the
// browser. Each function below only INVOKES a Supabase Edge Function and
// reports whatever that function returns. Until you deploy the three Edge
// Functions named below, these will fail with a clear "function not found"
// style error — which is the correct, honest failure mode, rather than
// silently pretending to send something.
//
// Expected contract for each Edge Function:
//   Request body:  { phone?: string, email?: string, receipt: ReceiptData }
//   Response body: { success: boolean, message: string }
// The function should render its own message/template from `receipt`
// (don't trust a client-supplied message string for what gets sent) and
// call the real provider's API server-side.
// ============================================================================

export interface SendResult {
  success: boolean;
  message: string;
}

async function invokeSendFunction(
  functionName: string,
  body: Record<string, unknown>
): Promise<SendResult> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw error;
    if (!data || typeof data.success !== 'boolean') {
      return { success: false, message: 'Unexpected response from the send function.' };
    }
    return { success: data.success, message: data.message || (data.success ? 'Sent' : 'Failed to send') };
  } catch (err) {
    console.error(`Error invoking ${functionName}:`, err);
    return {
      success: false,
      message:
        err instanceof Error
          ? `Couldn't send: ${err.message}. Has the "${functionName}" Edge Function been deployed?`
          : `Couldn't send. Has the "${functionName}" Edge Function been deployed?`,
    };
  }
}

export function sendReceiptSms(data: ReceiptData, phone: string): Promise<SendResult> {
  if (!phone.trim()) return Promise.resolve({ success: false, message: 'Enter a phone number first.' });
  return invokeSendFunction('send-receipt-sms', { phone: phone.trim(), receipt: data });
}

export function sendReceiptWhatsApp(data: ReceiptData, phone: string): Promise<SendResult> {
  if (!phone.trim()) return Promise.resolve({ success: false, message: 'Enter a phone number first.' });
  return invokeSendFunction('send-receipt-whatsapp', { phone: phone.trim(), receipt: data });
}

export function sendReceiptEmail(data: ReceiptData, email: string): Promise<SendResult> {
  if (!email.trim()) return Promise.resolve({ success: false, message: 'Enter an email address first.' });
  return invokeSendFunction('send-receipt-email', { email: email.trim(), receipt: data });
}

// ============================================================================
// The modal — preview + Print + Download PDF + Send via SMS/WhatsApp/Email.
// Used both right after a transaction succeeds, and for reprinting an old
// receipt later (any page can call buildReceiptData from a stored
// transaction row and open this same modal).
// ============================================================================

export function ReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<'sms' | 'whatsapp' | 'email' | null>(null);
  const [sendResult, setSendResult] = useState<{ channel: string; success: boolean; message: string } | null>(null);
  const [phoneInput, setPhoneInput] = useState(data.receiverPhone || data.senderPhone || '');
  const [emailInput, setEmailInput] = useState('');
  const [showSendPanel, setShowSendPanel] = useState<'sms' | 'whatsapp' | 'email' | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(data.verificationPayload, { width: 160, margin: 0 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating receipt QR code:', err);
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data.verificationPayload]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadReceiptPdf(data);
    } catch (err) {
      console.error('Error generating receipt PDF:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSend = async (channel: 'sms' | 'whatsapp' | 'email') => {
    setSendingChannel(channel);
    setSendResult(null);
    try {
      const result =
        channel === 'sms'
          ? await sendReceiptSms(data, phoneInput)
          : channel === 'whatsapp'
          ? await sendReceiptWhatsApp(data, phoneInput)
          : await sendReceiptEmail(data, emailInput);
      setSendResult({ channel, ...result });
    } finally {
      setSendingChannel(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 print:bg-white print:p-0 print:static">
      {/* Print isolation: hide everything on the page except the receipt
          slip itself when printing, regardless of what else is open behind
          this modal. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-slip, #receipt-slip * { visibility: visible; }
          #receipt-slip { position: fixed; top: 0; left: 0; width: 80mm; }
          #receipt-modal-chrome { display: none !important; }
        }
      `}</style>

      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden print:shadow-none print:max-h-none print:h-auto print:w-auto">
        <div id="receipt-modal-chrome" className="flex flex-col flex-1 min-h-0">
          {/* Fixed header */}
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg sm:text-xl font-bold text-[#641f60] flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#1ebcb2]" />
              Transaction Complete
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body: receipt preview + send panel */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto">
              <ReceiptSlip data={data} qrDataUrl={qrDataUrl} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#641f60] hover:bg-[#4a1646] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
                    placeholder="customer@example.com"
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
                  Send Receipt
                </button>
              </div>
            )}

            {sendResult && (
              <div
                className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                  sendResult.success ? 'bg-[#1ebcb2]/10 text-[#159089]' : 'bg-[#c46040]/10 text-[#c46040]'
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

          {/* Fixed footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
            <button
              onClick={onClose}
              className="w-full px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>

        {/* This copy of the slip only becomes visible via the print CSS
            above (visibility: hidden on everything except #receipt-slip) —
            duplicated outside the chrome wrapper isn't needed since the
            print rule targets #receipt-slip wherever it is in the DOM. */}
      </div>
    </div>
  );
}