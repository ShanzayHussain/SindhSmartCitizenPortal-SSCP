import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import heroBg from '../assets/bg pic.png';

const NAV_LINKS = [
  { name: 'Home', href: '#home' },
  { name: 'Features', href: '#features' },
  { name: 'How It Works', href: '#how-it-works' },
  { name: 'Departments', href: '#departments' },
  { name: 'Contact', href: '#contact' },
];

const FEATURES = [
  { icon: 'Submit', title: 'Easy Complaint Filing', desc: 'File electricity, gas, and water complaints through a focused guided form.' },
  { icon: 'Track', title: 'Live Status Tracking', desc: 'Follow each complaint from pending to resolution with clear status updates.' },
  { icon: 'Route', title: 'Department Routing', desc: 'Send issues directly to KE, SSGC, or Water Board without extra follow-up.' },
  { icon: 'Secure', title: 'Secure Citizen Access', desc: 'Citizen profiles and complaint history stay protected behind authenticated access.' },
];

const STEPS = [
  { num: '01', title: 'Create Account', desc: 'Register once with your citizen details.' },
  { num: '02', title: 'Submit Issue', desc: 'Choose department and explain the problem.' },
  { num: '03', title: 'Track Progress', desc: 'Watch the status update on your dashboard.' },
  { num: '04', title: 'Get Resolution', desc: 'Receive final action from the department.' },
];

const DEPARTMENTS = [
  { name: 'K-Electric', color: '#f97316', desc: 'Power outages, billing, and supply complaints' },
  { name: 'SSGC', color: '#14863e', desc: 'Gas supply, pressure, and service complaints' },
  { name: 'Water Board', color: '#2563eb', desc: 'Water supply, sewerage, and drainage issues' },
];

export default function Landing() {
  const navigate = useNavigate();
  const goToLogin = (role) => navigate(`/login?role=${role}`);

  return (
    <div className="min-h-screen bg-[#f0f4f8] text-[#1f2937]">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#0f1e30]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 border-0 bg-transparent p-0">
            <img src={logo} alt="SSCP" className="h-10 w-10 rounded-full border border-white/20 object-cover" />
            <span className="text-lg font-extrabold text-white">Sindh Smart Citizen Portal</span>
          </button>
          <div className="hidden items-center gap-2 lg:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.name} href={link.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
                {link.name}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => goToLogin('citizen')} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">Citizen Login</button>
            <button onClick={() => goToLogin('admin')} className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#1a2f47] transition hover:bg-[#eef2f7]">Admin Login</button>
          </div>
        </div>
      </nav>

      <section
        id="home"
        className="relative overflow-hidden px-6 pb-16 pt-28"
        style={{ backgroundImage: `linear-gradient(135deg, rgba(15,30,48,0.9), rgba(46,74,111,0.78)), url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-white/90">
              <span className="h-2 w-2 rounded-full bg-[#93c5fd]" /> Official Citizen Complaint Platform
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight lg:text-6xl">Your voice, our responsibility.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/80">
              File utility complaints, track real-time progress, and connect directly with the right Sindh service department from one secure portal.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => goToLogin('citizen')} className="rounded-xl bg-white px-6 py-3 text-base font-extrabold text-[#1a2f47] shadow-xl transition hover:-translate-y-0.5 hover:bg-[#eef2f7]">File a Complaint</button>
              <button onClick={() => navigate('/register')} className="rounded-xl border border-white/25 bg-white/10 px-6 py-3 text-base font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-white/15">Create Account</button>
            </div>
          </div>

          {/* <div className="rounded-[18px] border border-white/20 bg-white/12 p-5 shadow-2xl backdrop-blur-md">
            <div className="rounded-[14px] bg-white p-5">
              <h2 className="m-0 text-xl font-extrabold text-[#1a2f47]">Complaint Overview</h2>
              <p className="mt-1 text-sm text-[#64748b]">A simpler path from issue to resolution.</p>
              <div className="mt-5 grid gap-3">
                {[['Pending', '#f59e0b'], ['In Progress', '#3b82f6'], ['Resolved', '#14863e'], ['Closed', '#dc2626']].map(([label, color], index) => (
                  <div key={label} className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: color }}>{index + 1}</span>
                      <span className="font-bold text-[#334155]">{label}</span>
                    </div>
                    <span className="text-sm font-bold text-[#64748b]">Status</span>
                  </div>
                ))}
              </div> */}
            {/* </div> */}
          {/* </div> */}
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {[
            { value: '24/7', label: 'Online access' },
            { value: '3', label: 'Core departments' },
            { value: '4', label: 'Clear status stages' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[14px] border border-[#d6e0eb] bg-white p-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
              <div className="text-4xl font-extrabold text-[#2E4A6F]">{stat.value}</div>
              <div className="mt-1 text-sm font-bold text-[#64748b]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="bg-white px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-extrabold uppercase tracking-wide text-[#2E4A6F]">Features</p>
            <h2 className="m-0 text-4xl font-extrabold text-[#1a2f47]">Built for citizens and departments</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-[14px] border border-[#d6e0eb] bg-[#f8fafc] p-5 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-4 inline-flex rounded-lg bg-[#dce5f0] px-3 py-2 text-sm font-extrabold text-[#2E4A6F]">{feature.icon}</div>
                <h3 className="mb-2 text-lg font-extrabold text-[#1a2f47]">{feature.title}</h3>
                <p className="m-0 text-sm leading-relaxed text-[#64748b]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-extrabold uppercase tracking-wide text-[#2E4A6F]">How It Works</p>
            <h2 className="m-0 text-4xl font-extrabold text-[#1a2f47]">Four steps from complaint to action</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.num} className="rounded-[14px] border border-[#d6e0eb] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                <div className="text-3xl font-extrabold text-[#2E4A6F]">{step.num}</div>
                <h3 className="mb-2 mt-4 text-lg font-extrabold text-[#1a2f47]">{step.title}</h3>
                <p className="m-0 text-sm leading-relaxed text-[#64748b]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="departments" className="bg-white px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <p className="text-sm font-extrabold uppercase tracking-wide text-[#2E4A6F]">Departments</p>
            <h2 className="m-0 text-4xl font-extrabold text-[#1a2f47]">Coverage for core city utilities</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {DEPARTMENTS.map((department) => (
              <div key={department.name} className="rounded-[14px] border border-[#d6e0eb] bg-[#f8fafc] p-6 text-center">
                <div className="mx-auto mb-4 h-3 w-16 rounded-full" style={{ background: department.color }} />
                <h3 className="mb-2 text-xl font-extrabold" style={{ color: department.color }}>{department.name}</h3>
                <p className="m-0 text-sm text-[#64748b]">{department.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#2E4A6F] px-6 py-14 text-center text-white">
        <h2 className="m-0 text-4xl font-extrabold">Ready to be heard?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-white/75">Create your account and start tracking your complaint with clarity.</p>
        <button onClick={() => navigate('/register')} className="mt-7 rounded-xl bg-white px-8 py-3 text-base font-extrabold text-[#2E4A6F] transition hover:bg-[#eef2f7]">Register Now</button>
      </section>

      <footer id="contact" className="bg-[#0f1e30] px-6 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SSCP" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <div className="font-extrabold">Sindh Smart Citizen Portal</div>
              <div className="text-sm text-white/60">Transparent complaint management for citizens.</div>
            </div>
          </div>
          <div className="text-sm text-white/60">support@sindhportal.gov.pk � 0800-12345 � Karachi, Sindh</div>
        </div>
      </footer>
    </div>
  );
}