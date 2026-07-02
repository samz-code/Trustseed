import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LegalLayout } from './LegalLayout';

const requestTabs = [
  {
    label: 'cURL',
    filename: 'terminal',
    code: (
      <>
        <span className="text-slate-500"># Authenticate every request with a bearer token</span>
        <br />
        <span className="text-[#4ec9b0]">curl</span>{' '}
        <span className="text-[#ce9178]">https://api.trustseedmicrofinanceenterprises.com/v1/members</span>{' '}
        <span className="text-slate-400">\</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">-H</span>{' '}
        <span className="text-[#ce9178]">&quot;Authorization: Bearer YOUR_API_KEY&quot;</span>
      </>
    ),
  },
  {
    label: 'Response',
    filename: 'response.json',
    code: (
      <>
        <span className="text-slate-300">{'{'}</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;id&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#ce9178]">&quot;mem_9f21a&quot;</span>
        <span className="text-slate-300">,</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;full_name&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#ce9178]">&quot;Amina Wanjiru&quot;</span>
        <span className="text-slate-300">,</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;status&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#ce9178]">&quot;verified&quot;</span>
        <span className="text-slate-300">,</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;active_loans&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#b5cea8]">1</span>
        <br />
        <span className="text-slate-300">{'}'}</span>
      </>
    ),
  },
];

function RequestResponseWindow() {
  const [active, setActive] = useState(0);
  const tab = requestTabs[active];

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border border-black/10 bg-[#1e1f26]">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#2a2b35] border-b border-black/20">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex items-center gap-1">
          {requestTabs.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActive(i)}
              className="px-3 py-1 rounded-md text-xs font-mono transition-colors"
              style={{
                color: active === i ? '#fff' : '#8b8d98',
                backgroundColor: active === i ? '#3a3b47' : 'transparent',
              }}
            >
              {t.filename}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5 font-mono text-[13px] leading-relaxed overflow-x-auto min-h-[120px]">
        {tab.code}
      </div>
    </div>
  );
}

const endpoints = [
  { method: 'POST', path: '/v1/members', description: 'Enroll a new member and start KYC verification.' },
  { method: 'GET', path: '/v1/members/{id}', description: 'Retrieve a member profile and loan history.' },
  { method: 'POST', path: '/v1/loans', description: 'Originate a new loan against an approved member.' },
  { method: 'POST', path: '/v1/disbursements', description: 'Disburse funds via mobile money or bank transfer.' },
  { method: 'POST', path: '/v1/repayments', description: 'Record a repayment and update the loan ledger.' },
  { method: 'GET', path: '/v1/reports/portfolio', description: 'Export portfolio-at-risk and repayment reports.' },
];

const methodColor: Record<string, string> = {
  GET: '#1ebcb2',
  POST: '#ee7b22',
};

export function ApiDocumentation() {
  const navigate = useNavigate();
  const location = useLocation();

  // "Contact" only exists as a section on the landing page. From this page,
  // navigate home first, then scroll once the section has mounted.
  const goToContact = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#contact');
      setTimeout(() => {
        document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  };

  return (
    <LegalLayout
      title="API Documentation"
      subtitle="Integrate member onboarding, loans, and payments directly into your own systems."
    >
      <section>
        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Getting started</h2>
        <p className="text-slate-600 mb-4">
          The Trust Seed API lets your team automate member onboarding, loan origination, and
          disbursement across the channels your members already use. All endpoints are versioned,
          authenticated, and return JSON.
        </p>
        <RequestResponseWindow />
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">Core endpoints</h2>
        <div className="space-y-3">
          {endpoints.map((endpoint) => (
            <div
              key={endpoint.path}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-slate-100"
            >
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-md w-fit"
                style={{
                  color: methodColor[endpoint.method],
                  backgroundColor: `${methodColor[endpoint.method]}14`,
                }}
              >
                {endpoint.method}
              </span>
              <code className="text-sm font-mono text-slate-800">{endpoint.path}</code>
              <span className="text-sm text-slate-500 sm:ml-auto">{endpoint.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Rate limits & environments</h2>
        <p className="text-slate-600">
          Sandbox credentials are available for testing integrations before going live. Production
          traffic is rate-limited per institution; reach out to your account manager to raise limits
          ahead of a large disbursement run.
        </p>
      </section>

      <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Need API access?</h2>
        <p className="text-slate-600 mb-4">
          Request sandbox credentials and full endpoint reference from our integrations team.
        </p>
        <a
          href="/#contact"
          onClick={goToContact}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium transition-colors"
          style={{ backgroundColor: '#1ebcb2' }}
        >
          Request access
        </a>
      </div>
    </LegalLayout>
  );
}