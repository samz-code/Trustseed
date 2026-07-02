import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LegalLayout } from './LegalLayout';

const webhookTabs = [
  {
    filename: 'webhook.json',
    code: (
      <>
        <span className="text-slate-300">{'{'}</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;event&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#ce9178]">&quot;payment.received&quot;</span>
        <span className="text-slate-300">,</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;channel&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#ce9178]">&quot;mpesa&quot;</span>
        <span className="text-slate-300">,</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;member_id&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#ce9178]">&quot;mem_9f21a&quot;</span>
        <span className="text-slate-300">,</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;amount&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#b5cea8]">2500</span>
        <span className="text-slate-300">,</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;currency&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#ce9178]">&quot;KES&quot;</span>
        <span className="text-slate-300">,</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">&quot;applied_to&quot;</span>
        <span className="text-slate-300">: </span>
        <span className="text-[#ce9178]">&quot;loan_repayment&quot;</span>
        <br />
        <span className="text-slate-300">{'}'}</span>
      </>
    ),
  },
  {
    filename: 'listener.js',
    code: (
      <>
        <span className="text-[#c586c0]">app</span>
        <span className="text-slate-300">.</span>
        <span className="text-[#dcdcaa]">post</span>
        <span className="text-slate-300">(</span>
        <span className="text-[#ce9178]">&apos;/webhooks/trustseed&apos;</span>
        <span className="text-slate-300">, (</span>
        <span className="text-[#9cdcfe]">req</span>
        <span className="text-slate-300">, </span>
        <span className="text-[#9cdcfe]">res</span>
        <span className="text-slate-300">) =&gt; {'{'}</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#569cd6]">const</span>{' '}
        <span className="text-[#9cdcfe]">event</span>
        <span className="text-slate-300"> = </span>
        <span className="text-[#9cdcfe]">req</span>
        <span className="text-slate-300">.</span>
        <span className="text-[#9cdcfe]">body</span>
        <span className="text-slate-300">;</span>
        <br />
        &nbsp;&nbsp;<span className="text-[#c586c0]">if</span>
        <span className="text-slate-300"> (</span>
        <span className="text-[#9cdcfe]">event</span>
        <span className="text-slate-300">.</span>
        <span className="text-[#9cdcfe]">event</span>
        <span className="text-slate-300"> === </span>
        <span className="text-[#ce9178]">&apos;payment.received&apos;</span>
        <span className="text-slate-300">) {'{'}</span>
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#dcdcaa]">recordRepayment</span>
        <span className="text-slate-300">(</span>
        <span className="text-[#9cdcfe]">event</span>
        <span className="text-slate-300">);</span>
        <br />
        &nbsp;&nbsp;{'}'}
        <br />
        &nbsp;&nbsp;<span className="text-[#9cdcfe]">res</span>
        <span className="text-slate-300">.</span>
        <span className="text-[#dcdcaa]">sendStatus</span>
        <span className="text-slate-300">(</span>
        <span className="text-[#b5cea8]">200</span>
        <span className="text-slate-300">);</span>
        <br />
        {'}'}
        <span className="text-slate-300">);</span>
      </>
    ),
  },
];

function WebhookWindow() {
  const [active, setActive] = useState(0);
  const tab = webhookTabs[active];

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border border-black/10 bg-[#1e1f26]">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#2a2b35] border-b border-black/20">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex items-center gap-1">
          {webhookTabs.map((t, i) => (
            <button
              key={t.filename}
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
      <div className="p-5 font-mono text-[13px] leading-relaxed overflow-x-auto min-h-[140px]">
        {tab.code}
      </div>
    </div>
  );
}

const integrations = [
  {
    name: 'Mobile Money',
    accent: '#ee7b22',
    items: ['M-Pesa', 'Airtel Money', 'MTN Mobile Money'],
    description:
      'Disburse loans and collect repayments directly through the mobile money rails your members already use, with reconciliation handled automatically.',
  },
  {
    name: 'Banking & Payments',
    accent: '#1ebcb2',
    items: ['Bank transfer (RTGS/EFT)', 'Card payments', 'SWIFT for cross-border transfers'],
    description:
      'Connect institutional bank accounts for bulk disbursements, settlement, and treasury operations without leaving Trust Seed.',
  },
  {
    name: 'Identity & Compliance',
    accent: '#641f60',
    items: ['National ID verification', 'KYC/AML screening', 'Credit reference bureaus'],
    description:
      'Verify members and screen for risk at onboarding, so your loan officers spend their time serving members instead of chasing paperwork.',
  },
  {
    name: 'Reporting & Data',
    accent: '#1a3c6e',
    items: ['SMS & USSD gateways', 'Accounting software export', 'REST API & webhooks'],
    description:
      'Keep your existing accounting and communication tools in sync, or build custom workflows on top of the Trust Seed API.',
  },
];

export function Integrations() {
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
      title="Integrations"
      subtitle="Trust Seed connects to the payment rails, verification services, and tools microfinance institutions already rely on."
    >
      <div className="space-y-10">
        {integrations.map((group) => (
          <div key={group.name} className="border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: group.accent }}
              />
              <h2 className="text-xl font-semibold text-slate-900">{group.name}</h2>
            </div>
            <p className="text-slate-600 mb-4">{group.description}</p>
            <ul className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="text-sm font-medium px-3 py-1.5 rounded-full"
                  style={{
                    color: group.accent,
                    backgroundColor: `${group.accent}14`,
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">See it in action</h2>
        <p className="text-slate-600 mb-4">
          Every integration event, like a mobile money payment landing, arrives as a webhook you can
          act on in real time.
        </p>
        <WebhookWindow />
      </section>

      <div className="mt-12 p-8 rounded-2xl bg-slate-50 border border-slate-100">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Don't see what you need?</h2>
        <p className="text-slate-600 mb-4">
          Our API is built to be extended. If your institution relies on a service that isn't listed
          here, get in touch and our team will help you connect it.
        </p>
        <a
          href="/#contact"
          onClick={goToContact}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium transition-colors"
          style={{ backgroundColor: '#ee7b22' }}
        >
          Talk to our team
        </a>
      </div>
    </LegalLayout>
  );
}