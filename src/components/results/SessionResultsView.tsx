import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, RotateCcw, FileText, MessageSquare, BarChart3 } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { TranscriptView } from "./TranscriptView";

export interface SessionResultsViewProps {
  sessionLabel: string;
  email: string;
  prepPacket?: string | null;
  transcript?: string | null;
  analysisMarkdown?: string | null;
  onStartOver?: () => void;
}

export function SessionResultsView({
  sessionLabel,
  email,
  prepPacket,
  transcript,
  analysisMarkdown,
  onStartOver,
}: SessionResultsViewProps) {
  // Determine if this is a quick prep session (no transcript/analysis needed)
  const isQuickPrep = sessionLabel.toLowerCase().includes('quick prep');
  
  // For quick prep, the prep packet IS the main content
  // For mock interviews, we have prep packet + transcript + analysis
  const hasTranscript = Boolean(transcript && transcript.length > 50);
  const hasAnalysis = Boolean(analysisMarkdown && analysisMarkdown.length > 50);
  const hasPrepPacket = Boolean(prepPacket && prepPacket.length > 50);
  
  // Determine which tabs to show
  const showTranscriptTab = !isQuickPrep && hasTranscript;
  const showSummaryTab = !isQuickPrep && hasAnalysis;

  // For Quick Prep: only show Prep Packet
  // For Mock/Audio: show Summary, Prep Packet, Transcript
  const defaultTab = isQuickPrep ? "prep" : (showSummaryTab ? "summary" : "prep");

  return (
    <section className="flex-1 overflow-hidden bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        {/* Header with branding */}
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
            {onStartOver && (
              <Button variant="outline" onClick={onStartOver} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Start another session
              </Button>
            )}
          </div>
        </header>

        <Card className="shadow-lg border-border/50">
          {isQuickPrep ? (
            // Quick Prep: Single content view, no tabs
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Your Interview Preparation Packet</h2>
              </div>
              <ScrollArea className="h-[60vh] pr-4">
                {hasPrepPacket ? (
                  <MarkdownRenderer content={prepPacket!} />
                ) : (
                  <p className="text-muted-foreground">No prep packet was generated for this session.</p>
                )}
              </ScrollArea>
            </div>
          ) : (
            // Mock/Audio: Tabbed interface
            <Tabs defaultValue={defaultTab} className="w-full">
              <div className="border-b border-border px-4 pt-4">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                  {showSummaryTab && (
                    <TabsTrigger value="summary" className="gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Summary</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="prep" className="gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Prep Packet</span>
                  </TabsTrigger>
                  {showTranscriptTab && (
                    <TabsTrigger value="transcript" className="gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden sm:inline">Transcript</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              {showSummaryTab && (
                <TabsContent value="summary" className="mt-0 p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Performance Summary & Recommendations</h2>
                  </div>
                  <ScrollArea className="h-[55vh] pr-4">
                    <MarkdownRenderer content={analysisMarkdown!} />
                  </ScrollArea>
                </TabsContent>
              )}

              <TabsContent value="prep" className="mt-0 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Interview Preparation Packet</h2>
                </div>
                <ScrollArea className="h-[55vh] pr-4">
                  {hasPrepPacket ? (
                    <MarkdownRenderer content={prepPacket!} />
                  ) : (
                    <p className="text-muted-foreground">No prep packet found for this session.</p>
                  )}
                </ScrollArea>
              </TabsContent>

              {showTranscriptTab && (
                <TabsContent value="transcript" className="mt-0 p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Interview Transcript</h2>
                  </div>
                  <ScrollArea className="h-[55vh] pr-4">
                    <TranscriptView transcript={transcript!} />
                  </ScrollArea>
                </TabsContent>
              )}
            </Tabs>
          )}

          <Separator className="mx-6" />
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> If you didn't receive the email, check your Promotions or Spam folder and search for "Talendro".
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
