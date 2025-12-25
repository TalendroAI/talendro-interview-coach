import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function FinalCTASection() {
  return (
    <section className="py-20 bg-soft text-center">
      <div className="container">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground mb-8">
            Your next interview is coming.<br />
            The only question is whether you'll be ready.
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
            <Button asChild size="lg" className="text-lg px-8 py-6 shadow-brand hover:shadow-brand-lg hover:-translate-y-0.5 transition-all">
              <Link to="/?type=quick_prep&email=">
                Start with Quick Prep — $12
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>

          <p className="text-muted-foreground mb-6">
            Or go deeper with{' '}
            <Link to="/?type=full_mock&email=" className="text-primary font-semibold hover:underline">
              Full Mock — $29
            </Link>
          </p>

          <p className="text-sm text-muted-foreground">
            Built by a recruiter. Powered by AI. Focused on getting you hired.
          </p>
        </div>
      </div>
    </section>
  );
}
