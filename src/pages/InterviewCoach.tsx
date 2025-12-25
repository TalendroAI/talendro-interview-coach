import { useState } from 'react';
import { Header } from '@/components/Header';
import { DocumentSidebar } from '@/components/DocumentSidebar';
import { WelcomeMessage } from '@/components/WelcomeMessage';
import { ChatInterface } from '@/components/ChatInterface';
import { AudioInterface } from '@/components/AudioInterface';
import { useSessionParams } from '@/hooks/useSessionParams';
import { DocumentInputs } from '@/types/session';
import { useToast } from '@/hooks/use-toast';

export default function InterviewCoach() {
  const { sessionType, userEmail } = useSessionParams();
  const { toast } = useToast();
  
  const [documents, setDocuments] = useState<DocumentInputs>({
    resume: '',
    jobDescription: '',
    companyUrl: '',
  });
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartSession = async () => {
    if (!sessionType) {
      toast({
        title: 'Session type required',
        description: 'Please access this page with a valid session type parameter.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate session initialization (will be replaced with actual API call)
    setTimeout(() => {
      setIsSessionStarted(true);
      setIsLoading(false);
      toast({
        title: 'Session started!',
        description: 'Your personalized coaching session has begun.',
      });
    }, 1500);
  };

  const renderMainContent = () => {
    if (!isSessionStarted) {
      return <WelcomeMessage sessionType={sessionType} userEmail={userEmail} />;
    }

    if (sessionType === 'premium_audio') {
      return <AudioInterface isActive={isSessionStarted} />;
    }

    return <ChatInterface sessionType={sessionType!} isActive={isSessionStarted} />;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header sessionType={sessionType} />
      
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <DocumentSidebar
          documents={documents}
          onDocumentsChange={setDocuments}
          onStartSession={handleStartSession}
          isLoading={isLoading}
          sessionType={sessionType}
          isSessionStarted={isSessionStarted}
        />
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-gradient-subtle">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
}
