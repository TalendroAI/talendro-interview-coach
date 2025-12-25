import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SESSION_CONFIGS, SessionType } from '@/types/session';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

const sessionOrder: SessionType[] = ['quick_prep', 'full_mock', 'premium_audio', 'pro'];

export default function Index() {
  const navigate = useNavigate();

  const handleSessionSelect = (type: SessionType) => {
    navigate(`/interview-coach?session_type=${type}&email=demo@example.com`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Talendro<span className="text-primary">™</span>
            </h1>
          </div>
          <Button variant="outline" size="sm">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center animate-slide-up">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-Powered Interview Coaching
          </Badge>
          
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Ace Your Next Interview with{' '}
            <span className="text-gradient">AI Coaching</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            Get personalized interview preparation, practice with AI mock interviews, 
            and receive expert feedback—all tailored to your resume and target role.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="brand" 
              size="xl"
              onClick={() => handleSessionSelect('quick_prep')}
            >
              Start Quick Prep
              <ArrowRight className="h-5 w-5 ml-1" />
            </Button>
            <Button 
              variant="outline" 
              size="xl"
              onClick={() => handleSessionSelect('full_mock')}
            >
              Try Mock Interview
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Choose Your Coaching Experience
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From quick prep packets to immersive voice interviews, we have the right option for your preparation style.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {sessionOrder.map((type, index) => {
            const config = SESSION_CONFIGS[type];
            const isPro = type === 'pro';
            
            return (
              <div
                key={type}
                className={`relative rounded-2xl border bg-card p-6 flex flex-col animate-slide-up hover:shadow-brand-lg transition-all duration-300 ${
                  isPro ? 'border-session-pro ring-2 ring-session-pro/20' : 'border-border hover:border-primary/50'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="pro" className="px-3">
                      Most Popular
                    </Badge>
                  </div>
                )}
                
                <div className="text-3xl mb-4">{config.icon}</div>
                
                <Badge variant={config.badgeVariant} className="w-fit mb-3">
                  {config.name}
                </Badge>
                
                <div className="mb-4">
                  <span className="font-heading text-3xl font-bold text-foreground">
                    {config.price}
                  </span>
                  {isPro && (
                    <span className="text-muted-foreground text-sm">/month</span>
                  )}
                </div>
                
                <p className="text-muted-foreground text-sm mb-6 flex-grow">
                  {config.description}
                </p>
                
                <ul className="space-y-2 mb-6">
                  {config.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  variant={config.badgeVariant}
                  className="w-full"
                  onClick={() => handleSessionSelect(type)}
                >
                  Get Started
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">T</span>
              </div>
              <span className="font-heading font-semibold text-foreground">
                Talendro™ Interview Coach
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Talendro. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
