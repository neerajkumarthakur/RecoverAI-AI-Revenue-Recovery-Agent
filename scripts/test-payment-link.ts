import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import after dotenv so env vars are loaded
import Razorpay from 'razorpay';

async function testPaymentLink() {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  try {
    const result = await (razorpay.paymentLink as any).create({
      amount: 100,
      currency: 'INR',
      reference_id: 'test-rc-001',
      description: 'RecoverAI test payment link',
      customer: {
        name: 'Test Customer',
        email: 'test@example.com',
        contact: '+919876543210',
      },
      reminder_enable: true,
      expire_by: Math.floor(Date.now() / 1000) + (24 * 3600),
    });

    console.log('✅ Payment Link created successfully!');
    console.log('ID:', (result as any).id);
    console.log('Short URL:', (result as any).short_url);
    console.log('Amount:', (result as any).amount, 'paise');
  } catch (error) {
    console.error('❌ Failed to create payment link:', error);
  }
}

testPaymentLink();
