import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X, ArrowUpRight, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { sendChatQuery } from "@/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
      text: "Hello! I'm your QChat assistant, here to help with your recruitment queries. Ask me about clients, campaigns, jobs, or interviews, and I'll provide all the details you need. What's on your mind?",
      isBot: true,
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      isBot: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    try {
      const botResponseText = await sendChatQuery(inputMessage);
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponseText,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Oops, something went wrong: ${error instanceof Error ? error.message : "Unknown error"}. Please try again or rephrase your question!`,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
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
          <Card className="w-96 h-[28rem] glass border border-white/20 shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-sm font-semibold">QChat Assistant</CardTitle>
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
              <div className="flex flex-col h-80">
                <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2">
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
                        {message.isBot ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-2 mb-1" {...props} />,
                              h2: ({ node, ...props }) => <h2 className="text-base font-semibold mt-2 mb-1" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="text-sm font-medium mt-2 mb-1" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc list-inside my-1 space-y-1" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal list-inside my-1 space-y-1" {...props} />,
                              li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                              p: ({ node, ...props }) => <p className="my-1" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                            }}
                          >
                            {message.text}
                          </ReactMarkdown>
                        ) : (
                          message.text
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
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
                    placeholder="Ask about campaigns, interviews, or clients..."
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
                {message.isBot ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-2 mb-1" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-2 mb-1" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-base font-medium mt-2 mb-1" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside my-2 space-y-1" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-inside my-2 space-y-1" {...props} />,
                      li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                      p: ({ node, ...props }) => <p className="my-1" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : (
                  message.text
                )}
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
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
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
            placeholder="Ask about campaigns, interviews, or clients..."
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