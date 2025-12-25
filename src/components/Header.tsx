import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { SESSION_CONFIGS, SessionType } from '@/types/session';

interface HeaderProps {
  sessionType: SessionType | null;
}

export function Header({ sessionType }: HeaderProps) {
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="text-2xl font-extrabold text-primary">
          Talendro™ <span className="hidden sm:inline text-muted-foreground font-medium text-lg">Interview Coach</span>
        </Link>

        {config && (
          <Badge variant={config.badgeVariant} className="animate-fade-in text-sm px-4 py-1.5">
            {config.icon} {config.name}
          </Badge>
        )}
      </div>
    </header>
  );
}