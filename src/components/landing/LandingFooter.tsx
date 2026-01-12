export function LandingFooter() {
  return (
    <footer className="bg-tal-slate py-8">
      <div className="container">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 text-center md:text-left">
          <p className="text-tal-gray text-sm font-sans">
            © 2025 Talendro<span className="text-secondary">™</span>. All rights reserved.
          </p>
          
          <p className="text-tal-gray text-sm font-sans whitespace-nowrap">
            🇺🇸 American-Built • 🎖️ Veteran-Led • ✔ Recruiter-Tested
          </p>
          
          <div className="flex flex-wrap justify-center md:justify-end gap-4">
            <a href="#products" className="text-tal-gray text-sm font-sans hover:text-primary transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-tal-gray text-sm font-sans hover:text-primary transition-colors">
              FAQ
            </a>
            <a href="mailto:support@talendro.com" className="text-tal-gray text-sm font-sans hover:text-primary transition-colors">
              Support
            </a>
            <a href="/privacy" className="text-tal-gray text-sm font-sans hover:text-primary transition-colors">
              Privacy
            </a>
            <a href="/terms" className="text-tal-gray text-sm font-sans hover:text-primary transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
