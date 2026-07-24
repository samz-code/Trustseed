import { Building2, Clock, Globe, Mail, MessageSquare, Phone, Send, User } from 'lucide-react';

const EMAIL = 'hello@trustseedmicrofinanceenterprises.com';
const PHONE = '+211927094644';
const MAIL_SUBJECT = 'TrustSeed Enquiry';
const MAIL_BODY = 'Hello TrustSeed team,\n\nI would like to know more about your platform.\n\nInstitution:\nName:\n';

const mailtoHref = `mailto:${EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(MAIL_BODY)}`;
const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(EMAIL)}&su=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(MAIL_BODY)}`;

const contactDetails = [
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
    href: `tel:${PHONE}`,
    external: false,
    color: '#1ebcb2',
    breakAll: false,
  },
  {
    icon: Mail,
    label: 'Email',
    value: EMAIL,
    href: mailtoHref,
    external: false,
    isEmail: true,
    color: '#641f60',
    breakAll: true,
  },
  {
    icon: Globe,
    label: 'Website',
    value: 'trustseedmicrofinanceenterprises.com',
    href: 'https://trustseedmicrofinanceenterprises.com',
    external: true,
    color: '#c46040',
    breakAll: true,
  },
];

export function Contact() {
  const handleEmailClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.button !== 0) return;

    e.preventDefault();

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
              const isLink = Boolean(detail.href);
              const content = (
                <div
                  className={`flex items-start gap-4 bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm transition-all w-full min-w-0 ${
                    isLink ? 'hover:shadow-md hover:border-[#1ebcb2]/40 cursor-pointer' : ''
                  }`}
                >
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${detail.color}1A` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: detail.color }} />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-0.5">
                      {detail.label}
                    </p>
                    <p
                      className={`text-slate-900 font-medium ${
                        detail.breakAll ? 'break-all' : 'break-words'
                      } ${isLink ? 'group-hover:text-[#1ebcb2] transition-colors' : ''}`}
                    >
                      {detail.value}
                    </p>
                  </div>
                </div>
              );

              return detail.href ? (
                
                  key={idx}
                  href={detail.href}
                  onClick={detail.isEmail ? handleEmailClick : undefined}
                  {...(detail.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  aria-label={`${detail.label}: ${detail.value}`}
                  className="group block w-full min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ebcb2]"
                >
                  {content}
                </a>
              ) : (
                <div key={idx} className="w-full min-w-0">
                  {content}
                </div>
              );
            })}

            <div className="flex items-start gap-4 bg-[#641f60] rounded-xl p-4 sm:p-5 w-full min-w-0">
              <div className="w-11 h-11 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-xs font-medium uppercase tracking-wide text-white/70 mb-0.5">Response Time</p>
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