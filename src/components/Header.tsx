import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { SESSION_CONFIGS, SessionType } from '@/types/session';
import { Shield } from 'lucide-react';
import { useState, useEffect } from 'react';

const VALUE_PROPOSITIONS = [
  "30 Years Recruiting Experience",
  "AI-Powered Interview Preparation",
  "Be the Most Prepared Candidate in the Room",
  "From Interview Anxiety to Interview Confidence",
  "Know What They'll Ask Before They Ask It"
];

interface HeaderProps {
  sessionType: SessionType | null;
}

export function Header({ sessionType }: HeaderProps) {
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % VALUE_PROPOSITIONS.length);
        setIsVisible(true);
      }, 300);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="text-2xl font-extrabold text-primary">Talendro™</span>
          <span className="hidden sm:inline text-foreground/70 font-medium text-lg">Interview Coach</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-muted-foreground text-sm min-w-[280px] justify-end">
            <Shield className="w-4 h-4 text-secondary flex-shrink-0" />
            <span 
              className={`transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            >
              {VALUE_PROPOSITIONS[currentIndex]}
            </span>
          </div>
          
          {config && (
            <Badge variant={config.badgeVariant} className="animate-fade-in text-sm px-4 py-1.5">
              {config.icon} {config.name}
            </Badge>
          )}
        </div>
      </div>
    </header>
  );
}