import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const products = [
  {
    name: "Quick Prep",
    tagline: "Interview in 48 hours? Start here.",
    price: "$12",
    priceNote: "one-time",
    description: "Get a comprehensive intelligence report with company research, 20+ likely questions, and personalized answers based on your background. Walk in knowing more than any other candidate.",
    features: [
      "6-8 page comprehensive intelligence report delivered instantly",
      "Company research, financials, and culture analysis",
      "20+ likely questions across Strategic, Behavioral, Culture Fit, and Experience categories",
      "Personalized sample answers tailored to your background",
      "Strategic questions to ask the interviewer",
      "Red flags addressed with specific talking points"
    ],
    ctaText: "Get Quick Prep — $12",
    ctaLink: "/?type=quick_prep&email=",
    featured: false
  },
  {
    name: "Full Mock Interview",
    tagline: "Practice before it counts",
    price: "$29",
    priceNote: "one-time",
    description: "Practice with an AI trained on how hiring managers actually evaluate answers. Get honest feedback on whether your responses land, if you're coming across as confident or desperate, and what stories from your background will resonate most.",
    features: [
      "Interactive Q&A session with behavioral and role-specific questions",
      "Real-time feedback on response quality and relevance",
      "Analysis of answer structure and storytelling effectiveness",
      "Detailed strengths identification and improvement recommendations",
      "Complete session transcript with coaching notes"
    ],
    ctaText: "Book Full Mock — $29",
    ctaLink: "/?type=full_mock&email=",
    featured: true
  },
  {
    name: "Premium Audio Mock",
    tagline: "When your voice is everything",
    price: "$49",
    priceNote: "one-time",
    description: "Some candidates are brilliant on paper but struggle when they speak. Practice responding out loud to interview questions and get AI feedback on your delivery, pace, and vocal confidence. Perfect for phone screens and video interviews.",
    features: [
      "Voice-based interview simulation with realistic questions",
      "AI analysis of pace, clarity, and vocal confidence",
      "Feedback on filler words, speaking rhythm, and delivery strength",
      "Coaching on executive presence and authority in your voice",
      "Specific recommendations for stronger vocal performance"
    ],
    ctaText: "Start Audio Mock — $49",
    ctaLink: "/?type=premium_audio&email=",
    featured: false
  },
  {
    name: "Interview Coach Pro",
    tagline: "For active job searches",
    price: "$79",
    priceNote: "/ month",
    description: "Active job search spanning multiple companies? Get unlimited access to all coaching methods, track improvement across interviews, and build confidence through repetition.",
    features: [
      "Unlimited Quick Prep reports for multiple roles and companies",
      "Multiple mock interview sessions with progress tracking",
      "Access to Premium Audio Mock for delivery practice",
      "Regular review and improvement of your interview responses",
      "Priority support and personalized coaching recommendations"
    ],
    note: "Not sure where to start? Quick Prep if you have an interview soon. Full Mock if you want to practice before it counts.",
    ctaText: "Go Pro — $79/month",
    ctaLink: "/?type=pro&email=",
    featured: false
  }
];

export function ProductsSection() {
  return (
    <section id="products" className="py-20 bg-soft">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Choose Your Competitive Advantage
          </h2>
          <p className="text-xl text-muted-foreground">
            Four ways to show up ready
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {products.map((product) => (
            <div
              key={product.name}
              className={cn(
                "bg-card border-2 rounded-xl p-8 transition-all hover:shadow-soft",
                product.featured 
                  ? "border-primary bg-gradient-to-br from-primary/5 to-primary/10" 
                  : "border-border hover:border-primary"
              )}
            >
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-foreground mb-1">{product.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{product.tagline}</p>
                <p className="text-3xl font-extrabold text-primary">
                  {product.price} <span className="text-base font-medium text-muted-foreground">{product.priceNote}</span>
                </p>
              </div>

              <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
                {product.description}
              </p>

              <ul className="space-y-2 mb-6">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="text-foreground text-sm flex items-start gap-2">
                    <span className="text-tal-lime font-bold">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {product.note && (
                <p className="text-sm text-muted-foreground italic border-t border-border pt-4 mb-6">
                  {product.note}
                </p>
              )}

              <Button asChild className="w-full" size="lg">
                <Link to={product.ctaLink}>{product.ctaText}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
