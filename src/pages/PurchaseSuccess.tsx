import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Mail, RefreshCw, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function PurchaseSuccess() {
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState('');
  const [showResendForm, setShowResendForm] = useState(false);

  const handleResendLink = async () => {
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      toast({
        title: 'Failed to send link',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Login link sent!',
        description: 'Check your email for the login link.',
      });
      setShowResendForm(false);
    }
    
    setIsResending(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-2xl font-heading font-bold text-primary">Talendro<span className="text-secondary">™</span></span>
            <span className="hidden sm:inline text-tal-gray font-sans font-medium text-lg">Interview Coach</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-heading">
              Welcome to Interview Coach Pro!
            </CardTitle>
            <CardDescription className="text-base">
              Your subscription is now active.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg text-left">
              <Mail className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Check your email</p>
                <p className="text-sm text-muted-foreground">
                  We've sent a login link to access your dashboard.
                </p>
              </div>
            </div>

            <div className="bg-accent/50 rounded-lg p-4 text-left">
              <p className="font-medium text-foreground mb-2">Your subscription includes:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Unlimited Quick Prep sessions</li>
                <li>✓ 6 Mock Interviews per month</li>
                <li>✓ 2 Audio Mocks per month</li>
              </ul>
            </div>

            {!showResendForm ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email?
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowResendForm(true)}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Resend Login Link
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-2 border border-border rounded-md bg-background"
                />
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowResendForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleResendLink}
                    disabled={isResending}
                    className="gap-2"
                  >
                    {isResending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Send Link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <Link to="/login">
                <Button variant="ghost" className="gap-2 text-muted-foreground">
                  Already have the link? Sign in here
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
