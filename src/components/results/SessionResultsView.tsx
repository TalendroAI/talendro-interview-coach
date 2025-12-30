import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, RotateCcw } from "lucide-react";

function PreWrap({ children }: { children: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
      {children}
    </pre>
  );
}

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
  return (
    <section className="flex-1 overflow-hidden">
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        <header className="mb-6">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
            Your {sessionLabel} Results
          </h1>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Sent to <span className="font-medium text-foreground">{email}</span>
            </p>
            {onStartOver && (
              <Button variant="outline" onClick={onStartOver} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Start another session
              </Button>
            )}
          </div>
        </header>

        <Card className="p-4 md:p-6">
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="prep">Prep Packet</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-4">
              <ScrollArea className="h-[60vh] pr-3">
                {analysisMarkdown ? (
                  <PreWrap>{analysisMarkdown}</PreWrap>
                ) : (
                  <p className="text-muted-foreground">No summary was generated for this session.</p>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="prep" className="mt-4">
              <ScrollArea className="h-[60vh] pr-3">
                {prepPacket ? (
                  <PreWrap>{prepPacket}</PreWrap>
                ) : (
                  <p className="text-muted-foreground">No prep packet found for this session.</p>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="transcript" className="mt-4">
              <ScrollArea className="h-[60vh] pr-3">
                {transcript ? (
                  <PreWrap>{transcript}</PreWrap>
                ) : (
                  <p className="text-muted-foreground">No transcript found for this session.</p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <Separator className="my-6" />
          <p className="text-xs text-muted-foreground">
            Tip: If you didn’t receive the email, check Promotions/Spam and search for “Talendro”.
          </p>
        </Card>
      </div>
    </section>
  );
}
