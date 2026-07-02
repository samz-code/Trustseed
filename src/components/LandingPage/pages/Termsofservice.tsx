import { LegalLayout } from './LegalLayout';

export function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" subtitle="Last updated: July 2026">
      <section>
        <p>
          These Terms of Service ("Terms") govern access to and use of the Trust Seed Enterprise
          Financial Platform (the "Platform") by any institution and its authorized users. By creating an
          account or using the Platform, an institution agrees to these Terms.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">1. The Service</h2>
        <p>
          Trust Seed provides a multi-tenant, subscription-based platform for financial institutions,
          including microfinance institutions, SACCOs, agency banking operators, and money transfer
          operators, to manage customers, wallets, transfers, loans, savings, forex, accounting, and
          reporting through a web portal, mobile app, and agent app.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1ebcb2] mb-4">2. Subscription and Billing</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Access to the Platform is subscription-only. There is no one-time purchase option.</li>
          <li>Plans start at a minimum of USD 250 per month, billed to the payment method on file.</li>
          <li>Subscriptions renew automatically each billing cycle unless cancelled beforehand.</li>
          <li>An institution may cancel at any time; access continues until the end of the current billing period.</li>
          <li>Fees already paid for the current billing period are non-refundable except where required by law.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#ee7b22] mb-4">3. Account Registration</h2>
        <p>
          An institution must provide accurate business, admin, and contact information during onboarding
          and keep it up to date. The institution is responsible for all activity carried out under its
          account, including actions taken by its branches, staff, and agents.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1a3c6e] mb-4">4. Acceptable Use</h2>
        <p className="mb-3">An institution agrees not to use the Platform to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Process transactions it is not licensed or authorized to carry out</li>
          <li>Facilitate money laundering, fraud, or any other unlawful financial activity</li>
          <li>Attempt to bypass approval workflows, audit trails, or access controls</li>
          <li>Interfere with the security or availability of the Platform</li>
          <li>Access or attempt to access another institution's data</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">5. Institution Responsibilities</h2>
        <p>
          Each institution remains responsible for its own regulatory compliance, including licensing,
          KYC/AML obligations, and reporting to its relevant financial regulator. Trust Seed provides
          tools to support these processes but does not act as a licensed financial institution itself
          and is not a party to transactions processed between an institution and its customers.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1ebcb2] mb-4">6. Intellectual Property</h2>
        <p>
          The Platform, including its software, design, and branding, is owned by Trust Seed. Institutions
          retain ownership of their own data. Subscribing to the Platform grants an institution a limited,
          non-transferable right to use the Platform for its internal business operations during the
          subscription term.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#ee7b22] mb-4">7. Service Availability</h2>
        <p>
          We aim to maintain high platform availability and perform regular backups, but the Platform is
          provided on an "as available" basis. Scheduled maintenance will be communicated in advance where
          reasonably possible.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1a3c6e] mb-4">8. Limitation of Liability</h2>
        <p>
          To the extent permitted by law, Trust Seed is not liable for indirect, incidental, or
          consequential damages arising from use of the Platform. Our total liability for any claim
          relating to the Platform is limited to the subscription fees paid by the institution in the
          twelve months preceding the claim.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">9. Termination</h2>
        <p>
          We may suspend or terminate access to the Platform for non-payment, breach of these Terms, or
          unlawful use. An institution may request export of its data for a reasonable period following
          termination, subject to applicable regulatory retention requirements.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1ebcb2] mb-4">10. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which the subscribing institution is
          registered, unless otherwise agreed in a separate written agreement.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#ee7b22] mb-4">11. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use of the Platform after changes take
          effect constitutes acceptance of the updated Terms.
        </p>
      </section>
    </LegalLayout>
  );
}