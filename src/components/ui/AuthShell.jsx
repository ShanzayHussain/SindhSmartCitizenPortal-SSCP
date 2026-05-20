import React from 'react';
import heroBg from '../../assets/bg pic.png';
import { cn } from './cn';

function AuthShell({ logo, title, subtitle, children, className }) {
  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(15,30,48,0.92), rgba(46,74,111,0.84)), url(${heroBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[18px] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-md lg:grid-cols-[0.9fr_1.1fr]">
          <section className="hidden bg-[#0f1e30]/55 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90">
                <span className="h-2 w-2 rounded-full bg-[#93c5fd]" />
                Sindh Smart Citizen Portal
              </div>
              <h2 className="mt-8 text-4xl font-extrabold leading-tight text-white">Your voice, routed to the right department.</h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
                Sign in to file complaints, track progress, and stay connected with city utility services.
              </p>
            </div>
            {/* <div className="grid grid-cols-3 gap-3 text-center">
              {['Secure', 'Fast', 'Transparent'].map((item) => (
                <div key={item} className="rounded-xl border border-white/15 bg-white/10 px-3 py-4 text-sm font-bold text-white/85">
                  {item}
                </div> */}
              {/* ))} */}
            {/* </div> */}
          </section>

          <section className={cn('bg-white px-6 py-8 text-[#1f2937] sm:px-10', className)}>
            <img
              className="mx-auto mb-4 block h-24 w-24 rounded-full border border-[#c2d0e0] bg-white object-cover shadow-sm"
              src={logo}
              alt="SSCP logo"
            />
            <h1 className="text-center text-2xl font-extrabold text-[#1a2f47]">{title}</h1>
            <h2 className="mt-1 text-center text-base font-bold text-[#2E4A6F]">{subtitle}</h2>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}

export default AuthShell;