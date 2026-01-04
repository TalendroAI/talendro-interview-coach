import { SessionType, SESSION_CONFIGS } from '@/types/session';
import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeMessageProps {
  sessionType: SessionType | null;
  userEmail: string | null;
  isPaymentVerified?: boolean;
  isReady?: boolean;
  onStartSession?: () => void;
}

export function WelcomeMessage({ 
  sessionType, 
  userEmail, 
  isPaymentVerified = false,
  isReady = false,
  onStartSession 
}: WelcomeMessageProps) {
  const config = sessionType ? SESSION_CONFIGS[sessionType] : null;

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-hero">
        <div className="text-center max-w-md animate-slide-up">
          <div className="text-5xl mb-6">🎯</div>
          <h2 className="text-2xl font-extrabold text-foreground mb-3">
            Welcome to Interview Coach
          </h2>
          <p className="text-muted-foreground">
            Please select a session type to begin your personalized interview preparation.
          </p>
        </div>
      </div>
    );
  }

  // Get session-specific instructions
  const getSessionInstructions = () => {
    switch (sessionType) {
      case 'quick_prep':
        return {
          title: 'Quick Prep Session',
          icon: '⚡',
          steps: [
            { num: 1, text: 'Select, copy, and paste all of the contents from your **résumé** into the space provided.\n\n**Mac:** Press ⌘ + A (select), then ⌘ + C (copy), then click in the field and press ⌘ + V (paste)\n\n**Windows:** Press Ctrl + A (select), then Ctrl + C (copy), then click in the field and press Ctrl + V (paste)', highlight: 'résumé' },
            { num: 2, text: 'Select, copy, and paste all of the contents from the **job description** into the space provided.\n\n**Mac:** Press ⌘ + A (select), then ⌘ + C (copy), then click in the field and press ⌘ + V (paste)\n\n**Windows:** Press Ctrl + A (select), then Ctrl + C (copy), then click in the field and press Ctrl + V (paste)', highlight: 'job description' },
            { num: 3, text: 'Enter the **company URL** in the sidebar', highlight: 'company URL' },
            { num: 4, text: 'Click "**📋 Save Documents & Proceed**" in the sidebar', highlight: '📋 Save Documents & Proceed' },
            { num: 5, text: 'Click "**Complete Session & Get Results**" to finish and receive your summary', highlight: 'Complete Session & Get Results' },
          ],
          tip: 'Quick Prep provides a concise overview of key talking points in under 5 minutes.',
        };
      case 'full_mock':
        return {
          title: 'Full Mock Interview',
          icon: '🎯',
          steps: [
            { num: 1, text: 'Enter your **first/preferred name** in the sidebar (what you want Sarah to call you)', highlight: 'first/preferred name' },
            { num: 2, text: 'Select, copy, and paste all of the contents from your **résumé** into the space provided.\n\n**Mac:** Press ⌘ + A (select), then ⌘ + C (copy), then click in the field and press ⌘ + V (paste)\n\n**Windows:** Press Ctrl + A (select), then Ctrl + C (copy), then click in the field and press Ctrl + V (paste)', highlight: 'résumé' },
            { num: 3, text: 'Select, copy, and paste all of the contents from the **job description** into the space provided.\n\n**Mac:** Press ⌘ + A (select), then ⌘ + C (copy), then click in the field and press ⌘ + V (paste)\n\n**Windows:** Press Ctrl + A (select), then Ctrl + C (copy), then click in the field and press Ctrl + V (paste)', highlight: 'job description' },
            { num: 4, text: 'Enter the **company URL** in the sidebar', highlight: 'company URL' },
            { num: 5, text: 'Click "**📋 Save Documents & Proceed**" in the sidebar', highlight: '📋 Save Documents & Proceed' },
            { num: 6, text: 'Click "**Complete Session & Get Results**" to finish and receive your summary', highlight: 'Complete Session & Get Results' },
          ],
          tip: 'The Full Mock simulates a real interview with follow-up questions and detailed feedback.',
        };
      case 'premium_audio':
        return {
          title: 'Premium Audio Mock Interview',
          icon: '🎙️',
          steps: [
            { num: 1, text: 'Enter your **first/preferred name** in the sidebar (what you want Sarah to call you)', highlight: 'first/preferred name' },
            { num: 2, text: 'Select, copy, and paste all of the contents from your **résumé** into the space provided.\n\n**Mac:** Press ⌘ + A (select), then ⌘ + C (copy), then click in the field and press ⌘ + V (paste)\n\n**Windows:** Press Ctrl + A (select), then Ctrl + C (copy), then click in the field and press Ctrl + V (paste)', highlight: 'résumé' },
            { num: 3, text: 'Select, copy, and paste all of the contents from the **job description** into the space provided.\n\n**Mac:** Press ⌘ + A (select), then ⌘ + C (copy), then click in the field and press ⌘ + V (paste)\n\n**Windows:** Press Ctrl + A (select), then Ctrl + C (copy), then click in the field and press Ctrl + V (paste)', highlight: 'job description' },
            { num: 4, text: 'Enter the **company URL** in the sidebar', highlight: 'company URL' },
            { num: 5, text: 'Click "**📋 Save Documents & Proceed**" in the sidebar', highlight: '📋 Save Documents & Proceed' },
            { num: 6, text: 'Click "**Complete Session & Get Results**" to finish and receive your summary', highlight: 'Complete Session & Get Results' },
          ],
          tip: 'Use headphones for the best experience. Allow microphone access when prompted.',
        };
      case 'pro':
        return {
          title: 'Pro Subscription',
          icon: '👑',
          steps: [
            { num: 1, text: 'Select, copy, and paste all of the contents from your **résumé** into the space provided.\n\n**Mac:** Press ⌘ + A (select), then ⌘ + C (copy), then click in the field and press ⌘ + V (paste)\n\n**Windows:** Press Ctrl + A (select), then Ctrl + C (copy), then click in the field and press Ctrl + V (paste)', highlight: 'résumé' },
            { num: 2, text: 'Select, copy, and paste all of the contents from the **job description** into the space provided.\n\n**Mac:** Press ⌘ + A (select), then ⌘ + C (copy), then click in the field and press ⌘ + V (paste)\n\n**Windows:** Press Ctrl + A (select), then Ctrl + C (copy), then click in the field and press Ctrl + V (paste)', highlight: 'job description' },
            { num: 3, text: 'Enter the **company URL** in the sidebar', highlight: 'company URL' },
            { num: 4, text: 'Click "**📋 Save Documents & Proceed**" in the sidebar', highlight: '📋 Save Documents & Proceed' },
            { num: 5, text: 'Choose your **interview type**: Quick Prep, Mock Interview, or Audio Mock', highlight: 'interview type' },
            { num: 6, text: 'Click "**Complete Session & Get Results**" to finish and receive your summary', highlight: 'Complete Session & Get Results' },
          ],
          tip: 'Pro members have unlimited access to all session types. Choose whichever fits your prep needs!',
        };
      default:
        return {
          title: config.name,
          icon: config.icon,
          steps: [],
          tip: '',
        };
    }
  };

  const instructions = getSessionInstructions();

  // Parse markdown-style bold text
  const renderText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, index) => 
      index % 2 === 1 ? (
        <strong key={index} className="font-semibold text-primary">{part}</strong>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-hero">
      <div className="max-w-2xl w-full animate-slide-up">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground flex items-center justify-center gap-3">
            <span className="text-4xl">{instructions.icon}</span>
            {instructions.title}
          </h1>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {instructions.steps.map((step) => (
            <div 
              key={step.num} 
              className="flex items-start gap-4 animate-fade-in"
              style={{ animationDelay: `${step.num * 100}ms` }}
            >
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
                {step.num}
              </span>
              <p className="text-foreground/90 text-base leading-relaxed pt-0.5">
                {renderText(step.text)}
              </p>
            </div>
          ))}
        </div>

        {/* Tip */}
        {instructions.tip && (
          <div className="flex items-start gap-2 text-sm text-secondary italic mb-8">
            <Lightbulb className="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" />
            <p>Tip: {instructions.tip}</p>
          </div>
        )}

      </div>
    </div>
  );
}