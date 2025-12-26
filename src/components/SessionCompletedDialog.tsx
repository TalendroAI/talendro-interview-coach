import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, ShoppingCart } from 'lucide-react';
import { STRIPE_PRICES } from '@/config/stripe';

interface SessionCompletedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: string;
  userEmail: string;
  sessionResults?: {
    overall_score?: number;
    strengths?: string[];
    improvements?: string[];
    recommendations?: string;
  } | null;
}

const SESSION_NAMES: Record<string, string> = {
  quick_prep: 'Quick Prep',
  full_mock: 'Full Mock Interview',
  premium_audio: 'Premium Audio Mock',
  pro: 'Pro Session',
};

export function SessionCompletedDialog({
  isOpen,
  onClose,
  sessionType,
  userEmail,
  sessionResults,
}: SessionCompletedDialogProps) {
  const navigate = useNavigate();
  const sessionName = SESSION_NAMES[sessionType] || 'coaching session';

  const handleViewResults = () => {
    // Navigate to results page or show results
    // For now, we'll close the dialog and show a toast
    onClose();
    // TODO: Implement results viewing
  };

  const handlePurchaseNew = () => {
    navigate(`/?session_type=${sessionType}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Thank You for Your Interest!
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            According to our records, you have successfully completed your{' '}
            <span className="font-semibold text-foreground">{sessionName}</span>{' '}
            session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {sessionResults && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Your Score</p>
              <p className="text-3xl font-bold text-primary">
                {sessionResults.overall_score || '--'}/100
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleViewResults}
              variant="outline"
              className="w-full justify-start gap-3"
            >
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">View Your Results</p>
                <p className="text-xs text-muted-foreground">
                  Review your feedback and recommendations
                </p>
              </div>
            </Button>

            <Button
              onClick={handlePurchaseNew}
              className="w-full justify-start gap-3"
            >
              <ShoppingCart className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Purchase Another Session</p>
                <p className="text-xs text-muted-foreground">
                  Practice again with a new {sessionName}
                </p>
              </div>
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-2">
            Want to try a different interview? Each session provides unique
            practice tailored to your materials.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
