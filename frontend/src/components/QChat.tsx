import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X, ArrowUpRight, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface QChatProps {
  isFloating?: boolean;
}

const QChat = ({ isFloating = true }: QChatProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm your QChat assistant. I can help you with questions about clients, campaigns, jobs, and hiring processes. How can I assist you today?",
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const dummyResponses = [
    {
      keywords: ["client", "company", "add client"],
      response: "To add a new client, click the 'Add New Client' button on the Client Dashboard. Fill in the company name, industry, location, description, and optionally upload a logo. You can also search for existing clients using the search bar."
    },
    {
      keywords: ["campaign", "create campaign", "new campaign"],
      response: "Campaigns are organized under clients. First select a client, then click 'New Campaign' to create one. You'll need to provide a title, description, contact person, contact number, location, and start date."
    },
    {
      keywords: ["job", "jobs", "create job", "new job"],
      response: "Jobs are created within campaigns. Navigate to a campaign and click 'New Job' to create a job posting. You can specify job title, description, experience level, positions, department, and assign talent acquisition team members."
    },
    {
      keywords: ["candidate", "search candidate", "find candidate"],
      response: "You can search for candidates by uploading a job description. The system will match candidates based on skills and experience. You can also view profiles, schedule interviews, and track candidate progress through different rounds."
    },
    {
      keywords: ["interview", "schedule", "schedule interview"],
      response: "To schedule an interview, select a candidate and click 'Schedule Interview'. You can choose panel members, set date/time, add interview rounds, and send notifications to all participants."
    },
    {
      keywords: ["help", "how", "what", "guide"],
      response: "I can help you navigate the hiring platform! The main workflow is: Client Dashboard → Campaign Dashboard → Jobs Dashboard → Candidate Search. You can manage clients, create campaigns, post jobs, find candidates, and schedule interviews."
    }
  ];

  const getResponse = (message: string): string => {
    const lowercaseMessage = message.toLowerCase();
    const matchedResponse = dummyResponses.find(item =>
      item.keywords.some(keyword => lowercaseMessage.includes(keyword))
    );
    
    return matchedResponse?.response || 
      "I understand you're asking about the hiring platform. Could you be more specific? I can help with clients, campaigns, jobs, candidates, interviews, and general navigation questions.";
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // Simulate 2 second delay
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getResponse(inputMessage),
        isBot: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if (isFloating) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        )}
        
        {isOpen && (
          <Card className="w-80 h-96 glass border border-white/20 shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-sm">QChat</CardTitle>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/qchat")}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex flex-col h-64">
                <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isBot ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          message.isBot
                            ? "bg-muted text-muted-foreground"
                            : "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="flex space-x-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything..."
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Full page version
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.isBot ? "" : "flex-row-reverse space-x-reverse"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                message.isBot
                  ? "bg-gradient-to-r from-purple-600 to-blue-600"
                  : "bg-gradient-to-r from-blue-600 to-purple-600"
              }`}
            >
              {message.isBot ? (
                <Bot className="w-4 h-4 text-white" />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex flex-col space-y-1 max-w-md">
              <Badge variant="secondary" className="text-xs w-fit">
                {message.timestamp.toLocaleTimeString()}
              </Badge>
              <div
                className={`rounded-lg px-4 py-3 ${
                  message.isBot
                    ? "bg-muted text-muted-foreground"
                    : "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                }`}
              >
                {message.text}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-3 text-muted-foreground">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t bg-background">
        <div className="flex space-x-3">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about clients, campaigns, jobs, or hiring..."
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isTyping}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QChat;