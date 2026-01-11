import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SESSION_CONFIGS, SessionType, PricingBreakdown } from '@/types/session';
import { createCheckout, validateDiscountCode, checkUpgradeCredit } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

import { CheckoutDiagnostics } from '@/components/CheckoutDiagnostics';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { ProductsSection } from '@/components/landing/ProductsSection';
import { WhySection } from '@/components/landing/WhySection';
import { ComingSoonSection } from '@/components/landing/ComingSoonSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { FinalCTASection } from '@/components/landing/FinalCTASection';
import { CheckoutDialog } from '@/components/CheckoutDialog';

export default function Index() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionType | null>(null);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  
  // Pricing state
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [isCheckingUpgrade, setIsCheckingUpgrade] = useState(false);

  const debugParam = searchParams.get('debug');
  const debugEnabled = debugParam === '1' || debugParam === 'true';

  // Reset pricing when session changes
  useEffect(() => {
    if (selectedSession) {
      const config = SESSION_CONFIGS[selectedSession];
      setPricing({
        originalPrice: config.priceInCents,
        upgradeCredit: 0,
        discountAmount: 0,
        discountPercent: 0,
        appliedDiscountType: 'none',
        appliedDiscount: 0,
        finalPrice: config.priceInCents,
      });
    }
  }, [selectedSession]);

  // Check for upgrade credits when email changes
  useEffect(() => {
    if (email && selectedSession && email.includes('@')) {
      checkForUpgrades();
    }
  }, [email, selectedSession]);

  // Helper to determine winning discount
  const calculateWinningDiscount = (
    upgradeCredit: number,
    promoDiscount: number,
    originalPrice: number,
    discountPercent?: number,
    discountCode?: string,
    discountCodeId?: string
  ): PricingBreakdown => {
    let appliedDiscountType: 'none' | 'upgrade' | 'promo' = 'none';
    let appliedDiscount = 0;

    if (upgradeCredit > 0 || promoDiscount > 0) {
      if (upgradeCredit >= promoDiscount) {
        appliedDiscountType = 'upgrade';
        appliedDiscount = upgradeCredit;
      } else {
        appliedDiscountType = 'promo';
        appliedDiscount = promoDiscount;
      }
    }

    const finalPrice = Math.max(0, originalPrice - appliedDiscount);

    return {
      originalPrice,
      upgradeCredit,
      discountAmount: promoDiscount,
      discountPercent: discountPercent || 0,
      discountCode,
      discountCodeId,
      appliedDiscountType,
      appliedDiscount,
      finalPrice,
    };
  };

  const checkForUpgrades = async () => {
    if (!email || !selectedSession) return;
    
    setIsCheckingUpgrade(true);
    try {
      const upgradeResult = await checkUpgradeCredit(email, selectedSession);
      const config = SESSION_CONFIGS[selectedSession];
      
      setPricing(prev => {
        const upgradeCredit = upgradeResult.upgradeCredit;
        const promoDiscount = prev?.discountAmount || 0;
        
        return calculateWinningDiscount(
          upgradeCredit,
          promoDiscount,
          config.priceInCents,
          prev?.discountPercent,
          prev?.discountCode,
          prev?.discountCodeId
        );
      });

      if (upgradeResult.hasUpgradeCredit) {
        toast({
          title: 'Upgrade credit available!',
          description: `$${(upgradeResult.upgradeCredit / 100).toFixed(2)} credit from your recent ${upgradeResult.upgradedFromType?.replace('_', ' ')} purchase.`,
        });
      }
    } catch (error) {
      console.error('Error checking upgrades:', error);
    } finally {
      setIsCheckingUpgrade(false);
    }
  };

  const handleApplyPromoCode = async () => {
    if (!promoCode || !email || !selectedSession) {
      setPromoError('Please enter your email first');
      return;
    }

    setIsValidatingPromo(true);
    setPromoError(null);

    try {
      const result = await validateDiscountCode(promoCode, email, selectedSession);
      
      if (!result.valid) {
        setPromoError(result.error || 'Invalid promo code');
        return;
      }

      const config = SESSION_CONFIGS[selectedSession];
      const discountPercent = result.discount_percent || 0;
      const promoDiscount = Math.floor(config.priceInCents * (discountPercent / 100));

      setPricing(prev => {
        const upgradeCredit = prev?.upgradeCredit || 0;
        
        return calculateWinningDiscount(
          upgradeCredit,
          promoDiscount,
          config.priceInCents,
          discountPercent,
          promoCode.toUpperCase(),
          result.code_id
        );
      });

      toast({
        title: 'Promo code applied!',
        description: `${discountPercent}% discount: ${result.description}`,
      });
    } catch (error) {
      console.error('Error validating promo:', error);
      setPromoError('Failed to validate code');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemovePromoCode = () => {
    setPromoCode('');
    setPromoError(null);
    
    if (selectedSession) {
      const config = SESSION_CONFIGS[selectedSession];
      setPricing(prev => {
        const upgradeCredit = prev?.upgradeCredit || 0;
        return calculateWinningDiscount(
          upgradeCredit,
          0, // promo removed
          config.priceInCents,
          0,
          undefined,
          undefined
        );
      });
    }
  };

  // Open checkout dialog for a session type
  const openCheckout = useCallback((sessionType: SessionType) => {
    setSelectedSession(sessionType);
    setIsCheckoutOpen(true);
    setPromoCode('');
    setPromoError(null);
    // Clear URL params after opening dialog, but preserve debug flag if present
    setSearchParams(debugParam ? { debug: debugParam } : {});
  }, [setSearchParams, debugParam]);

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

    // In embedded preview/iframes, Stripe Checkout often can't redirect the current frame.
    // Also, some browsers block popups that aren't opened synchronously from a user gesture.
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    // If we're in an iframe, pre-open a blank tab *synchronously* so it won't get popup-blocked.
    const popup = inIframe ? window.open('', '_blank', 'noopener,noreferrer') : null;

    const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
      let timeoutId: number | undefined;
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            timeoutId = window.setTimeout(() => {
              reject(new Error('Checkout request timed out. Please try again.'));
            }, ms);
          }),
        ]);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    };

    setIsLoading(true);
    try {
      const checkoutUrl = await withTimeout(
        createCheckout(
          selectedSession,
          email,
          pricing?.discountCodeId,
          pricing?.discountPercent
        ),
        20000
      );

      if (inIframe) {
        // Prefer the pre-opened window (avoids popup blockers)
        if (popup && !popup.closed) {
          popup.location.href = checkoutUrl;
        } else {
          window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        }

        // Keep the toast in iframe environments since the user stays on-page.
        toast({
          title: 'Opening Stripe checkout',
          description: 'Complete your purchase in the new tab.',
        });
      } else {
        // Production: redirect in the same tab for the most reliable behavior.
        window.location.assign(checkoutUrl);
      }

      setIsCheckoutOpen(false);
    } catch (error) {
      // Close the pre-opened tab if we failed to produce a URL.
      try {
        if (popup && !popup.closed) popup.close();
      } catch {
        // ignore
      }

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

  const handleCloseDialog = () => {
    setIsCheckoutOpen(false);
    setPromoCode('');
    setPromoError(null);
  };

  const selectedConfig = selectedSession ? SESSION_CONFIGS[selectedSession] : null;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main>
        {debugEnabled && (
          <aside className="container pt-6">
            <CheckoutDiagnostics defaultEmail={email} />
          </aside>
        )}
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
      <CheckoutDialog
        isOpen={isCheckoutOpen}
        onClose={handleCloseDialog}
        selectedConfig={selectedConfig}
        email={email}
        onEmailChange={setEmail}
        promoCode={promoCode}
        onPromoCodeChange={setPromoCode}
        onApplyPromoCode={handleApplyPromoCode}
        onRemovePromoCode={handleRemovePromoCode}
        isValidatingPromo={isValidatingPromo}
        promoError={promoError}
        pricing={pricing}
        isCheckingUpgrade={isCheckingUpgrade}
        isLoading={isLoading}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
