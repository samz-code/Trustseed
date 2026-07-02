import { Building2, Clock, Globe, Mail, MessageSquare, Phone, Send, User } from 'lucide-react';

const contactDetails = [
  {
    icon: Building2,
    label: 'Office',
    value: 'Nairobi, Kenya | Kampala, Uganda | Juba, South Sudan',
    color: '#ee7b22',
  },
  {
    icon: Phone,
    label: 'Phone',
    value: '+211989333231',
    color: '#1ebcb2',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'hello@trustseedmicrofinanceenterprises.com',
    color: '#641f60',
  },
  {
    icon: Globe,
    label: 'Website',
    value: 'trustseedmicrofinanceenterprises.com',
    href: 'https://trustseedmicrofinanceenterprises.com',
    color: '#c46040',
  },
];

export function Contact() {
  return (
    <section id="contact" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Let's Talk About Your Institution</h2>
          <p className="text-lg text-slate-600">
            Have questions or ready for a demo? Reach out and our team will respond within 24 hours.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Contact info column */}
          <div className="lg:col-span-2 space-y-4">
            {contactDetails.map((detail, idx) => {
              const Icon = detail.icon;
              const content = (
                <div className="flex items-start gap-4 bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-[#1ebcb2]/40 transition-all">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${detail.color}1A` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: detail.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-0.5">
                      {detail.label}
                    </p>
                    <p className="text-slate-900 font-medium break-words">{detail.value}</p>
                  </div>
                </div>
              );

              return detail.href ? (
                <a key={idx} href={detail.href} target="_blank" rel="noopener noreferrer" className="block">
                  {content}
                </a>
              ) : (
                <div key={idx}>{content}</div>
              );
            })}

            <div className="flex items-start gap-4 bg-[#641f60] rounded-xl p-5">
              <div className="w-11 h-11 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-white/70 mb-0.5">Response Time</p>
                <p className="text-white font-medium">We reply within 24 hours, Mon–Fri</p>
              </div>
            </div>
          </div>

          {/* Form column */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <form className="space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="Emoni"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="Samuel"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="emoni@institution.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Institution Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="Your institution name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <textarea
                    rows={4}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="How can we help you?"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#ee7b22] text-white font-medium rounded-lg shadow-lg hover:bg-[#c46040] transition-all flex items-center justify-center gap-2"
              >
                Send Message
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}