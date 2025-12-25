import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LandingHeader />
      
      <main className="flex-1 container py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-heading text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground">
              <em>Last updated: December 2025</em>
            </p>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">1. Information We Collect</h2>
              <p>When you use Talendro Interview Coach, we collect:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Contact Information:</strong> Email address provided during checkout</li>
                <li><strong>Session Content:</strong> Resumes, job descriptions, and company URLs you upload for interview preparation</li>
                <li><strong>Conversation Data:</strong> Chat and audio transcripts from your coaching sessions</li>
                <li><strong>Payment Information:</strong> Processed securely by Stripe; we do not store credit card numbers</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">2. How We Use Your Information</h2>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide personalized interview coaching sessions</li>
                <li>Generate tailored prep packets and feedback</li>
                <li>Send session results and receipts via email</li>
                <li>Improve our AI coaching algorithms</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">3. Data Security</h2>
              <p>
                We implement industry-standard security measures to protect your personal information. 
                All data is encrypted in transit and at rest. We use secure third-party services 
                (Stripe for payments, Supabase for data storage) that maintain SOC 2 compliance.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">4. Data Retention</h2>
              <p>
                Session data is retained for 90 days to allow you to access your results. 
                After this period, session content is automatically deleted. 
                You may request early deletion by contacting support.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">5. Third-Party Services</h2>
              <p>We use the following third-party services:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Stripe:</strong> Payment processing</li>
                <li><strong>Anthropic (Claude):</strong> AI coaching engine</li>
                <li><strong>ElevenLabs:</strong> Voice AI for audio interviews</li>
                <li><strong>Resend:</strong> Email delivery</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">6. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access your personal data</li>
                <li>Request deletion of your data</li>
                <li>Opt out of marketing communications</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-2xl font-semibold">7. Contact Us</h2>
              <p>
                For privacy-related questions, contact us at{' '}
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
