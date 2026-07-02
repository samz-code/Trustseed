import { Link } from 'react-router-dom';
import { LegalLayout } from './LegalLayout';

export function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" subtitle="Last updated: July 2026">
      <section>
        <p>
          Trust Seed ("Trust Seed," "we," "us," or "our") operates a multi-tenant, subscription-based
          enterprise financial platform used by microfinance institutions, SACCOs, savings groups, and
          money transfer operators across Africa. This Privacy Policy explains what information we
          collect, how we use it, and the choices available to institutions, their staff, and their
          customers when the platform is used.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">1. Information We Collect</h2>
        <p className="mb-3">We collect information at two levels:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <span className="font-semibold text-slate-900">Institution account data:</span> business
            information, admin contact details, branch structure, and subscription and billing records
            provided during onboarding.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Operational data:</span> customer records,
            KYC documents, wallet and account balances, transaction history, loan and savings records,
            and agent activity that an institution enters or generates while using the platform.
          </li>
          <li>
            <span className="font-semibold text-slate-900">Technical data:</span> device information, IP
            address, log-in timestamps, and app usage data collected automatically from the web portal,
            mobile app, and agent app.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1ebcb2] mb-4">2. How We Use Information</h2>
        <p className="mb-3">Information is used to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Provision and operate each institution's dashboard, branches, and user accounts</li>
          <li>Process daily operations such as deposits, withdrawals, transfers, loans, and reconciliation</li>
          <li>Maintain audit trails required for approvals and regulatory reporting</li>
          <li>Manage subscription billing and provide customer support</li>
          <li>Monitor platform performance, security, and uptime</li>
          <li>Communicate service updates, maintenance windows, and account notices</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#ee7b22] mb-4">3. Data Isolation Between Institutions</h2>
        <p>
          Trust Seed is built as a multi-tenant platform, and every institution's data is logically
          isolated from every other institution's data. Customers, wallets, branches, users, and reports
          belonging to one institution are never visible to another institution. Institution
          administrators control which staff and branches can access their own data through role-based
          permissions.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1a3c6e] mb-4">4. Data Sharing</h2>
        <p className="mb-3">We do not sell personal or institutional data. Data may be shared only:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>With the infrastructure providers that host the platform, under confidentiality obligations</li>
          <li>With payment or mobile money partners strictly to process a transaction an institution initiates</li>
          <li>When required by law, regulation, or a valid order from a competent authority</li>
          <li>With an institution's own consent, for integrations it explicitly enables</li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">5. Data Retention</h2>
        <p>
          Operational and financial records are retained for as long as an institution's subscription is
          active and for the additional period required by applicable financial recordkeeping
          regulations after account closure. Institutions may request export or deletion of their data
          in line with their regulatory obligations, subject to statutory retention requirements for
          financial records.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1ebcb2] mb-4">6. Security Measures</h2>
        <p>
          Data is encrypted in transit and at rest, access is controlled through role-based permissions,
          and activity is logged in an audit trail. See our{' '}
          <Link to="/security" className="text-[#1ebcb2] font-medium hover:underline">
            Security page
          </Link>{' '}
          for more detail.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#ee7b22] mb-4">7. Your Rights</h2>
        <p>
          Depending on your country's data protection law, you may have the right to access, correct, or
          request deletion of your personal data, and to object to certain processing. Requests
          concerning customer data should be directed to the financial institution you hold an account
          with, as they act as the data controller for their own customers. Requests about institution
          account data can be sent to us directly.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1a3c6e] mb-4">8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be communicated to
          institution administrators through the platform or by email before they take effect.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">9. Contact Us</h2>
        <p>
          Questions about this Privacy Policy can be sent to our support team through the contact details
          provided on our website.
        </p>
      </section>
    </LegalLayout>
  );
}