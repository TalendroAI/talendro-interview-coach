import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container">
        <div className="flex justify-between items-center py-4">
          {/* Logo links to main Talendro hub */}
          <a 
            href="https://talendro.com" 
            className="text-2xl font-heading font-bold text-primary"
          >
            Talendro<span className="text-secondary">™</span>
          </a>
          
          <div className="flex items-center gap-4">
            {/* Navigation Links - hidden on mobile */}
            <nav className="hidden md:flex gap-8">
              <a href="#how-it-works" className="text-tal-slate font-sans font-medium hover:text-primary transition-colors">
                How it Works
              </a>
              <a href="#pricing" className="text-tal-slate font-sans font-medium hover:text-primary transition-colors">
                Products
              </a>
              <a href="#why-talendro" className="text-tal-slate font-sans font-medium hover:text-primary transition-colors">
                Why Talendro
              </a>
            </nav>

            {/* Simple Login Button - no user state shown */}
            <Link to="/login">
              <Button variant="outline" size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Login</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}