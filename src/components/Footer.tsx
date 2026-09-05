import React from 'react';
import { Mail, Phone, MapPin, Heart, Sparkles, Shield, Award } from 'lucide-react';
import { commonProperties } from '../properties/common.properties';
import { landingProperties } from '../properties/landing.properties';
import { SmartPenLogo } from './SmartPenLogo';

interface FooterProps {
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="bg-white p-2.5 rounded-2xl inline-block shadow-md">
              <SmartPenLogo size="md" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              {landingProperties.footer.brandDescription}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-900/60 border border-blue-700/50 rounded-full text-[11px] text-blue-300 font-semibold">
                <Shield className="w-3 h-3 text-blue-400" />
                {commonProperties.badges.certified}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-900/60 border border-orange-700/50 rounded-full text-[11px] text-orange-300 font-semibold">
                <Award className="w-3 h-3 text-orange-400" />
                {commonProperties.badges.ages}
              </span>
            </div>
          </div>

          {/* Programs & Syllabus */}
          <div>
            <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F46E20]" />
              7-Step Curriculum
            </h3>
            <ul className="space-y-2 text-xs text-slate-400">
              {landingProperties.syllabusSection.modules.map((m, idx) => (
                <li key={idx} className="flex items-center gap-2 hover:text-white transition-colors">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                    {m.number}
                  </span>
                  <span>{m.title}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links & Portals */}
          <div>
            <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4">
              Quick Portals
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <button
                  onClick={() => onNavigate('landing')}
                  className="hover:text-amber-300 transition-colors text-left"
                >
                  {commonProperties.nav.home}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-amber-300 transition-colors text-left"
                >
                  {commonProperties.nav.about}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admin')}
                  className="hover:text-amber-300 transition-colors text-left"
                >
                  {commonProperties.nav.adminDashboard}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('parentPortal')}
                  className="hover:text-amber-300 transition-colors text-left"
                >
                  {commonProperties.nav.parentPortal}
                </button>
              </li>
              <li>
                <span className="text-slate-500">
                  Specialized Workshops (Speed & Cursive Camps)
                </span>
              </li>
            </ul>
          </div>

          {/* Contact & Founder Info */}
          <div>
            <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4">
              Contact & Center
            </h3>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#F46E20] shrink-0 mt-0.5" />
                <span>{commonProperties.contact.location}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href={`tel:${commonProperties.contact.phone}`} className="hover:text-white">
                  {commonProperties.contact.phone}
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                <a href={`mailto:${commonProperties.contact.email}`} className="hover:text-white">
                  {commonProperties.contact.email}
                </a>
              </div>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-white">{commonProperties.founderName}</span>
                <p className="text-slate-500">{commonProperties.founderTitle}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>{landingProperties.footer.legal}</p>
          <div className="flex items-center gap-2 font-kalam text-sm text-slate-400">
            <span>Crafted with</span>
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500 inline" />
            <span>for neat handwriting &amp; joyful learning</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
