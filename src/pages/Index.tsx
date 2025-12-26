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

  const checkForUpgrades = async () => {
    if (!email || !selectedSession) return;
    
    setIsCheckingUpgrade(true);
    try {
      const upgradeResult = await checkUpgradeCredit(email, selectedSession);
      const config = SESSION_CONFIGS[selectedSession];
      
      setPricing(prev => {
        const upgradeCredit = upgradeResult.upgradeCredit;
        const discountAmount = prev?.discountAmount || 0;
        const finalPrice = Math.max(0, config.priceInCents - upgradeCredit - discountAmount);
        
        return {
          originalPrice: config.priceInCents,
          upgradeCredit,
          discountAmount: prev?.discountAmount || 0,
          discountPercent: prev?.discountPercent || 0,
          discountCode: prev?.discountCode,
          discountCodeId: prev?.discountCodeId,
          finalPrice,
        };
      });

      if (upgradeResult.hasUpgradeCredit) {
        toast({
          title: 'Upgrade credit applied!',
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
      const discountAmount = Math.floor(config.priceInCents * (discountPercent / 100));

      setPricing(prev => {
        const upgradeCredit = prev?.upgradeCredit || 0;
        const finalPrice = Math.max(0, config.priceInCents - upgradeCredit - discountAmount);
        
        return {
          originalPrice: config.priceInCents,
          upgradeCredit,
          discountAmount,
          discountPercent,
          discountCode: promoCode.toUpperCase(),
          discountCodeId: result.code_id,
          finalPrice,
        };
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
        return {
          originalPrice: config.priceInCents,
          upgradeCredit,
          discountAmount: 0,
          discountPercent: 0,
          finalPrice: Math.max(0, config.priceInCents - upgradeCredit),
        };
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

    setIsLoading(true);
    try {
      const checkoutUrl = await createCheckout(
        selectedSession, 
        email,
        pricing?.discountCodeId,
        pricing?.discountPercent
      );
      // Open in new tab to avoid iframe restrictions in preview environments
      window.open(checkoutUrl, '_blank');
      setIsCheckoutOpen(false);
      toast({
        title: 'Redirecting to checkout',
        description: 'Complete your purchase in the next step.',
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
