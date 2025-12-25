import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { SESSION_CONFIGS, SessionType } from '@/types/session';
import { Shield } from 'lucide-react';

interface HeaderProps {
  sessionType: SessionType | null;
}

export function Header({ sessionType }: HeaderProps) {
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;

  return (
    <header className="sticky top-0 z-50 w-full bg-foreground border-b border-foreground/20">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="text-2xl font-extrabold text-primary">Talendro™</span>
          <span className="hidden sm:inline text-background/80 font-medium text-lg">Interview Coach</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-background/60 text-sm">
            <Shield className="w-4 h-4 text-secondary" />
            <span>30 Years Recruiting Experience</span>
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