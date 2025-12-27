import { ArrowRight, CheckCircle, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionType } from '@/types/session';

interface HeroSectionProps {
  onSelectSession?: (sessionType: SessionType) => void;
}

export function HeroSection({ onSelectSession }: HeroSectionProps) {
  return (
    <section className="pt-32 pb-16 bg-tal-soft text-center">
      <div className="container">
        <div className="max-w-3xl mx-auto">
          {/* Authority Badge */}
          <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-4 py-2 rounded-full text-sm font-sans font-medium mb-8">
            <Shield className="w-4 h-4" />
            Built by veteran recruiting executive • 30 years experience
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold leading-tight mb-6 text-tal-navy">
            Walk in confident—<span className="text-primary">walk out hired</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-tal-gray font-sans mb-10 max-w-2xl mx-auto">
            AI-powered interview coaching engineered for <strong className="text-tal-slate font-semibold">behavioral and situational questions</strong>, company and industry intelligence, and role-specific delivery.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6 shadow-brand hover:shadow-brand-lg hover:-translate-y-0.5 transition-all"
              onClick={() => onSelectSession?.('full_mock')}
            >
              Start Full Mock Interview — $29
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-6 border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all"
              onClick={() => onSelectSession?.('quick_prep')}
            >
              Quick Prep — $12
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-8">
            <div className="flex items-center gap-2 text-tal-gray font-sans text-sm">
              <CheckCircle className="w-4 h-4 text-primary" />
              Real questions from real interviews
            </div>
            <div className="flex items-center gap-2 text-tal-gray font-sans text-sm">
              <CheckCircle className="w-4 h-4 text-primary" />
              Feedback hiring managers actually give
            </div>
            <div className="flex items-center gap-2 text-tal-gray font-sans text-sm">
              <Clock className="w-4 h-4 text-primary" />
              No awkward scheduling
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
