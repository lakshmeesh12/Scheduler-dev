import { CheckCircle, Circle, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type InterviewStatus = 
  | 'panel_selection' 
  | 'interview_details' 
  | 'availability_selection' 
  | 'candidate_notification' 
  | 'slot_confirmation' 
  | 'invite_sent' 
  | 'interview_scheduled' 
  | 'interview_completed' 
  | 'declined' 
  | 'canceled';

interface InterviewStatusProgressProps {
  currentStatus: InterviewStatus;
}

const statusSteps = [
  { key: 'panel_selection', label: 'Panel Selection', description: 'Select interview panel members' },
  { key: 'interview_details', label: 'Interview Details', description: 'Set interview details and preferences' },
  { key: 'availability_selection', label: 'Time Selection', description: 'Choose available time slot' },
  { key: 'candidate_notification', label: 'Candidate Notification', description: 'Notify candidate of available slots' },
  { key: 'slot_confirmation', label: 'Confirmation', description: 'Waiting for candidate confirmation' },
  { key: 'invite_sent', label: 'Invites Sent', description: 'Calendar invites sent to all participants' },
  { key: 'interview_scheduled', label: 'Scheduled', description: 'Interview successfully scheduled' },
] as const;

const getStatusColor = (status: InterviewStatus, currentStatus: InterviewStatus) => {
  const currentIndex = statusSteps.findIndex(step => step.key === currentStatus);
  const stepIndex = statusSteps.findIndex(step => step.key === status);
  
  if (currentStatus === 'declined' || currentStatus === 'canceled') {
    return 'text-red-600 border-red-600';
  }
  
  if (stepIndex < currentIndex) {
    return 'text-green-600 border-green-600 bg-green-50';
  } else if (stepIndex === currentIndex) {
    return 'text-blue-600 border-blue-600 bg-blue-50';
  } else {
    return 'text-gray-400 border-gray-300 bg-gray-50';
  }
};

const getStatusIcon = (status: InterviewStatus, currentStatus: InterviewStatus) => {
  const currentIndex = statusSteps.findIndex(step => step.key === currentStatus);
  const stepIndex = statusSteps.findIndex(step => step.key === status);
  
  if (currentStatus === 'declined' || currentStatus === 'canceled') {
    return <XCircle className="w-5 h-5" />;
  }
  
  if (stepIndex < currentIndex) {
    return <CheckCircle className="w-5 h-5" />;
  } else if (stepIndex === currentIndex) {
    return <Clock className="w-5 h-5" />;
  } else {
    return <Circle className="w-5 h-5" />;
  }
};

export const InterviewStatusProgress = ({ currentStatus }: InterviewStatusProgressProps) => {
  if (currentStatus === 'declined') {
    return (
      <div className="text-center py-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-red-800 mb-2">Interview Declined</h3>
        <p className="text-red-600">The interview has been declined by either the candidate or panel member.</p>
      </div>
    );
  }

  if (currentStatus === 'canceled') {
    return (
      <div className="text-center py-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-red-800 mb-2">Interview Canceled</h3>
        <p className="text-red-600">The interview has been canceled.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        {statusSteps.map((step, index) => {
          const isLastStep = index === statusSteps.length - 1;
          const colorClasses = getStatusColor(step.key as InterviewStatus, currentStatus);
          
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                  colorClasses
                )}>
                  {getStatusIcon(step.key as InterviewStatus, currentStatus)}
                </div>
                <div className="mt-2 text-center">
                  <p className="text-sm font-medium text-gray-800">{step.label}</p>
                  <p className="text-xs text-muted-foreground max-w-20">{step.description}</p>
                </div>
              </div>
              
              {!isLastStep && (
                <div className={cn(
                  "flex-1 h-0.5 mx-4 transition-all duration-300",
                  getStatusColor(step.key as InterviewStatus, currentStatus).includes('green') 
                    ? 'bg-green-600' 
                    : 'bg-gray-300'
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};