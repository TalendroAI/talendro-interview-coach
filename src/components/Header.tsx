import { Badge } from '@/components/ui/badge';
import { SESSION_CONFIGS, SessionType } from '@/types/session';

interface HeaderProps {
  sessionType: SessionType | null;
}

export function Header({ sessionType }: HeaderProps) {
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">T</span>
            </div>
            <h1 className="font-heading text-xl font-bold text-foreground">
              Talendro<span className="text-primary">™</span>{' '}
              <span className="hidden sm:inline text-muted-foreground font-normal">Interview Coach</span>
            </h1>
          </div>
        </div>

        {config && (
          <Badge variant={config.badgeVariant} className="animate-fade-in">
            {config.icon} {config.name}
          </Badge>
        )}
      </div>
    </header>
  );
}
