'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, X, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { clientLogger } from '@/lib/client-logger';
import { ErrorAlert } from '@/components/ErrorAlert';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  iterationId?: string;
}

interface AnalysisChatProps {
  sessionId: string;
  isOpen?: boolean;
  onClose?: () => void;
  initialMessages?: Message[];
  analysisData?: any;
}

export function AnalysisChat({
  sessionId,
  isOpen,
  onClose,
  initialMessages = [],
  analysisData,
}: AnalysisChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update messages when initialMessages prop changes
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    setError('');
    setErrorCode('');

    const userMessage: Message = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/analyze/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: userMessage.content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send message');
        setErrorCode(data.code || '');
        setIsLoading(false);
        // Remove the user message if the request failed
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp,
        iterationId: data.iterationId,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      clientLogger.error('Failed to send chat message', { error, sessionId });
      setError(error.message || 'Failed to send message');
      setErrorCode('');
      // Remove the user message if the request failed
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // If isOpen is defined (modal mode) and it's false, don't render
  if (isOpen !== undefined && !isOpen) return null;

  // Determine if we're in modal or embedded mode
  const isModal = isOpen !== undefined;

  const renderChatCard = () => (
    <Card className={`w-full flex flex-col ${isModal ? 'max-w-3xl h-[600px]' : 'h-[500px]'}`}>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>
                {messages.length > 0 ? 'Continue Conversation' : 'Ask AI About Your Analysis'}
              </CardTitle>
              <CardDescription>
                {messages.length > 0
                  ? 'Your previous chat history is shown below'
                  : 'Get help understanding compliance requirements'}
              </CardDescription>
            </div>
          </div>
          {isModal && onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && <ErrorAlert message={error} code={errorCode} />}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 bg-blue-100 rounded-full mb-4">
              <MessageCircle className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Start a Conversation</h3>
            <p className="text-sm text-slate-600 max-w-md mb-4">
              Ask questions about your analysis results, compliance requirements, or how to fix
              specific issues.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-md text-left">
              <button
                onClick={() => setInputMessage('What allergen format is required?')}
                className="p-3 text-sm bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors"
              >
                "What allergen format is required?"
              </button>
              <button
                onClick={() => setInputMessage('How should I word the net weight declaration?')}
                className="p-3 text-sm bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors"
              >
                "How should I word the net weight declaration?"
              </button>
              <button
                onClick={() => setInputMessage('Can you explain the ingredient order requirement?')}
                className="p-3 text-sm bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors"
              >
                "Can you explain the ingredient order requirement?"
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-lg p-4 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                  <p className="text-sm text-slate-600">AI is thinking...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your analysis..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Press Enter to send • The AI has context of your analysis results
        </p>
      </div>
    </Card>
  );

  // Return with or without modal wrapper based on mode
  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        {renderChatCard()}
      </div>
    );
  }

  return renderChatCard();
}
