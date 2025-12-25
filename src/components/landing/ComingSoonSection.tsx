import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export function ComingSoonSection() {
  const [email, setEmail] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      toast({
        title: "You're on the list!",
        description: "We'll notify you when the autonomous job search launches.",
      });
      setEmail('');
    }
  };

  const features = [
    "Roles that actually match your experience surfaced daily",
    "Résumés and messages tailored for each opportunity",
    "One dashboard instead of 20 spreadsheets",
    "Follow-up reminders so nothing falls through the cracks"
  ];

  return (
    <section id="coming-soon" className="py-20 bg-soft">
      <div className="container">
        <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          {/* Left Column */}
          <div>
            <p className="text-sm text-secondary font-semibold tracking-wider uppercase mb-2">
              Coming Soon
            </p>
            <h2 className="text-3xl font-bold text-foreground leading-tight mb-4">
              Stop applying. Start getting matched.
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              From interview prep to a fully managed job search. Talendro Interview Coach is just the beginning. Next, we're launching Talendro's autonomous job search engine — designed to take the heaviest, most exhausting parts of your job hunt off your plate.
            </p>

            <ul className="space-y-3 mb-8">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-foreground">
                  <span className="text-secondary font-bold">→</span>
                  {feature}
                </li>
              ))}
            </ul>

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-2">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Join Waitlist</Button>
            </form>
            <p className="text-sm text-muted-foreground">
              No spam. Just early access invites and practical job-search insights.
            </p>
          </div>

          {/* Right Column - Card */}
          <div className="bg-card rounded-xl p-6 border-2 border-border">
            <h4 className="font-semibold text-foreground mb-3">Why we're building this for you</h4>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              If you've ever carried the weight of a mortgage, a family, and a career — while staring down a job loss — you know this isn't "just" about getting hired. It's about security, identity, and taking care of the people who depend on you.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Talendro exists to make that load lighter. Interview Coach helps you show up strong in the room. The autonomous job search will help you get into more of the right rooms in the first place.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
