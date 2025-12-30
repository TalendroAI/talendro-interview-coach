import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SessionConfig, PricingBreakdown } from '@/types/session';
import { Loader2, Tag, ChevronDown, ChevronUp, X, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedConfig: SessionConfig | null;
  email: string;
  onEmailChange: (email: string) => void;
  promoCode: string;
  onPromoCodeChange: (code: string) => void;
  onApplyPromoCode: () => void;
  onRemovePromoCode: () => void;
  isValidatingPromo: boolean;
  promoError: string | null;
  pricing: PricingBreakdown | null;
  isCheckingUpgrade: boolean;
  isLoading: boolean;
  onCheckout: () => void;
}

export function CheckoutDialog({
  isOpen,
  onClose,
  selectedConfig,
  email,
  onEmailChange,
  promoCode,
  onPromoCodeChange,
  onApplyPromoCode,
  onRemovePromoCode,
  isValidatingPromo,
  promoError,
  pricing,
  isCheckingUpgrade,
  isLoading,
  onCheckout,
}: CheckoutDialogProps) {
  const [isPromoOpen, setIsPromoOpen] = useState(false);

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const hasDiscount = pricing && pricing.appliedDiscount > 0;
  const hasAppliedPromo = pricing?.discountCode && pricing.discountAmount > 0;
  
  // Show which discount won when both are available
  const showDiscountExplanation = pricing && pricing.upgradeCredit > 0 && pricing.discountAmount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>

          {/* Promo Code Section */}
          <Collapsible open={isPromoOpen || hasAppliedPromo} onOpenChange={setIsPromoOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between px-0 hover:bg-transparent"
                disabled={hasAppliedPromo}
              >
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  {hasAppliedPromo ? `Promo code applied: ${pricing.discountCode}` : 'Have a promo code?'}
                </span>
                {!hasAppliedPromo && (
                  isPromoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {hasAppliedPromo ? (
                <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      {pricing.discountPercent}% off applied
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRemovePromoCode}
                    className="h-auto p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={promoCode}
                      onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
                      className={cn(promoError && "border-destructive")}
                    />
                    <Button
                      variant="secondary"
                      onClick={onApplyPromoCode}
                      disabled={!promoCode || !email || isValidatingPromo}
                    >
                      {isValidatingPromo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  </div>
                  {promoError && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {promoError}
                    </div>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
          
          {/* Pricing Breakdown */}
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-medium">{selectedConfig?.name}</span>
              <span className={cn(
                "font-heading font-bold text-lg",
                hasDiscount && "text-muted-foreground line-through text-sm"
              )}>
                {selectedConfig?.price}
              </span>
            </div>

            {/* Applied Discount Line (only show the winning one) */}
            {pricing && pricing.appliedDiscount > 0 && (
              <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400">
                <span>
                  {pricing.appliedDiscountType === 'upgrade' 
                    ? 'Upgrade credit' 
                    : `Promo (${pricing.discountPercent}% off)`}
                </span>
                <span>-{formatPrice(pricing.appliedDiscount)}</span>
              </div>
            )}

            {/* Explanation when both discounts available but only one applied */}
            {showDiscountExplanation && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-1">
                {pricing.appliedDiscountType === 'upgrade' ? (
                  <>
                    ✓ Upgrade credit applied ({formatPrice(pricing.upgradeCredit)}) — better than your promo code ({formatPrice(pricing.discountAmount)})
                  </>
                ) : (
                  <>
                    ✓ Promo code applied ({formatPrice(pricing.discountAmount)}) — better than upgrade credit ({formatPrice(pricing.upgradeCredit)})
                  </>
                )}
              </div>
            )}

            {/* Final Price */}
            {hasDiscount && pricing && (
              <>
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="font-heading font-bold text-xl text-primary">
                      {formatPrice(pricing.finalPrice)}
                      {selectedConfig?.type === 'pro' && <span className="text-sm font-normal">/month</span>}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  You save {formatPrice(pricing.appliedDiscount)}!
                </div>
              </>
            )}

            {/* Loading state for upgrade check */}
            {isCheckingUpgrade && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking for upgrade credits...
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={onCheckout}
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
  );
}
