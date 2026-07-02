import { LegalLayout } from './LegalLayout';

export function Security() {
  return (
    <LegalLayout title="Security" subtitle="How Trust Seed protects institutions and their customers">
      <section>
        <p>
          Trust Seed is built for financial institutions, so security is treated as a core requirement,
          not an add-on. This page summarizes the main safeguards built into the Platform.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">1. Infrastructure</h2>
        <p>
          The Platform runs on established cloud infrastructure (AWS, Azure, or GCP depending on region)
          with a target of 99.9% uptime. Infrastructure is monitored continuously, and daily backups are
          taken to protect against data loss.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1ebcb2] mb-4">2. Encryption</h2>
        <p>
          Data is encrypted in transit using TLS and encrypted at rest, protecting customer records,
          wallet balances, and transaction history from unauthorized access at the infrastructure level.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#ee7b22] mb-4">3. Multi-Tenant Data Isolation</h2>
        <p>
          Every institution operates in its own logically isolated space. Customers, branches, agents,
          users, wallets, and reports belonging to one institution are never accessible to another
          institution on the Platform.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1a3c6e] mb-4">4. Access Control and Roles</h2>
        <p className="mb-3">
          Access follows role-based access control (RBAC), so users only see what their role requires:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Teller — submits daily transactions</li>
          <li>Branch Manager — reviews and approves branch-level activity</li>
          <li>Finance Officer — approves larger transactions and reconciliations</li>
          <li>Head Office / Admin — confirms high-value actions and manages institution-wide settings</li>
        </ul>
        <p className="mt-3">
          Sensitive actions such as large withdrawals, loan approvals, and permission changes follow a
          multi-level approval workflow before they take effect.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#641f60] mb-4">5. Audit Trail</h2>
        <p>
          Every approval, transaction, and permission change is logged in an audit trail, giving
          institutions a complete, reviewable record of who did what and when — supporting both internal
          controls and regulator inspections.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1ebcb2] mb-4">6. Backups and Disaster Recovery</h2>
        <p>
          Daily backups are taken across the Platform, and recovery procedures are in place to restore
          service and data in the event of a disruption.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#ee7b22] mb-4">7. Vulnerability Management</h2>
        <p>
          We monitor for and apply security patches to underlying systems on an ongoing basis, and
          regularly review access logs and system configurations for anomalies.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-[#1a3c6e] mb-4">8. Reporting a Security Concern</h2>
        <p>
          If you believe you have found a security issue affecting the Platform, please contact our
          support team through the contact details on our website so we can investigate promptly.
        </p>
      </section>
    </LegalLayout>
  );
}