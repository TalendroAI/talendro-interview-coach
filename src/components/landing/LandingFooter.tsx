export function LandingFooter() {
  return (
    <footer className="py-8" style={{ backgroundColor: '#0F172A' }}>
      <div className="container">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 text-center md:text-left">
          <p className="text-white/90 text-sm font-sans">
            © 2026 Talendro<span className="text-secondary">™</span>. All rights reserved.
          </p>
          
          <p className="text-white/80 text-sm font-sans whitespace-nowrap">
            🇺🇸 American-Built • 🎖️ Veteran-Led • ✓ Recruiter-Tested
          </p>
          
          <div className="flex flex-wrap justify-center md:justify-end gap-4">
            <a href="#pricing" className="text-white/80 text-sm font-sans hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-white/80 text-sm font-sans hover:text-white transition-colors">
              FAQ
            </a>
            <a href="mailto:support@talendro.com" className="text-white/80 text-sm font-sans hover:text-white transition-colors">
              Support
            </a>
            <a href="/privacy" className="text-white/80 text-sm font-sans hover:text-white transition-colors">
              Privacy
            </a>
            <a href="/terms" className="text-white/80 text-sm font-sans hover:text-white transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}