import { useState, useEffect } from "react";
import { Mail, Clock, Calendar, User, Send, Check, ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
import { ApiCandidate, scheduleEvent } from "@/api";
import { useNavigate } from "react-router-dom";

interface TimeSlot {
  id: string;
  start: string;
  end: string;
  date: string;
  available: boolean;
}

interface InterviewDetails {
  title: string;
  description: string;
  duration: number;
  date: Date | null;
  location: string;
  meetingType: 'in-person' | 'virtual';
}

interface CandidateNotificationProps {
  candidate: ApiCandidate;
  timeSlots: TimeSlot[];
  interviewDetails: InterviewDetails | null;
  mode: 'single' | 'multiple';
  onNotificationSent: () => void;
}

export const CandidateNotification = ({ 
  candidate, 
  timeSlots, 
  interviewDetails, 
  mode,
  onNotificationSent 
}: CandidateNotificationProps) => {
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const formatTime = (time: string) => {
    console.log("CandidateNotification: Formatting time for display:", time);
    try {
      const parsedTime = parse(time, "hh:mm a", new Date());
      return format(parsedTime, "h:mm a");
    } catch (error) {
      console.error(`CandidateNotification: Failed to format time: ${time}`, error);
      return time;
    }
  };

  const formatISODateTime = (date: string, time: string) => {
    console.log("CandidateNotification: Formatting ISO date-time:", { date, time });
    try {
      const parsedDate = parse(date, "yyyy-MM-dd", new Date());
      const parsedTime = parse(time, "hh:mm a", parsedDate);
      return format(parsedTime, "yyyy-MM-dd'T'HH:mm:ss'Z'");
    } catch (error) {
      console.error(`CandidateNotification: Failed to format ISO date-time: ${date}, ${time}`, error);
      return time;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const formatted = format(date, "EEEE, MMMM d, yyyy");
      console.log(`CandidateNotification: Formatted date ${dateStr} to:`, formatted);
      return formatted;
    } catch (error) {
      console.error(`CandidateNotification: Failed to format date: ${dateStr}`, error);
      return dateStr;
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleEmailInput = (value: string, type: 'to' | 'cc') => {
    if (type === 'to') {
      setToInput(value);
      if (value.endsWith(',')) {
        const email = value.slice(0, -1).trim();
        if (email && isValidEmail(email) && !toEmails.includes(email)) {
          setToEmails([...toEmails, email]);
          setToInput('');
        }
      }
    } else {
      setCcInput(value);
      if (value.endsWith(',')) {
        const email = value.slice(0, -1).trim();
        if (email && isValidEmail(email) && !ccEmails.includes(email)) {
          setCcEmails([...ccEmails, email]);
          setCcInput('');
        }
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, type: 'to' | 'cc') => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const input = type === 'to' ? toInput : ccInput;
      const email = input.trim();
      if (email && isValidEmail(email)) {
        if (type === 'to' && !toEmails.includes(email)) {
          setToEmails([...toEmails, email]);
          setToInput('');
        } else if (type === 'cc' && !ccEmails.includes(email)) {
          setCcEmails([...ccEmails, email]);
          setCcInput('');
        }
      }
    }
  };

  const removeEmail = (email: string, type: 'to' | 'cc') => {
    if (type === 'to') {
      setToEmails(toEmails.filter(e => e !== email));
    } else {
      setCcEmails(ccEmails.filter(e => e !== email));
    }
  };

  const generateEmailContent = () => {
    if (!candidate || !candidate.profile_id) {
      console.error("CandidateNotification: Candidate information missing:", candidate);
      return "Error: Candidate information is missing.";
    }
    const meetingType = interviewDetails?.meetingType === 'virtual' ? 'virtual' : 'in-person';
    const location = interviewDetails?.meetingType === 'in-person' 
      ? `Location: ${interviewDetails.location || 'To be provided'}`
      : 'Meeting Link: A Microsoft Teams link will be shared closer to the interview.';
    const position = candidate.work_history[0]?.designation || 'Position';

    if (mode === 'single') {
      const slot = timeSlots[0];
      if (!slot) {
        return "Error: No time slot selected.";
      }
      return `Dear ${candidate.name || 'Candidate'},

We are excited to invite you to an interview for the ${position} role.

Interview Details:
• Title: ${interviewDetails?.title || 'Interview'}
• Date: ${formatDate(slot.date)}
• Time: ${formatTime(slot.start)} - ${formatTime(slot.end)}
• Duration: ${interviewDetails?.duration || 60} minutes
• Format: ${meetingType === 'virtual' ? 'Virtual Meeting' : 'In-Person'}
• ${location}

Description:
${interviewDetails?.description || 'We look forward to discussing your qualifications and experience with our team.'}

Please prepare for the interview and join at the specified time. If you have any questions, reply to this email or contact us.

Best regards,
The Hiring Team`;
    } else {
      const slotsList = timeSlots
        .map(slot => `• ${formatDate(slot.date)} at ${formatTime(slot.start)} - ${formatTime(slot.end)}`)
        .join('\n');

      return `Dear ${candidate.name || 'Candidate'},

We are excited to invite you to an interview for the ${position} role. Below are the available time slots for your interview.

Available Time Slots:
${slotsList || 'No slots available'}

Interview Details:
• Title: ${interviewDetails?.title || 'Interview'}
• Duration: ${interviewDetails?.duration || 60} minutes
• Format: ${meetingType === 'virtual' ? 'Virtual Meeting' : 'In-Person'}
• ${location}

Description:
${interviewDetails?.description || 'We look forward to discussing your qualifications and experience with our team.'}

Please prepare for the interview and join at one of the specified times. If you have any questions, reply to this email or contact us.

Best regards,
The Hiring Team`;
    }
  };

  useEffect(() => {
    const content = generateEmailContent();
    const subject = `Interview Invitation - ${candidate.work_history?.[0]?.designation || 'Position'}`;
    console.log("CandidateNotification: Generated email content:", content);
    setEmailContent(content);
    setEmailSubject(subject);
    
    // Initialize with candidate's email in the to field
    if (candidate.email && !toEmails.includes(candidate.email)) {
      setToEmails([candidate.email]);
    }
  }, [timeSlots, mode, interviewDetails, candidate]);

  const handleSendNotification = async () => {
    if (!candidate || !candidate.profile_id) {
      setError("Candidate information is missing.");
      console.error("CandidateNotification: Missing candidate info:", candidate);
      return;
    }
    if (toEmails.length === 0) {
      setError("At least one recipient email is required.");
      console.error("CandidateNotification: No recipient emails");
      return;
    }
    if (mode === 'single' && !timeSlots[0]) {
      setError("No time slot selected.");
      console.error("CandidateNotification: No time slot selected");
      return;
    }

    setSending(true);
    setError('');

    try {
      const sessionId = localStorage.getItem("session_id");
      const campaignId = sessionStorage.getItem("campaignId");
      if (!sessionId) {
        throw new Error("Session ID not found. Please log in again.");
      }
      if (!campaignId) {
        throw new Error("Campaign ID not found. Please select a campaign.");
      }

      const slot = mode === 'single' ? timeSlots[0] : timeSlots[0];
      const request = {
        slot: {
          start: formatISODateTime(slot.date, slot.start),
          end: formatISODateTime(slot.date, slot.end),
        },
        mail_template: {
          subject: emailSubject,
          body: emailContent,
        },
        candidate_email: toEmails[0], // Primary recipient
        to_emails: toEmails, // All To recipients
        cc_emails: ccEmails, // All CC recipients
        campaign_id: campaignId // Add campaign_id to the request
      };

      console.log("CandidateNotification: Sending schedule-event request:", request);

      const response = await scheduleEvent(sessionId, request);
      console.log("CandidateNotification: Schedule-event response:", response);

      setSent(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send interview invitation.";
      setError(errorMessage);
      console.error("CandidateNotification: Error sending notification:", err);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Card className="glass border-green-200 animate-fade-in">
        <CardContent className="text-center py-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-green-800 mb-2">
            Notification Sent Successfully!
          </h3>
          <p className="text-green-600 mb-6">
            Interview invitation has been sent to {toEmails.join(', ')}
            {ccEmails.length > 0 && (
              <>
                <br />
                CC: {ccEmails.join(', ')}
              </>
            )}
          </p>
          <Button
            onClick={() => {
              console.log("CandidateNotification: Navigating back to candidate details");
              onNotificationSent(); // Trigger parent callback
              navigate(`/candidate/${candidate.profile_id}`);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Candidate
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="glass border-red-200">
          <CardContent className="text-red-600 p-4">
            {error}
          </CardContent>
        </Card>
      )}
      <Card className="glass border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center text-orange-700">
            <User className="w-5 h-5 mr-2" />
            Candidate Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {candidate && candidate.profile_id ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Name</p>
                <p className="text-lg font-semibold text-gray-800">{candidate.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Email</p>
                <p className="text-lg text-gray-800">{candidate.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Position</p>
                <p className="text-lg text-gray-800">{candidate.work_history[0]?.designation || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Interview {mode === 'single' ? 'Time' : 'Time Slots'}</p>
                {mode === 'single' && timeSlots[0] ? (
                  <p className="text-lg text-gray-800">
                    {formatDate(timeSlots[0].date)} at {formatTime(timeSlots[0].start)}
                  </p>
                ) : (
                  <div className="text-lg text-gray-800">
                    {timeSlots.length > 0 ? (
                      timeSlots.map(slot => (
                        <p key={slot.id}>
                          {formatDate(slot.date)} at {formatTime(slot.start)} - {formatTime(slot.end)}
                        </p>
                      ))
                    ) : (
                      <p>No time slots selected</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-red-500">Candidate information is missing.</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700">
            <Mail className="w-5 h-5 mr-2" />
            Email Configuration
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Customize recipients and email template
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject Line */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full"
            />
          </div>

          {/* To Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Recipients
            </label>
            <div className="border border-gray-300 rounded-md p-2 min-h-[40px] flex flex-wrap items-center gap-2">
              {toEmails.map((email, index) => (
                <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800">
                  {email}
                  <button
                    onClick={() => removeEmail(email, 'to')}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Input
                value={toInput}
                onChange={(e) => handleEmailInput(e.target.value, 'to')}
                onKeyPress={(e) => handleKeyPress(e, 'to')}
                placeholder="Enter email and press comma or enter..."
                className="flex-1 border-none shadow-none focus:ring-0 min-w-[200px]"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter email addresses separated by commas
            </p>
          </div>

          {/* CC Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CC Recipients
            </label>
            <div className="border border-gray-300 rounded-md p-2 min-h-[40px] flex flex-wrap items-center gap-2">
              {ccEmails.map((email, index) => (
                <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-800">
                  {email}
                  <button
                    onClick={() => removeEmail(email, 'cc')}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Input
                value={ccInput}
                onChange={(e) => handleEmailInput(e.target.value, 'cc')}
                onKeyPress={(e) => handleKeyPress(e, 'cc')}
                placeholder="Enter email and press comma or enter..."
                className="flex-1 border-none shadow-none focus:ring-0 min-w-[200px]"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter email addresses separated by commas
            </p>
          </div>

          {/* Email Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Template
            </label>
            <Textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={15}
              className="font-mono text-sm"
              placeholder="Email content..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Customize the email template as needed before sending
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleSendNotification}
              disabled={sending || !emailContent.trim() || !candidate.profile_id || toEmails.length === 0 || (mode === 'single' && !timeSlots[0])}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              size="lg"
            >
              {sending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Sending Notification...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Interview Invitation
                </>
              )}
            </Button>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-start">
              <Mail className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Email Notification Process</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Once sent, all recipients will receive the interview invitation with the meeting details.
                  You'll be notified when they respond.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};