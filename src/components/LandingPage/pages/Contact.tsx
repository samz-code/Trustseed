import type { MouseEvent, KeyboardEvent } from 'react';
import { Building2, Clock, Globe, Mail, MessageSquare, Phone, Send, User } from 'lucide-react';

const EMAIL = 'hello@trustseedmicrofinanceenterprises.com';
const PHONE = '+211927094644';
const WEBSITE = 'https://trustseedmicrofinanceenterprises.com';
const MAIL_SUBJECT = 'TrustSeed Enquiry';
const MAIL_BODY = 'Hello TrustSeed team,\n\nI would like to know more about your platform.\n\nInstitution:\nName:\n';

const mailtoHref =
  'mailto:' +
  EMAIL +
  '?subject=' +
  encodeURIComponent(MAIL_SUBJECT) +
  '&body=' +
  encodeURIComponent(MAIL_BODY);

const gmailHref =
  'https://mail.google.com/mail/?view=cm&fs=1&to=' +
  encodeURIComponent(EMAIL) +
  '&su=' +
  encodeURIComponent(MAIL_SUBJECT) +
  '&body=' +
  encodeURIComponent(MAIL_BODY);

type ContactDetail = {
  icon: typeof Building2;
  label: string;
  value: string;
  action?: 'email' | 'phone' | 'website';
  color: string;
  breakAll: boolean;
};

const contactDetails: ContactDetail[] = [
  {
    icon: Building2,
    label: 'Office',
    value: 'Nairobi, Kenya | Kampala, Uganda | Juba, South Sudan',
    color: '#ee7b22',
    breakAll: false,
  },
  {
    icon: Phone,
    label: 'Phone',
    value: PHONE,
    action: 'phone',
    color: '#1ebcb2',
    breakAll: false,
  },
  {
    icon: Mail,
    label: 'Email',
    value: EMAIL,
    action: 'email',
    color: '#641f60',
    breakAll: true,
  },
  {
    icon: Globe,
    label: 'Website',
    value: 'trustseedmicrofinanceenterprises.com',
    action: 'website',
    color: '#c46040',
    breakAll: true,
  },
];

function openEmailClient() {
  const before = Date.now();
  let handled = false;

  const markHandled = () => {
    handled = true;
  };

  window.addEventListener('blur', markHandled, { once: true });
  document.addEventListener('visibilitychange', markHandled, { once: true });

  window.location.href = mailtoHref;

  window.setTimeout(() => {
    window.removeEventListener('blur', markHandled);
    document.removeEventListener('visibilitychange', markHandled);

    const stillHere = !handled && !document.hidden && Date.now() - before < 2500;
    if (stillHere) {
      window.open(gmailHref, '_blank', 'noopener,noreferrer');
    }
  }, 1200);
}

function runAction(action: ContactDetail['action']) {
  if (action === 'email') {
    openEmailClient();
    return;
  }
  if (action === 'phone') {
    window.location.href = 'tel:' + PHONE;
    return;
  }
  if (action === 'website') {
    window.open(WEBSITE, '_blank', 'noopener,noreferrer');
  }
}

export function Contact() {
  const handleClick = (detail: ContactDetail) => (e: MouseEvent<HTMLDivElement>) => {
    if (!detail.action) return;
    e.preventDefault();
    runAction(detail.action);
  };

  const handleKeyDown = (detail: ContactDetail) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (!detail.action) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    runAction(detail.action);
  };

  return (
    <section id="contact" className="py-16 sm:py-24 bg-slate-50 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full min-w-0">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4 break-words">
            Let's Talk About Your Institution
          </h2>
          <p className="text-base sm:text-lg text-slate-600">
            Have questions or ready for a demo? Reach out and our team will respond within 24 hours.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 sm:gap-8 items-start w-full min-w-0">
          {/* Contact info column */}
          <div className="lg:col-span-2 space-y-4 w-full min-w-0">
            {contactDetails.map((detail, idx) => {
              const Icon = detail.icon;
              const clickable = Boolean(detail.action);

              return (
                <div
                  key={idx}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={clickable ? detail.label + ': ' + detail.value : undefined}
                  onClick={handleClick(detail)}
                  onKeyDown={handleKeyDown(detail)}
                  className={
                    'group flex items-start gap-4 bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm transition-all w-full min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ebcb2] ' +
                    (clickable ? 'cursor-pointer hover:shadow-md hover:border-[#1ebcb2]/40' : '')
                  }
                >
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: detail.color + '1A' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: detail.color }} />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-0.5">
                      {detail.label}
                    </p>
                    <p
                      className={
                        'text-slate-900 font-medium ' +
                        (detail.breakAll ? 'break-all ' : 'break-words ') +
                        (clickable ? 'group-hover:text-[#1ebcb2] transition-colors' : '')
                      }
                    >
                      {detail.value}
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="flex items-start gap-4 bg-[#641f60] rounded-xl p-4 sm:p-5 w-full min-w-0">
              <div className="w-11 h-11 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs font-medium uppercase tracking-wide text-white/70 mb-0.5">
                  Response Time
                </p>
                <p className="text-white font-medium break-words">We reply within 24 hours, Mon–Fri</p>
              </div>
            </div>
          </div>

          {/* Form column */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg border border-slate-200 p-5 sm:p-8 w-full min-w-0">
            <form className="space-y-5 w-full min-w-0">
              <div className="grid sm:grid-cols-2 gap-5 w-full min-w-0">
                <div className="min-w-0 w-full">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
                  <div className="relative w-full min-w-0">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      className="w-full min-w-0 box-border pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="Emoni"
                    />
                  </div>
                </div>
                <div className="min-w-0 w-full">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
                  <div className="relative w-full min-w-0">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      className="w-full min-w-0 box-border pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="Samuel"
                    />
                  </div>
                </div>
              </div>

              <div className="min-w-0 w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <div className="relative w-full min-w-0">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    className="w-full min-w-0 box-border pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="emoni@institution.com"
                  />
                </div>
              </div>

              <div className="min-w-0 w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Institution Name</label>
                <div className="relative w-full min-w-0">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    className="w-full min-w-0 box-border pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="Your institution name"
                  />
                </div>
              </div>

              <div className="min-w-0 w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
                <div className="relative w-full min-w-0">
                  <MessageSquare className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <textarea
                    rows={4}
                    className="w-full min-w-0 box-border pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent resize-none sm:resize-y"
                    placeholder="How can we help you?"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full box-border py-3.5 bg-[#ee7b22] text-white font-medium rounded-lg shadow-lg hover:bg-[#c46040] transition-all flex items-center justify-center gap-2"
              >
                Send Message
                <Send className="w-4 h-4 shrink-0" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}