import { Bot, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import QChat from "@/components/QChat";

const QChatPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="p-2" />
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">QChat</h1>
                <p className="text-sm text-gray-600">Your AI hiring assistant</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
          <div className="lg:col-span-1 space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bot className="w-5 h-5" />
                  <span>Quick Help</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <p className="font-medium text-muted-foreground">Ask me about:</p>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li>• Adding new clients</li>
                    <li>• Creating campaigns</li>
                    <li>• Managing jobs</li>
                    <li>• Finding candidates</li>
                    <li>• Scheduling interviews</li>
                    <li>• Platform navigation</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-sm">Sample Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs space-y-2">
                  <div className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 transition-colors">
                    "How do I add a new client?"
                  </div>
                  <div className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 transition-colors">
                    "How to create a campaign?"
                  </div>
                  <div className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 transition-colors">
                    "How to search for candidates?"
                  </div>
                  <div className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 transition-colors">
                    "How to schedule an interview?"
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-3">
            <Card className="glass h-full">
              <CardContent className="p-0 h-full">
                <QChat isFloating={false} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default QChatPage;