import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SESSION_CONFIGS, SessionType } from '@/types/session';
import { createCheckout } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { ProductsSection } from '@/components/landing/ProductsSection';
import { WhySection } from '@/components/landing/WhySection';
import { ComingSoonSection } from '@/components/landing/ComingSoonSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { FinalCTASection } from '@/components/landing/FinalCTASection';

export default function Index() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionType | null>(null);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Open checkout dialog for a session type
  const openCheckout = useCallback((sessionType: SessionType) => {
    setSelectedSession(sessionType);
    setIsCheckoutOpen(true);
    // Clear URL params after opening dialog
    setSearchParams({});
  }, [setSearchParams]);

  // Check for session type in URL params
  useEffect(() => {
    const typeParam = searchParams.get('type') as SessionType | null;
    
    if (typeParam && SESSION_CONFIGS[typeParam]) {
      openCheckout(typeParam);
    }
  }, [searchParams, openCheckout]);

  const handleCheckout = async () => {
    if (!selectedSession || !email) {
      toast({
        title: 'Email required',
        description: 'Please enter your email to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const checkoutUrl = await createCheckout(selectedSession, email);
      window.open(checkoutUrl, '_blank');
      setIsCheckoutOpen(false);
      toast({
        title: 'Redirecting to checkout',
        description: 'Complete your purchase in the new tab.',
      });
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedConfig = selectedSession ? SESSION_CONFIGS[selectedSession] : null;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      
      <main>
        <HeroSection onSelectSession={openCheckout} />
        <HowItWorksSection />
        <ProductsSection />
        <WhySection />
        <ComingSoonSection />
        <FAQSection />
        <FinalCTASection />
      </main>

      <LandingFooter />

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {selectedConfig?.icon} {selectedConfig?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your email to continue to checkout.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="bg-muted rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">{selectedConfig?.name}</span>
                <span className="font-heading font-bold text-lg">{selectedConfig?.price}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsCheckoutOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={handleCheckout}
              disabled={isLoading || !email}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Continue to Checkout'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
