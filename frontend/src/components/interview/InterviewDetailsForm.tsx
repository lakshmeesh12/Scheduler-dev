import { useState } from "react";
import { Calendar, Clock, MapPin, Video, FileText, Save } from "lucide-react";
import { TimezoneSelector } from "./TimezoneSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import axios from "axios";
import { toast } from "@/components/ui/use-toast";
import { saveInterviewDetails } from "@/api";

interface InterviewDetails {
  title: string;
  description: string;
  duration: number;
  date: Date | null;
  location: string;
  meetingType: 'in-person' | 'virtual';
  preferred_timezone: string;
}

interface InterviewDetailsFormProps {
  onSave: (details: InterviewDetails) => void;
  initialDetails?: InterviewDetails | null;
}

const API_BASE_URL = 'http://localhost:8000';

export const InterviewDetailsForm = ({ onSave, initialDetails }: InterviewDetailsFormProps) => {
  const [formData, setFormData] = useState<InterviewDetails>({
    title: initialDetails?.title || '',
    description: initialDetails?.description || '',
    duration: initialDetails?.duration || 60,
    date: initialDetails?.date || null,
    location: initialDetails?.location || 'Microsoft Teams',
    meetingType: initialDetails?.meetingType || 'virtual',
    preferred_timezone: initialDetails?.preferred_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Interview title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Interview description is required';
    }

    if (!formData.date) {
      newErrors.date = 'Interview date is required';
    }

    if (formData.meetingType === 'in-person' && !formData.location.trim()) {
      newErrors.location = 'Location is required for in-person interviews';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const sessionId = localStorage.getItem("session_id");
    if (!sessionId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Session ID not found. Please select panel members first.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        duration: formData.duration,
        date: formData.date ? format(formData.date, "yyyy-MM-dd") : '',
        preferred_timezone: formData.preferred_timezone,
        location: formData.meetingType === 'virtual' ? 'Microsoft Teams' : formData.location,
      };

      await saveInterviewDetails(sessionId, payload);

      onSave(formData);
      toast({
        title: "Success",
        description: "Interview details saved successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save interview details",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: keyof InterviewDetails, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700 text-sm font-medium">
            <FileText className="w-4 h-4 mr-2" />
            Interview Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-xs">Interview Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Frontend Developer Technical Interview"
              value={formData.title}
              onChange={(e) => updateFormData('title', e.target.value)}
              className={cn("text-sm h-8", errors.title && 'border-red-500')}
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          <div>
            <Label htmlFor="description" className="text-xs">Description *</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the interview process, topics to be covered, etc."
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              rows={4}
              className={cn("text-sm min-h-[80px]", errors.description && 'border-red-500')}
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration" className="text-xs">Duration</Label>
              <Select 
                value={formData.duration.toString()} 
                onValueChange={(value) => updateFormData('duration', parseInt(value))}
              >
                <SelectTrigger className="text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="120">120 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Interview Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-sm h-8",
                      !formData.date && "text-muted-foreground",
                      errors.date && "border-red-500"
                    )}
                  >
                    <Calendar className="mr-2 h-3 w-3" />
                    {formData.date ? format(formData.date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => updateFormData('date', date)}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center text-purple-700 text-sm font-medium">
            <MapPin className="w-4 h-4 mr-2" />
            Meeting Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Meeting Type</Label>
            <RadioGroup 
              value={formData.meetingType} 
              onValueChange={(value: 'in-person' | 'virtual') => updateFormData('meetingType', value)}
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="virtual" id="virtual" />
                <Label htmlFor="virtual" className="flex items-center cursor-pointer text-sm">
                  <Video className="w-3 h-3 mr-2" />
                  Virtual Meeting
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="in-person" id="in-person" />
                <Label htmlFor="in-person" className="flex items-center cursor-pointer text-sm">
                  <MapPin className="w-3 h-3 mr-2" />
                  In-Person
                </Label>
              </div>
            </RadioGroup>
          </div>

          {formData.meetingType === 'in-person' && (
            <div>
              <Label htmlFor="location" className="text-xs">Location *</Label>
              <Input
                id="location"
                placeholder="e.g., Conference Room A, Building 1, 123 Main St"
                value={formData.location}
                onChange={(e) => updateFormData('location', e.target.value)}
                className={cn("text-sm h-8", errors.location && 'border-red-500')}
              />
              {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
            </div>
          )}

          {formData.meetingType === 'virtual' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center text-blue-700 mb-2">
                <Video className="w-4 h-4 mr-2" />
                <span className="font-medium text-sm">Virtual Meeting Details</span>
              </div>
              <p className="text-xs text-blue-600">
                A Microsoft Teams meeting link will be automatically generated and shared with all participants once the interview is scheduled.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center text-purple-700 text-sm font-medium">
            <Clock className="w-4 h-4 mr-2" />
            Timezone Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimezoneSelector 
            value={formData.preferred_timezone}
            onChange={(timezone) => updateFormData('preferred_timezone', timezone)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          className="bg-green-600 hover:bg-green-700 text-sm py-1 px-3 h-8"
          disabled={isSubmitting}
        >
          <Save className="w-3 h-3 mr-1" />
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};