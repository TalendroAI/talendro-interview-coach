import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickPrepContentProps {
  content: string | null;
  isLoading: boolean;
  error: string | null;
}

export function QuickPrepContent({ content, isLoading, error }: QuickPrepContentProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-hero">
        <div className="text-center max-w-md">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
          <h2 className="font-heading text-2xl font-bold text-foreground mb-3">
            Generating Your Prep Materials...
          </h2>
          <p className="text-muted-foreground text-lg">
            Our AI is analyzing your resume, the job description, and company to create personalized interview preparation materials.
          </p>
          <p className="text-muted-foreground mt-4 text-sm">
            This usually takes 30-60 seconds.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-hero">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-foreground mb-3">
            Something went wrong
          </h2>
          <p className="text-muted-foreground text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  // Parse and render the markdown-like content
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let currentList: string[] = [];
    let listKey = 0;

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${listKey++}`} className="list-disc list-inside space-y-2 ml-4 mb-4">
            {currentList.map((item, i) => (
              <li key={i} className="text-foreground/90">{item}</li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        flushList();
        return;
      }

      // Headers
      if (trimmedLine.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={index} className="font-heading text-2xl font-bold text-primary mt-8 mb-4 first:mt-0">
            {trimmedLine.replace('## ', '').replace(/\*\*/g, '')}
          </h2>
        );
        return;
      }

      if (trimmedLine.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={index} className="font-heading text-3xl font-bold text-foreground mt-8 mb-4 first:mt-0">
            {trimmedLine.replace('# ', '').replace(/\*\*/g, '')}
          </h1>
        );
        return;
      }

      // Bold headers (like **Company Overview**)
      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        flushList();
        elements.push(
          <h3 key={index} className="font-heading text-xl font-semibold text-foreground mt-6 mb-3">
            {trimmedLine.replace(/\*\*/g, '')}
          </h3>
        );
        return;
      }

      // Numbered sections (like 1. **Company Overview**)
      const numberedMatch = trimmedLine.match(/^(\d+)\.\s*\*\*(.+?)\*\*/);
      if (numberedMatch) {
        flushList();
        elements.push(
          <h3 key={index} className="font-heading text-xl font-semibold text-primary mt-8 mb-3 flex items-center gap-3">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {numberedMatch[1]}
            </span>
            {numberedMatch[2]}
          </h3>
        );
        // Check if there's content after the header on the same line
        const restOfLine = trimmedLine.replace(/^\d+\.\s*\*\*.+?\*\*\s*[-:]?\s*/, '').trim();
        if (restOfLine) {
          elements.push(
            <p key={`${index}-rest`} className="text-foreground/90 leading-relaxed mb-4">
              {restOfLine}
            </p>
          );
        }
        return;
      }

      // List items
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
        currentList.push(trimmedLine.replace(/^[-•]\s*/, '').replace(/\*\*/g, ''));
        return;
      }

      // Numbered list items (like "1. Question text")
      const listItemMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
      if (listItemMatch && !listItemMatch[2].startsWith('**')) {
        flushList();
        elements.push(
          <div key={index} className="flex gap-3 mb-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-secondary/20 text-secondary-foreground text-sm font-medium flex items-center justify-center">
              {listItemMatch[1]}
            </span>
            <p className="text-foreground/90 leading-relaxed flex-1">
              {listItemMatch[2].replace(/\*\*/g, '')}
            </p>
          </div>
        );
        return;
      }

      // Regular paragraphs
      flushList();
      elements.push(
        <p key={index} className="text-foreground/90 leading-relaxed mb-4">
          {trimmedLine.replace(/\*\*/g, '')}
        </p>
      );
    });

    flushList();
    return elements;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-hero">
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-background rounded-xl shadow-lg p-8 border border-border">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
            <span className="text-4xl">⚡</span>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                Your Quick Prep Materials
              </h1>
              <p className="text-muted-foreground">
                Personalized interview preparation based on your documents
              </p>
            </div>
          </div>
          
          <div className="prose prose-lg max-w-none">
            {renderContent(content)}
          </div>
        </div>
      </div>
    </div>
  );
}
