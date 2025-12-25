import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingHeader />
      
      <main className="flex-1 container py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-heading text-4xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground">
              <em>Last updated: December 2025</em>
            </p>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Talendro Interview Coach ("Service"), you agree to be bound 
                by these Terms of Service. If you do not agree, please do not use the Service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">2. Description of Service</h2>
              <p>
                Talendro provides AI-powered interview coaching services including preparation packets, 
                mock interviews, and audio-based practice sessions. The Service is designed to help 
                job seekers prepare for interviews but does not guarantee employment outcomes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">3. User Accounts & Purchases</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>You must provide a valid email address for session delivery</li>
                <li>One-time purchases grant access to a single session type</li>
                <li>Pro subscriptions renew monthly until cancelled</li>
                <li>All purchases are final; refunds are provided at our sole discretion</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">4. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Upload illegal, harmful, or offensive content</li>
                <li>Attempt to reverse-engineer or exploit the Service</li>
                <li>Share or resell access to sessions</li>
                <li>Use the Service for any unlawful purpose</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">5. Intellectual Property</h2>
              <p>
                All content, features, and functionality of the Service are owned by Talendro. 
                Content you upload (resumes, job descriptions) remains your property. 
                By using the Service, you grant us a limited license to process your content 
                for coaching purposes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">6. AI-Generated Content</h2>
              <p>
                Our coaching sessions use artificial intelligence. While we strive for accuracy, 
                AI responses may contain errors or inconsistencies. You should verify important 
                information independently and not rely solely on AI guidance for career decisions.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">7. Limitation of Liability</h2>
              <p>
                Talendro is provided "as is" without warranties of any kind. We are not liable 
                for any indirect, incidental, or consequential damages arising from your use 
                of the Service. Our total liability is limited to the amount you paid for the Service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">8. Cancellation & Refunds</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Pro subscriptions can be cancelled anytime via email</li>
                <li>Cancellation takes effect at the end of the current billing period</li>
                <li>No partial refunds for unused subscription time</li>
                <li>One-time session purchases are non-refundable once accessed</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">9. Changes to Terms</h2>
              <p>
                We may update these terms periodically. Continued use of the Service after 
                changes constitutes acceptance of the updated terms.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">10. Contact</h2>
              <p>
                Questions about these terms? Contact us at{' '}
                <a href="mailto:support@talendro.com" className="text-primary hover:underline">
                  support@talendro.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      
      <LandingFooter />
    </div>
  );
}
