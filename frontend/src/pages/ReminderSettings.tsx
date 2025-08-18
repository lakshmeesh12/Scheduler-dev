import { useState } from "react";
import { ArrowLeft, Bell, Clock, Mail, Settings, Save, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

const ReminderSettings = () => {
  const [candidateReminders, setCandidateReminders] = useState({
    enabled: true,
    timings: ['24h', '1h'],
    customMessage: ''
  });

  const [panelReminders, setPanelReminders] = useState({
    enabled: true,
    interviewReminder: { enabled: true, timing: '2h' },
    feedbackReminder: { enabled: true, timing: '24h' },
    customMessage: ''
  });

  const [escalationSettings, setEscalationSettings] = useState({
    noResponseTime: '72h',
    escalateToManager: true,
    autoReschedule: false
  });

  const handleSave = () => {
    // Save reminder settings
    toast({
      title: "Settings saved",
      description: "Reminder settings have been updated successfully.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-red-600 rounded-xl flex items-center justify-center animate-glow">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Reminder Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Configure notifications and escalation rules
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
              <Link to="/schedule-interview/1">
                <Button variant="outline" className="glass border-gray-200">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Candidate Reminders */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Candidate Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Enable candidate reminders</Label>
                  <p className="text-sm text-muted-foreground">Send automated reminders to candidates</p>
                </div>
                <Switch
                  checked={candidateReminders.enabled}
                  onCheckedChange={(checked) =>
                    setCandidateReminders(prev => ({ ...prev, enabled: checked }))
                  }
                />
              </div>

              {candidateReminders.enabled && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-base font-medium">Reminder Timings</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['24h', '12h', '2h', '1h', '30m'].map((timing) => (
                        <Badge
                          key={timing}
                          variant={candidateReminders.timings.includes(timing) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setCandidateReminders(prev => ({
                              ...prev,
                              timings: prev.timings.includes(timing)
                                ? prev.timings.filter(t => t !== timing)
                                : [...prev.timings, timing]
                            }));
                          }}
                        >
                          {timing} before
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="candidate-message">Custom Message Template</Label>
                    <Textarea
                      id="candidate-message"
                      placeholder="Add a custom message to include in reminder emails..."
                      value={candidateReminders.customMessage}
                      onChange={(e) =>
                        setCandidateReminders(prev => ({ ...prev, customMessage: e.target.value }))
                      }
                      className="mt-2"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Panel Reminders */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Panel Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Enable panel reminders</Label>
                  <p className="text-sm text-muted-foreground">Send automated reminders to panel members</p>
                </div>
                <Switch
                  checked={panelReminders.enabled}
                  onCheckedChange={(checked) =>
                    setPanelReminders(prev => ({ ...prev, enabled: checked }))
                  }
                />
              </div>

              {panelReminders.enabled && (
                <>
                  <Separator />
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-medium">Interview Reminder</Label>
                        <Switch
                          checked={panelReminders.interviewReminder.enabled}
                          onCheckedChange={(checked) =>
                            setPanelReminders(prev => ({
                              ...prev,
                              interviewReminder: { ...prev.interviewReminder, enabled: checked }
                            }))
                          }
                        />
                      </div>
                      {panelReminders.interviewReminder.enabled && (
                        <Select
                          value={panelReminders.interviewReminder.timing}
                          onValueChange={(value) =>
                            setPanelReminders(prev => ({
                              ...prev,
                              interviewReminder: { ...prev.interviewReminder, timing: value }
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24h">24 hours before</SelectItem>
                            <SelectItem value="12h">12 hours before</SelectItem>
                            <SelectItem value="4h">4 hours before</SelectItem>
                            <SelectItem value="2h">2 hours before</SelectItem>
                            <SelectItem value="1h">1 hour before</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-medium">Feedback Reminder</Label>
                        <Switch
                          checked={panelReminders.feedbackReminder.enabled}
                          onCheckedChange={(checked) =>
                            setPanelReminders(prev => ({
                              ...prev,
                              feedbackReminder: { ...prev.feedbackReminder, enabled: checked }
                            }))
                          }
                        />
                      </div>
                      {panelReminders.feedbackReminder.enabled && (
                        <Select
                          value={panelReminders.feedbackReminder.timing}
                          onValueChange={(value) =>
                            setPanelReminders(prev => ({
                              ...prev,
                              feedbackReminder: { ...prev.feedbackReminder, timing: value }
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24h">24 hours after</SelectItem>
                            <SelectItem value="48h">48 hours after</SelectItem>
                            <SelectItem value="72h">72 hours after</SelectItem>
                            <SelectItem value="1w">1 week after</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="panel-message">Custom Message Template</Label>
                    <Textarea
                      id="panel-message"
                      placeholder="Add a custom message to include in panel reminder emails..."
                      value={panelReminders.customMessage}
                      onChange={(e) =>
                        setPanelReminders(prev => ({ ...prev, customMessage: e.target.value }))
                      }
                      className="mt-2"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Escalation Settings */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Escalation Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-medium">No Response Escalation</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Escalate when no response is received within
                </p>
                <Select
                  value={escalationSettings.noResponseTime}
                  onValueChange={(value) =>
                    setEscalationSettings(prev => ({ ...prev, noResponseTime: value }))
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24 hours</SelectItem>
                    <SelectItem value="48h">48 hours</SelectItem>
                    <SelectItem value="72h">72 hours</SelectItem>
                    <SelectItem value="1w">1 week</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Escalate to Manager</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify hiring manager when escalation occurs
                  </p>
                </div>
                <Switch
                  checked={escalationSettings.escalateToManager}
                  onCheckedChange={(checked) =>
                    setEscalationSettings(prev => ({ ...prev, escalateToManager: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Auto-reschedule</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically suggest new time slots if declined
                  </p>
                </div>
                <Switch
                  checked={escalationSettings.autoReschedule}
                  onCheckedChange={(checked) =>
                    setEscalationSettings(prev => ({ ...prev, autoReschedule: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ReminderSettings;