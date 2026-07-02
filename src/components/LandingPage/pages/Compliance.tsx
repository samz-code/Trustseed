import { Link } from 'react-router-dom';
import { LegalLayout } from './LegalLayout';

export function Compliance() {
  return (
    <LegalLayout title="Compliance" subtitle="Supporting institutions in meeting their regulatory obligations">
      <section>
        <p>
          Financial institutions on Trust Seed operate under regulatory regimes that vary by country. The
          Platform is designed to support each institution's own compliance program, while the
          institution remains responsible for its own licensing and regulatory reporting.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">1. KYC and Customer Due Diligence</h2>
        <p>
          The Platform supports customer onboarding workflows that capture the identification and due
          diligence information institutions need to meet local KYC requirements, with records stored
          against each customer profile.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1ebcb2] mb-4">2. Anti-Money Laundering Controls</h2>
        <p>
          Multi-level approval workflows, transaction limits, and full audit trails give institutions the
          controls needed to monitor for suspicious activity and support their AML obligations to their
          national regulator.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#ee7b22] mb-4">3. Audit Trails and Reporting</h2>
        <p>
          Every transaction, approval, and permission change is logged and available for export in PDF,
          Excel, or CSV format, supporting internal audits, external audits, and regulator examinations.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1a3c6e] mb-4">4. Data Protection Alignment</h2>
        <p>
          Institution and customer data is handled in line with applicable data protection laws in the
          institution's country of operation, including principles of data minimization, purpose
          limitation, and secure storage described in our{' '}
          <Link to="/privacy-policy" className="text-[#1ebcb2] font-medium hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">5. Data Isolation Across Institutions</h2>
        <p>
          As a multi-tenant platform, Trust Seed keeps each institution's data logically separated from
          every other institution, supporting confidentiality obligations institutions owe to their own
          customers.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1ebcb2] mb-4">6. Shared Responsibility</h2>
        <p>
          Trust Seed provides the tools, controls, and audit capabilities needed to operate compliantly.
          Each institution remains responsible for holding the appropriate licenses, filing regulatory
          reports, and ensuring its own staff follow applicable financial regulations.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#ee7b22] mb-4">7. Questions</h2>
        <p>
          Institutions with questions about how the Platform supports a specific regulatory requirement
          can reach our support team through the contact details on our website.
        </p>
      </section>
    </LegalLayout>
  );
}