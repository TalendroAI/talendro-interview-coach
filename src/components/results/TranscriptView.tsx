import { cn } from '@/lib/utils';

interface TranscriptViewProps {
  transcript: string;
  className?: string;
}

interface TranscriptMessage {
  speaker: 'coach' | 'user';
  content: string;
}

function parseTranscript(transcript: string): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];
  const parts = transcript.split(/\n---\n/).filter(p => p.trim());
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    // Check if it starts with "Sarah (Coach):" or "You:"
    if (trimmed.startsWith('Sarah (Coach):')) {
      messages.push({
        speaker: 'coach',
        content: trimmed.replace('Sarah (Coach):', '').trim()
      });
    } else if (trimmed.startsWith('You:')) {
      messages.push({
        speaker: 'user',
        content: trimmed.replace('You:', '').trim()
      });
    } else {
      // Fallback - assume it's user content if we can't detect
      messages.push({
        speaker: 'user',
        content: trimmed
      });
    }
  }
  
  return messages;
}

export function TranscriptView({ transcript, className }: TranscriptViewProps) {
  const messages = parseTranscript(transcript);
  
  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground">No transcript available.</p>
    );
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={cn(
            "rounded-xl p-4 max-w-[85%]",
            msg.speaker === 'coach' 
              ? "bg-primary/10 border border-primary/20 mr-auto" 
              : "bg-muted ml-auto"
          )}
        >
          <div className={cn(
            "text-xs font-semibold mb-2",
            msg.speaker === 'coach' ? "text-primary" : "text-muted-foreground"
          )}>
            {msg.speaker === 'coach' ? '🎯 Sarah (Coach)' : '👤 You'}
          </div>
          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed text-sm">
            {msg.content}
          </p>
        </div>
      ))}
    </div>
  );
}
