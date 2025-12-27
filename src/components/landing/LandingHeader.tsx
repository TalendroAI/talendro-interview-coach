import { Link } from 'react-router-dom';

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="text-2xl font-heading font-bold text-primary">
            Talendro<span className="text-secondary">™</span>
          </Link>
          <nav className="hidden md:flex gap-8">
            <a href="#how-it-works" className="text-tal-gray font-sans font-medium hover:text-primary transition-colors">
              How it Works
            </a>
            <a href="#products" className="text-tal-gray font-sans font-medium hover:text-primary transition-colors">
              Products
            </a>
            <a href="#why" className="text-tal-gray font-sans font-medium hover:text-primary transition-colors">
              Why Talendro
            </a>
            <a href="#coming-soon" className="text-tal-gray font-sans font-medium hover:text-primary transition-colors">
              Coming Soon
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
