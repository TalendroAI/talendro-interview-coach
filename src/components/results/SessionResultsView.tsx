import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Download, LayoutDashboard, Plus, Home, Sparkles } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { supabase } from "@/integrations/supabase/client";

export interface SessionResultsViewProps {
  sessionLabel: string;
  email: string;
  prepPacket?: string | null;
  transcript?: string | null;
  analysisMarkdown?: string | null;
  isProSubscriber?: boolean;
}

// Parse transcript into Q&A pairs for clean display
function parseTranscriptToQA(transcript: string): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = [];

  // Split by the --- delimiter
  const parts = transcript.split(/\n---\n/).filter((p) => p.trim());

  let currentQuestion = "";

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check if this is from coach/Sarah
    if (trimmed.startsWith("Sarah (Coach):")) {
      currentQuestion = trimmed.replace("Sarah (Coach):", "").trim();
    } else if (trimmed.startsWith("You:")) {
      const answer = trimmed.replace("You:", "").trim();
      if (currentQuestion && answer) {
        pairs.push({ question: currentQuestion, answer });
        currentQuestion = "";
      }
    }
  }

  return pairs;
}

export function SessionResultsView({
  sessionLabel,
  email,
  prepPacket,
  transcript,
  analysisMarkdown,
  isProSubscriber = false,
}: SessionResultsViewProps) {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isUpgradeLoading, setIsUpgradeLoading] = useState(false);

  const isQuickPrep = sessionLabel.toLowerCase().includes("quick prep");
  const hasPrepPacket = Boolean(prepPacket && prepPacket.length > 50);
  const hasTranscript = Boolean(transcript && transcript.length > 50);
  const hasAnalysis = Boolean(analysisMarkdown && analysisMarkdown.length > 50);

  // Ensure the results panel starts at the top when mounted
  useEffect(() => {
    const doScroll = () => {
      const viewport = cardRef.current?.querySelector<HTMLElement>(
        "[data-radix-scroll-area-viewport]",
      );
      if (!viewport) return;

      try {
        viewport.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {
        viewport.scrollTop = 0;
        viewport.scrollLeft = 0;
      }
    };

    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 50);
  }, []);

  // Parse transcript into Q&A pairs
  const qaPairs = hasTranscript ? parseTranscriptToQA(transcript!) : [];

  const handleDownload = () => {
    // Build a plain text report - Mock/Audio get ALL three sections
    let reportContent = `${sessionLabel} Results\n`;
    reportContent += `${"=".repeat(50)}\n\n`;
    reportContent += `Email: ${email}\n`;
    reportContent += `Date: ${new Date().toLocaleDateString()}\n\n`;

    // Section 1: Performance Analysis (for Mock/Audio interviews)
    if (hasAnalysis && !isQuickPrep) {
      reportContent += `SECTION 1: PERFORMANCE ANALYSIS\n${"─".repeat(40)}\n\n`;
      reportContent += analysisMarkdown + "\n\n";
    }

    // Section 2: Interview Q&A (for Mock/Audio interviews)
    if (qaPairs.length > 0) {
      reportContent += `SECTION 2: INTERVIEW Q&A\n${"─".repeat(40)}\n\n`;
      qaPairs.forEach((qa, idx) => {
        reportContent += `Question ${idx + 1}:\n${qa.question}\n\n`;
        reportContent += `Your Answer:\n${qa.answer}\n\n`;
        reportContent += "---\n\n";
      });
    }

    // Section 3: Prep Packet (included for ALL tiers - Quick Prep and Mock/Audio)
    if (hasPrepPacket) {
      const sectionNum = isQuickPrep ? "1" : "3";
      reportContent += `SECTION ${sectionNum}: ${isQuickPrep ? "YOUR INTERVIEW PREPARATION PACKET" : "PREPARATION MATERIALS"}\n${"─".repeat(40)}\n\n`;
      reportContent += prepPacket + "\n";
    }

    // Create and download file
    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talendro-${sessionLabel.toLowerCase().replace(/\s+/g, "-")}-results.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex-1 overflow-hidden bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-4xl mx-auto p-6 md:p-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">T</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Talendro™ Results</p>
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                Your {sessionLabel}
              </h1>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
            <p className="text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Full results sent to <span className="font-medium text-foreground">{email}</span>
            </p>
            <Button variant="outline" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </header>

        {/* Single Unified Report */}
        <Card ref={cardRef} className="shadow-lg border-border/50">
          <ScrollArea className="h-[65vh]">
            <div className="p-6 md:p-8 space-y-8">
              
              {/* Section 1: Performance Analysis (for mock interviews - displayed first for emphasis) */}
              {!isQuickPrep && hasAnalysis && (
                <section>
                  <h2 className="text-xl font-bold text-primary border-b-2 border-primary/20 pb-2 mb-4">
                    📊 Performance Analysis
                  </h2>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <MarkdownRenderer content={analysisMarkdown!} />
                  </div>
                </section>
              )}

              {/* Section 2: Interview Q&A (for mock interviews) */}
              {!isQuickPrep && qaPairs.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-primary border-b-2 border-primary/20 pb-2 mb-4">
                    💬 Interview Q&A
                  </h2>
                  <div className="space-y-6">
                    {qaPairs.map((qa, idx) => (
                      <div key={idx} className="border border-border/50 rounded-lg overflow-hidden">
                        {/* Question */}
                        <div className="bg-primary/5 p-4 border-b border-border/30">
                          <p className="text-xs font-semibold text-primary mb-1">
                            Question {idx + 1}
                          </p>
                          <p className="text-foreground font-medium leading-relaxed">
                            {qa.question}
                          </p>
                        </div>
                        {/* Answer */}
                        <div className="bg-background p-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Your Answer
                          </p>
                          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
                            {qa.answer}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Section 3: Prep Packet */}
              {hasPrepPacket && (
                <section>
                  <h2 className="text-xl font-bold text-primary border-b-2 border-primary/20 pb-2 mb-4">
                    📋 {isQuickPrep ? 'Your Interview Preparation Packet' : 'Preparation Materials'}
                  </h2>
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                    <MarkdownRenderer content={prepPacket!} />
                  </div>
                </section>
              )}

              {/* Fallback for empty state */}
              {!hasPrepPacket && !hasAnalysis && qaPairs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No content available for this session.</p>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> If you didn't receive the email, check your Promotions or Spam folder and search for "Talendro".
            </p>
            
            {/* Navigation buttons - different for Pro vs one-time purchasers */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {isProSubscriber ? (
                <>
                  <Button 
                    onClick={() => navigate('/dashboard')} 
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Go to Dashboard
                  </Button>
                  <Button 
                    onClick={() => navigate('/interview-coach?session_type=pro')} 
                    className="flex-1 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Start New Session
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={() => window.location.href = 'https://coach.talendro.com'} 
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Return to Home
                  </Button>
                  <Button 
                    onClick={async () => {
                      setIsUpgradeLoading(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('create-checkout', {
                          body: {
                            session_type: 'pro',
                            email: email,
                          },
                        });
                        if (error) throw error;
                        if (data?.url) {
                          window.open(data.url, '_blank');
                        }
                      } catch (err) {
                        console.error('Error creating checkout:', err);
                      } finally {
                        setIsUpgradeLoading(false);
                      }
                    }}
                    disabled={isUpgradeLoading}
                    className="flex-1 gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isUpgradeLoading ? 'Loading...' : 'Upgrade to Pro — $79/month'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
