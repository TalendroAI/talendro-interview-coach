import { SessionType, SESSION_CONFIGS } from '@/types/session';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface WelcomeMessageProps {
  sessionType: SessionType | null;
  userEmail: string | null;
}

export function WelcomeMessage({ sessionType, userEmail }: WelcomeMessageProps) {
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md animate-slide-up">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🎯</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-foreground mb-3">
            Welcome to Interview Coach
          </h2>
          <p className="text-muted-foreground">
            Please select a session type to begin your personalized interview preparation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full animate-slide-up">
        <div className="text-center mb-8">
          <Badge variant={config.badgeVariant} className="mb-4 text-sm px-4 py-1.5">
            {config.icon} {config.name} • {config.price}
          </Badge>
          
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-3">
            Ready to ace your interview!
          </h2>
          
          <p className="text-muted-foreground leading-relaxed">
            {config.description}
          </p>
          
          {userEmail && (
            <p className="text-sm text-primary mt-4">
              Session for: <span className="font-medium">{userEmail}</span>
            </p>
          )}
        </div>

        <div className="bg-muted/50 rounded-xl p-6 border border-border">
          <h3 className="font-heading font-semibold text-foreground mb-4">
            What's included:
          </h3>
          <ul className="space-y-3">
            {config.features.map((feature, index) => (
              <li 
                key={index} 
                className="flex items-center gap-3 text-foreground animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 p-4 bg-accent/50 rounded-lg border border-accent">
          <p className="text-sm text-accent-foreground">
            <span className="font-semibold">Next step:</span> Fill in your documents on the left sidebar, then click "Start {config.name}" to begin.
          </p>
        </div>
      </div>
    </div>
  );
}
