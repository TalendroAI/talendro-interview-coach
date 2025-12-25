import { Link } from 'react-router-dom';

export function LandingFooter() {
  return (
    <footer className="bg-background border-t border-border py-8">
      <div className="container">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © 2025 Talendro™. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#products" className="text-muted-foreground text-sm hover:text-primary transition-colors">
              Pricing
            </a>
            <a href="#why" className="text-muted-foreground text-sm hover:text-primary transition-colors">
              Why Talendro
            </a>
            <a href="#coming-soon" className="text-muted-foreground text-sm hover:text-primary transition-colors">
              Coming Soon
            </a>
            <a href="mailto:support@talendro.com" className="text-muted-foreground text-sm hover:text-primary transition-colors">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
