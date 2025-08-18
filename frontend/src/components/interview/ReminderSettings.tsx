import { useState } from "react";
import { Bell, Mail, Clock, Settings, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export interface ReminderConfig {
  candidateReminders: {
    enabled: boolean;
    timings: string[]; // e.g., ['24h', '1h']
    customMessage?: string;
  };
  panelReminders: {
    enabled: boolean;
    feedbackReminder: {
      enabled: boolean;
      timing: string; // e.g., '24h'
    };
    interviewReminder: {
      enabled: boolean;
      timing: string; // e.g., '2h'
    };
    customMessage?: string;
  };
}

interface ReminderSettingsProps {
  config: ReminderConfig;
  onChange: (config: ReminderConfig) => void;
  className?: string;
}

const REMINDER_TIMINGS = [
  { value: '15m', label: '15 minutes before' },
  { value: '30m', label: '30 minutes before' },
  { value: '1h', label: '1 hour before' },
  { value: '2h', label: '2 hours before' },
  { value: '24h', label: '24 hours before' },
  { value: '48h', label: '48 hours before' },
  { value: '1w', label: '1 week before' },
];

export const ReminderSettings = ({ config, onChange, className }: ReminderSettingsProps) => {
  const updateCandidateReminders = (updates: Partial<ReminderConfig['candidateReminders']>) => {
    onChange({
      ...config,
      candidateReminders: { ...config.candidateReminders, ...updates }
    });
  };

  const updatePanelReminders = (updates: Partial<ReminderConfig['panelReminders']>) => {
    onChange({
      ...config,
      panelReminders: { ...config.panelReminders, ...updates }
    });
  };

  const toggleCandidateReminderTiming = (timing: string) => {
    const currentTimings = config.candidateReminders.timings;
    const newTimings = currentTimings.includes(timing)
      ? currentTimings.filter(t => t !== timing)
      : [...currentTimings, timing];
    
    updateCandidateReminders({ timings: newTimings });
  };

  return (
    <div className={className}>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="w-5 h-5 mr-2 text-primary" />
            Reminder Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Candidate Reminders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-primary" />
                <Label className="text-base font-medium">Candidate Interview Reminders</Label>
              </div>
              <Switch
                checked={config.candidateReminders.enabled}
                onCheckedChange={(enabled) => updateCandidateReminders({ enabled })}
              />
            </div>

            {config.candidateReminders.enabled && (
              <div className="ml-6 space-y-4 border-l-2 border-muted pl-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Send reminders:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {REMINDER_TIMINGS.map((timing) => (
                      <div key={timing.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`candidate-${timing.value}`}
                          checked={config.candidateReminders.timings.includes(timing.value)}
                          onCheckedChange={() => toggleCandidateReminderTiming(timing.value)}
                        />
                        <Label 
                          htmlFor={`candidate-${timing.value}`} 
                          className="text-sm cursor-pointer"
                        >
                          {timing.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="candidate-message" className="text-sm font-medium mb-2 block">
                    Custom message (optional)
                  </Label>
                  <Textarea
                    id="candidate-message"
                    placeholder="Add a personal message to the reminder email..."
                    value={config.candidateReminders.customMessage || ''}
                    onChange={(e) => updateCandidateReminders({ customMessage: e.target.value })}
                    rows={3}
                  />
                </div>

                {config.candidateReminders.timings.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">Active reminders:</span>
                    {config.candidateReminders.timings.map((timing) => {
                      const label = REMINDER_TIMINGS.find(t => t.value === timing)?.label;
                      return (
                        <Badge key={timing} variant="secondary" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {label}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel Member Reminders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-primary" />
                <Label className="text-base font-medium">Panel Member Reminders</Label>
              </div>
              <Switch
                checked={config.panelReminders.enabled}
                onCheckedChange={(enabled) => updatePanelReminders({ enabled })}
              />
            </div>

            {config.panelReminders.enabled && (
              <div className="ml-6 space-y-4 border-l-2 border-muted pl-4">
                {/* Interview Reminders */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Interview reminders</Label>
                    <Switch
                      checked={config.panelReminders.interviewReminder.enabled}
                      onCheckedChange={(enabled) => 
                        updatePanelReminders({
                          interviewReminder: { ...config.panelReminders.interviewReminder, enabled }
                        })
                      }
                    />
                  </div>
                  
                  {config.panelReminders.interviewReminder.enabled && (
                    <Select
                      value={config.panelReminders.interviewReminder.timing}
                      onValueChange={(timing) =>
                        updatePanelReminders({
                          interviewReminder: { ...config.panelReminders.interviewReminder, timing }
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select timing" />
                      </SelectTrigger>
                      <SelectContent>
                        {REMINDER_TIMINGS.map((timing) => (
                          <SelectItem key={timing.value} value={timing.value}>
                            {timing.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Feedback Reminders */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Feedback submission reminders</Label>
                    <Switch
                      checked={config.panelReminders.feedbackReminder.enabled}
                      onCheckedChange={(enabled) => 
                        updatePanelReminders({
                          feedbackReminder: { ...config.panelReminders.feedbackReminder, enabled }
                        })
                      }
                    />
                  </div>
                  
                  {config.panelReminders.feedbackReminder.enabled && (
                    <Select
                      value={config.panelReminders.feedbackReminder.timing}
                      onValueChange={(timing) =>
                        updatePanelReminders({
                          feedbackReminder: { ...config.panelReminders.feedbackReminder, timing }
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select timing" />
                      </SelectTrigger>
                      <SelectContent>
                        {REMINDER_TIMINGS.map((timing) => (
                          <SelectItem key={timing.value} value={timing.value}>
                            {timing.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label htmlFor="panel-message" className="text-sm font-medium mb-2 block">
                    Custom message for panel members (optional)
                  </Label>
                  <Textarea
                    id="panel-message"
                    placeholder="Add a custom message for panel member reminders..."
                    value={config.panelReminders.customMessage || ''}
                    onChange={(e) => updatePanelReminders({ customMessage: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Active Settings Summary */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-3 flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Active Settings Summary
            </h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              {config.candidateReminders.enabled ? (
                <div className="flex items-center">
                  <Mail className="w-3 h-3 mr-2" />
                  Candidate reminders: {config.candidateReminders.timings.length} timing(s) configured
                </div>
              ) : (
                <div className="flex items-center text-muted-foreground/70">
                  <Mail className="w-3 h-3 mr-2" />
                  Candidate reminders: Disabled
                </div>
              )}
              
              {config.panelReminders.enabled ? (
                <div className="flex items-center">
                  <Users className="w-3 h-3 mr-2" />
                  Panel reminders: Interview ({config.panelReminders.interviewReminder.enabled ? 'On' : 'Off'}), 
                  Feedback ({config.panelReminders.feedbackReminder.enabled ? 'On' : 'Off'})
                </div>
              ) : (
                <div className="flex items-center text-muted-foreground/70">
                  <Users className="w-3 h-3 mr-2" />
                  Panel reminders: Disabled
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};