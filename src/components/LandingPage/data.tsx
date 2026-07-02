import {
  Users,
  Wallet,
  ArrowRightLeft,
  Globe,
  Landmark,
  PiggyBank,
  Receipt,
  Calculator,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
}

export const features: Feature[] = [
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Customer Management',
    description: 'Comprehensive KYC/AML verification, customer profiles, and relationship tracking.',
    color: 'bg-[#ee7b22]',
  },
  {
    icon: <Wallet className="w-6 h-6" />,
    title: 'Digital Wallets',
    description: 'Multi-currency wallet management with real-time balance tracking and transaction history.',
    color: 'bg-[#1ebcb2]',
  },
  {
    icon: <ArrowRightLeft className="w-6 h-6" />,
    title: 'Money Transfers',
    description: 'Fast, secure domestic and international transfers with compliance checks built-in.',
    color: 'bg-[#641f60]',
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Forex Trading',
    description: 'Real-time exchange rates, currency trading, and automated spread management.',
    color: 'bg-[#c46040]',
  },
  {
    icon: <Landmark className="w-6 h-6" />,
    title: 'Loan Management',
    description: 'Complete loan lifecycle from application to disbursement, repayment tracking, and collections.',
    color: 'bg-[#ee7b22]',
  },
  {
    icon: <PiggyBank className="w-6 h-6" />,
    title: 'Savings Products',
    description: 'Flexible savings products with interest calculations, maturity tracking, and statement generation.',
    color: 'bg-[#1ebcb2]',
  },
  {
    icon: <Receipt className="w-6 h-6" />,
    title: 'Float Management',
    description: 'Track and manage float across branches with threshold alerts and optimized positioning.',
    color: 'bg-[#641f60]',
  },
  {
    icon: <Calculator className="w-6 h-6" />,
    title: 'Accounting',
    description: 'Double-entry accounting, chart of accounts, journal entries, and financial reporting.',
    color: 'bg-[#c46040]',
  },
];

export interface Stat {
  value: string;
  label: string;
}

export const stats: Stat[] = [
  { value: '50+', label: 'Institutions Trust Us' },
  { value: '$2B+', label: 'Transactions Processed' },
  { value: '99.9%', label: 'Uptime Guaranteed' },
  { value: '24/7', label: 'Support Available' },
];

export interface PricingPlan {
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  buttonText: string;
  popular: boolean;
}

export const pricingPlans: PricingPlan[] = [
  {
    name: 'Starter',
    price: 250,
    period: '/month',
    description: 'Perfect for small institutions getting started',
    features: [
      'Up to 2 branches',
      'Up to 10 users',
      'Customer & Wallet Management',
      'Savings Products',
      'Basic Reporting',
      'Email Support',
    ],
    buttonText: 'Get Started',
    popular: false,
  },
  {
    name: 'Professional',
    price: 600,
    period: '/month',
    description: 'For growing institutions with advanced needs',
    features: [
      'Up to 10 branches',
      'Up to 50 users',
      'All Starter features',
      'Loan Management',
      'Money Transfers',
      'Forex Trading',
      'Advanced Analytics',
      'API Access',
      'Priority Support',
    ],
    buttonText: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 1500,
    period: '/month',
    description: 'For large organizations with custom requirements',
    features: [
      'Unlimited branches',
      'Unlimited users',
      'All Professional features',
      'Custom Branding',
      'Dedicated Account Manager',
      'Custom Integrations',
      'On-premise Option',
      'SLA Guarantee',
    ],
    buttonText: 'Contact Sales',
    popular: false,
  },
];