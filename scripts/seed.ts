import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from '../packages/database/src/client';

const MERCHANT = {
  name: 'RecoverAI Demo Merchant',
  email: 'demo@recoverai.com',
  razorpayAccountId: 'acc_demo123',
};

const CUSTOMER_NAMES = [
  'Rahul Sharma', 'Priya Patel', 'Amit Kumar', 'Sunita Singh', 'Rajesh Verma',
  'Anita Joshi', 'Vikram Gupta', 'Kavya Reddy', 'Suresh Nair', 'Meena Iyer',
  'Arjun Mehta', 'Deepa Krishnan', 'Ravi Agarwal', 'Pooja Mishra', 'Kiran Rao',
  'Sneha Pillai', 'Manish Tiwari', 'Rekha Chavan', 'Arun Bose', 'Lakshmi Menon',
  'Sanjay Dubey', 'Geeta Pandey', 'Vinod Shetty', 'Nisha Kulkarni', 'Prakash Jain',
  'Usha Naidu', 'Ashok Bhatt', 'Sangita Ghosh', 'Ramesh Patil', 'Anjali Saxena',
  'Dinesh Murthy', 'Sushma Desai', 'Nitin Kapoor', 'Radha Nambiar', 'Sunil Bhat',
  'Hema Venkatesh', 'Ajay Tripathi', 'Swati Chatterjee', 'Manoj Goswami', 'Kavita Thakur',
  'Vishal Shukla', 'Nalini Choudhary', 'Pankaj Srivastava', 'Mala Hegde', 'Ganesh Rajan',
  'Praveena Malhotra', 'Umesh Joshi', 'Chandrika Pillai', 'Balaji Iyer', 'Sarla Tiwari',
];

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];

function nameToEmail(name: string, index: number): string {
  const slug = name.toLowerCase().replace(/\s+/g, '.');
  const domain = EMAIL_DOMAINS[index % EMAIL_DOMAINS.length];
  return `${slug}@${domain}`;
}

function indexToPhone(index: number): string {
  return `+91${9876543210 + index}`;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Idempotency check
  const existing = await prisma.merchant.findUnique({
    where: { email: MERCHANT.email },
  });

  if (existing) {
    console.log('✅ Merchant demo@recoverai.com already exists — skipping seed.');
    return;
  }

  // Create merchant
  const merchant = await prisma.merchant.create({
    data: MERCHANT,
  });
  console.log(`✅ Merchant created: ${merchant.id}`);

  // Create 50 customers
  const customerData = CUSTOMER_NAMES.map((name, i) => ({
    merchantId: merchant.id,
    name,
    email: nameToEmail(name, i),
    phone: indexToPhone(i),
  }));

  await prisma.customer.createMany({ data: customerData });
  console.log(`✅ 50 customers created`);

  console.log('🎉 Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
