import { useState, useRef, useEffect } from "react";
import { Mail, Clock, Send, Check, ArrowLeft, Upload, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { uploadFileForColumns, fetchColumnData, fetchAllClients, scheduleDrives } from "@/api";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TimezoneSelector } from "@/components/interview/TimezoneSelector";

interface DriveDetails {
  clientId: string;
  title: string;
  description: string;
  date: Date | null;
  startTime: string;
  endTime: string;
  timezone: string;
}

interface Client {
  id: string;
  companyName: string;
  logoPath: string;
}

const Drives = () => {
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [isDriveDialogOpen, setIsDriveDialogOpen] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEmailListDialogOpen, setIsEmailListDialogOpen] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientError, setClientError] = useState('');
  const [wizardStep, setWizardStep] = useState(1);
  const navigate = useNavigate();
  const emailContainerRef = useRef<HTMLDivElement>(null);

  const [driveDetails, setDriveDetails] = useState<DriveDetails>({
    clientId: '',
    title: '',
    description: '',
    date: null,
    startTime: '',
    endTime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  // Fetch clients on component mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        const clientData = await fetchAllClients();
        setClients(clientData);
        setIsLoadingClients(false);
      } catch (err) {
        setClientError(err instanceof Error ? err.message : 'Failed to load clients');
        setIsLoadingClients(false);
      }
    };
    loadClients();
  }, []);

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const isValidTime = (time: string) => {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file && (file.type === 'text/csv' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      try {
        const response = await uploadFileForColumns(file);
        setColumns(response.columns);
        setSessionId(response.session_id);
        setIsUploadDialogOpen(true);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file');
      }
    } else {
      setError('Please upload a valid CSV or XLSX file.');
    }
  };

  const handleColumnSelection = async () => {
    if (!selectedColumn) {
      setError('Please select a column.');
      return;
    }

    try {
      const response = await fetchColumnData(sessionId, [selectedColumn]);
      const emails = response.data
        .map(item => item[selectedColumn]?.toString().trim())
        .filter(email => email && isValidEmail(email) && !toEmails.includes(email));
      setToEmails(prev => [...new Set([...prev, ...emails])]);
      setIsUploadDialogOpen(false);
      setColumns([]);
      setSelectedColumn('');
      setSessionId('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch column data');
    }
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!driveDetails.clientId) {
        setError('Please select a client.');
        return false;
      }
      if (!driveDetails.title || !driveDetails.description) {
        setError('Please fill in both title and description.');
        return false;
      }
    }
    if (step === 2) {
      if (!driveDetails.date || !driveDetails.startTime || !driveDetails.endTime || !driveDetails.timezone) {
        setError('Please fill in all date, time, and timezone fields.');
        return false;
      }
      if (!isValidTime(driveDetails.startTime) || !isValidTime(driveDetails.endTime)) {
        setError('Please enter valid start and end times in HH:MM format.');
        return false;
      }
    }
    setError('');
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(wizardStep)) {
      setWizardStep(prev => prev + 1);
    }
  };

  const handleBackStep = () => {
    setError('');
    setWizardStep(prev => prev - 1);
  };

  const handleDialogSubmit = () => {
    if (validateStep(wizardStep)) {
      setIsDriveDialogOpen(false);
      setEmailSubject(`Walk-in Drive: ${driveDetails.title}`);
      const formattedDate = driveDetails.date ? format(driveDetails.date, "EEEE, MMMM d, yyyy") : 'To be confirmed';
      setEmailContent(`# Walk-in Drive Invitation

Dear Candidate,

We are excited to invite you to our walk-in drive for multiple positions.

## Drive Details
- **Title**: ${driveDetails.title}
- **Description**: ${driveDetails.description}
- **Date**: ${formattedDate}
- **Time**: ${driveDetails.startTime} - ${driveDetails.endTime} (${driveDetails.timezone})
- **Location**: To be provided

Please come prepared with your resume and be ready for on-the-spot interviews. Reply to this email for any questions.

Best regards,  
The Hiring Team`);
    }
  };

  const handleSendNotification = async () => {
    if (toEmails.length === 0) {
      setError("At least one recipient email is required.");
      return;
    }

    setSending(true);
    setError('');

    try {
      const sessionId = localStorage.getItem("session_id");
      const campaignId = sessionStorage.getItem("campaignId") || null;

      if (!sessionId) {
        throw new Error("Session ID not found. Please log in again.");
      }

      if (!driveDetails.date) {
        throw new Error("Drive date is missing.");
      }

      const request = {
        drive_details: {
          clientId: driveDetails.clientId,
          title: driveDetails.title,
          description: driveDetails.description,
        },
        slot: {
          date: format(driveDetails.date, "yyyy-MM-dd"),
          start_time: driveDetails.startTime,
          end_time: driveDetails.endTime,
        },
        mail_template: {
          subject: emailSubject,
          body: emailContent,
        },
        to_emails: toEmails,
        cc_emails: ccEmails.length > 0 ? ccEmails : undefined,
        timezone: driveDetails.timezone,
        campaign_id: campaignId,
      };

      console.log("Sending schedule-drives request:", request);

      const response = await scheduleDrives(sessionId, request);
      console.log("Schedule-drives response:", response);

      setSent(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send drive invitation.";
      setError(errorMessage);
      console.error("Error sending drive invitation:", err);
    } finally {
      setSending(false);
    }
  };

  // Calculate visible emails and overflow count
  const maxVisibleEmails = 3;
  const visibleEmails = toEmails.slice(0, maxVisibleEmails);
  const overflowCount = toEmails.length - maxVisibleEmails;

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
            Drive Invitation Sent Successfully!
          </h3>
          <p className="text-green-600 mb-6 text-sm">
            Invitation has been sent to {toEmails.join(', ')}
            {ccEmails.length > 0 && (
              <>
                <br />
                CC: {ccEmails.join(', ')}
              </>
            )}
          </p>
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-sm py-1 px-3 h-8"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Dialog open={isDriveDialogOpen} onOpenChange={setIsDriveDialogOpen}>
        <DialogContent className="max-w-[450px] p-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-800">Create New Drive</DialogTitle>
            <DialogDescription className="text-xs">Follow the steps to set up a new walk-in drive.</DialogDescription>
          </DialogHeader>
          <div className="my-3 flex justify-center space-x-2">
            {[1, 2].map(step => (
              <div
                key={step}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-300",
                  wizardStep >= step ? "bg-blue-600" : "bg-gray-300"
                )}
              />
            ))}
          </div>
          <div className={cn("transition-opacity duration-300", wizardStep === 1 ? "opacity-100" : "opacity-0 hidden")}>
            <div className="space-y-3">
              <h3 className="text-base font-medium text-gray-700">Step 1: Client & Details</h3>
              <div>
                <label className="block text-xs font-medium text-gray-700">Select Client</label>
                {isLoadingClients ? (
                  <p className="text-xs text-gray-500">Loading clients...</p>
                ) : clientError ? (
                  <p className="text-xs text-red-600">{clientError}</p>
                ) : (
                  <Select
                    value={driveDetails.clientId}
                    onValueChange={(value) => setDriveDetails(prev => ({ ...prev, clientId: value }))}
                  >
                    <SelectTrigger className="text-sm h-8 mt-1">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center gap-2">
                            <img
                              src={client.logoPath}
                              alt={`${client.companyName} logo`}
                              className="h-4 w-4 object-contain"
                            />
                            <span className="text-sm">{client.companyName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Drive Title</label>
                <Input
                  value={driveDetails.title}
                  onChange={(e) => setDriveDetails(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter drive title..."
                  className="text-sm h-8 mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Drive Description</label>
                <Textarea
                  value={driveDetails.description}
                  onChange={(e) => setDriveDetails(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter drive description..."
                  rows={3}
                  className="text-sm min-h-[60px] mt-1"
                />
              </div>
            </div>
          </div>
          <div className={cn("transition-opacity duration-300", wizardStep === 2 ? "opacity-100" : "opacity-0 hidden")}>
            <div className="space-y-3">
              <h3 className="text-base font-medium text-gray-700">Step 2: Date & Time</h3>
              <div>
                <label className="block text-xs font-medium text-gray-700">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal text-sm h-8 mt-1"
                    >
                      <Calendar className="mr-2 h-3 w-3" />
                      {driveDetails.date ? format(driveDetails.date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={driveDetails.date}
                      onSelect={(date) => setDriveDetails(prev => ({ ...prev, date }))}
                      initialFocus
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Start Time</label>
                  <Input
                    value={driveDetails.startTime}
                    onChange={(e) => setDriveDetails(prev => ({ ...prev, startTime: e.target.value }))}
                    placeholder="HH:MM (e.g., 09:00)"
                    className="text-sm h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">End Time</label>
                  <Input
                    value={driveDetails.endTime}
                    onChange={(e) => setDriveDetails(prev => ({ ...prev, endTime: e.target.value }))}
                    placeholder="HH:MM (e.g., 10:00)"
                    className="text-sm h-8 mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Timezone</label>
                <TimezoneSelector
                  value={driveDetails.timezone}
                  onChange={(timezone) => setDriveDetails(prev => ({ ...prev, timezone }))}
                />
              </div>
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-3">{error}</p>
          )}
          <div className="mt-4 flex justify-between">
            {wizardStep > 1 && (
              <Button variant="outline" onClick={handleBackStep} className="text-sm h-8 px-3">
                Back
              </Button>
            )}
            <Button
              onClick={wizardStep < 2 ? handleNextStep : handleDialogSubmit}
              className="ml-auto text-sm h-8 px-3"
            >
              {wizardStep < 2 ? "Next" : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-[450px] p-4">
          <DialogHeader>
            <DialogTitle className="text-lg">Select Email Column</DialogTitle>
            <DialogDescription className="text-xs">Select the column containing email addresses from the uploaded file.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Select Column</label>
              <Select
                value={selectedColumn}
                onValueChange={setSelectedColumn}
              >
                <SelectTrigger className="text-sm h-8 mt-1">
                  <SelectValue placeholder="Select a column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(column => (
                    <SelectItem key={column} value={column} className="text-sm">{column}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <Button onClick={() => setIsUploadDialogOpen(false)} variant="outline" className="text-sm h-8 px-3">Cancel</Button>
            <Button onClick={handleColumnSelection} className="text-sm h-8 px-3">Submit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmailListDialogOpen} onOpenChange={setIsEmailListDialogOpen}>
        <DialogContent className="max-w-[450px] p-4">
          <DialogHeader>
            <DialogTitle className="text-lg">All Recipients</DialogTitle>
            <DialogDescription className="text-xs">View and manage all recipient email addresses.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {toEmails.map((email, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <span className="text-sm text-gray-700">{email}</span>
                <button
                  onClick={() => removeEmail(email, 'to')}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setIsEmailListDialogOpen(false)} variant="outline" className="text-sm h-8 px-3">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {error && wizardStep === 0 && (
        <Card className="glass border-red-200">
          <CardContent className="text-red-600 p-4 text-sm">
            {error}
          </CardContent>
        </Card>
      )}

      <Card className="glass border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700 text-base">
            <Mail className="w-4 h-4 mr-2" />
            Drive Invitation Configuration
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Customize recipients and email template for the walk-in drive
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Subject
            </label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Email subject..."
              className="text-sm h-8"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              To Recipients
            </label>
            <div className="border border-gray-300 rounded-md p-2 min-h-[32px] flex items-center gap-2 overflow-hidden">
              <div className="flex items-center gap-2 flex-nowrap" ref={emailContainerRef}>
                {visibleEmails.map((email, index) => (
                  <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800 text-xs whitespace-nowrap">
                    {email}
                    <button
                      onClick={() => removeEmail(email, 'to')}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </Badge>
                ))}
                {overflowCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-200 text-blue-900 text-xs cursor-pointer whitespace-nowrap"
                    onClick={() => setIsEmailListDialogOpen(true)}
                  >
                    +{overflowCount} more
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={toInput}
                  onChange={(e) => handleEmailInput(e.target.value, 'to')}
                  onKeyPress={(e) => handleKeyPress(e, 'to')}
                  placeholder="Enter email and press comma or enter..."
                  className="flex-1 border-none shadow-none focus:ring-0 text-sm min-w-[150px] h-8"
                />
                <label htmlFor="file-upload" className="cursor-pointer pr-2">
                  <Upload className="w-4 h-4 text-gray-600 hover:text-gray-800" />
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter email addresses separated by commas or upload a CSV/XLSX file
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              CC Recipients
            </label>
            <div className="border border-gray-300 rounded-md p-2 min-h-[32px] flex flex-wrap items-center gap-2">
              {ccEmails.map((email, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  {email}
                  <button
                    onClick={() => removeEmail(email, 'cc')}
                    className="ml-1 hover:text-red-500 transition-colors duration-200"
                  >
                    <X className="w-2 h-2" />
                  </button>
                </Badge>
              ))}
              <Input
                value={ccInput}
                onChange={(e) => handleEmailInput(e.target.value, 'cc')}
                onKeyPress={(e) => handleKeyPress(e, 'cc')}
                placeholder="Enter email and press comma or enter..."
                className="flex-1 border-none shadow-none focus:ring-0 text-sm min-w-[150px] h-8"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Add team members' emails separated by commas
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email Template
            </label>
            <Textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={10}
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
              disabled={sending || !emailContent.trim() || toEmails.length === 0}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-sm h-8 px-3"
            >
              {sending ? (
                <>
                  <Clock className="w-3 h-3 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-3 h-3 mr-1" />
                  Send Drive Invitation
                </>
              )}
            </Button>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <div className="flex items-start">
              <Mail className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-yellow-800">Drive Invitation Process</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Once sent, all recipients will receive the drive invitation with the event details.
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

export default Drives;