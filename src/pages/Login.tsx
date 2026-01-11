import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useClientAuth } from '@/hooks/useClientAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading, isProSubscriber } = useClientAuth();
  
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (!isLoading && user) {
      if (isProSubscriber) {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    }
  }, [isLoading, user, isProSubscriber, navigate]);

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      toast({
        title: 'Failed to send login link',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setLinkSent(true);
      toast({
        title: 'Login link sent!',
        description: 'Check your email for the login link.',
      });
    }
    
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {linkSent ? (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-2xl font-heading">
                  Check Your Email
                </CardTitle>
                <CardDescription>
                  We've sent a login link to <strong>{email}</strong>
                </CardDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-heading">
                  Sign In
                </CardTitle>
                <CardDescription>
                  Enter your email to receive a secure login link
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {linkSent ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Click the link in your email to sign in. The link expires in 24 hours.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setLinkSent(false)}
                    className="w-full"
                  >
                    Send to a different email
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsSubmitting(true);
                      supabase.auth.signInWithOtp({
                        email,
                        options: {
                          emailRedirectTo: `${window.location.origin}/dashboard`,
                        },
                      }).then(() => {
                        toast({
                          title: 'Link resent!',
                          description: 'Check your email for a new login link.',
                        });
                        setIsSubmitting(false);
                      });
                    }}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Resending...
                      </>
                    ) : (
                      "Didn't receive it? Resend"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Sending link...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Login Link
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  We'll send you a secure link to sign in. No password needed.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
