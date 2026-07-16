import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; // adjust path as needed

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    console.log('M-Pesa Callback Received:', JSON.stringify(data, null, 2));

    const { Body } = data;
    const { stkCallback } = Body;

    if (stkCallback.ResultCode === 0) {
      // Payment Successful
      const { MerchantRequestID, CheckoutRequestID, ResultDesc, CallbackMetadata } = stkCallback;

      const amountItem = CallbackMetadata.Item.find((item: any) => item.Name === 'Amount');
      const phoneItem = CallbackMetadata.Item.find((item: any) => item.Name === 'PhoneNumber');
      const mpesaCodeItem = CallbackMetadata.Item.find((item: any) => item.Name === 'MpesaReceiptNumber');

      const amount = amountItem?.Value;
      const phone = phoneItem?.Value;
      const mpesaReceipt = mpesaCodeItem?.Value;

      console.log(`✅ M-Pesa Payment Successful: ${mpesaReceipt} | Amount: ${amount} | Phone: ${phone}`);

      // TODO: Update your database (e.g. mark subscription as active)
      // Example:
      // await supabase.from('subscriptions').update({ 
      //   status: 'active',
      //   mpesa_receipt: mpesaReceipt,
      //   paid_at: new Date().toISOString()
      // }).eq('checkout_request_id', CheckoutRequestID);

      // Optional: Send success email or notification
    } else {
      console.log(`❌ M-Pesa Payment Failed: ${stkCallback.ResultDesc}`);
    }

    return NextResponse.json({ Result: 'OK' }); // Safaricom requires this response
  } catch (error) {
    console.error('Callback Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}