export function LandingFooter() {
  return (
    <footer className="bg-background border-t border-border py-8">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-center md:text-left">
          <p className="text-muted-foreground text-sm">
            © 2025 Talendro™. All rights reserved.
          </p>
          
          <p className="text-muted-foreground text-sm md:text-center whitespace-nowrap">
            🇺🇸 American-Built • 🎖️ Veteran-Led • ✔ Recruiter-Tested
          </p>
          
          <div className="flex flex-wrap justify-center md:justify-end gap-4">
            <a href="#products" className="text-muted-foreground text-sm hover:text-primary transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-muted-foreground text-sm hover:text-primary transition-colors">
              FAQ
            </a>
            <a href="mailto:support@talendro.com" className="text-muted-foreground text-sm hover:text-primary transition-colors">
              Support
            </a>
            <a href="/privacy" className="text-muted-foreground text-sm hover:text-primary transition-colors">
              Privacy
            </a>
            <a href="/terms" className="text-muted-foreground text-sm hover:text-primary transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
