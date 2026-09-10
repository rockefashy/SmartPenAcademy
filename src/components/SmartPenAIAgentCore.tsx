import { api } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  X, 
  Users, 
  Calendar, 
  CreditCard, 
  BookOpen, 
  Phone, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { User, StudentProfile } from '../types';

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user' | 'system';
  text: string;
  timestamp: string;
  actionType?: 'demo' | 'gpay' | 'enroll' | 'portal' | 'syllabus';
}

interface SmartPenAIAgentCoreProps {
  currentUser?: User | null;
  currentStudent?: StudentProfile | null;
  onNavigate?: (page: string, extraId?: string, defaultSection?: number) => void;
  onOpenDemoModal?: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isFloatingModal?: boolean;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const SmartPenAIAgentCore: React.FC<SmartPenAIAgentCoreProps> = ({
  currentUser,
  currentStudent,
  onNavigate,
  onOpenDemoModal,
  messages,
  setMessages,
  isFloatingModal = false,
  onClose,
  isExpanded = false,
  onToggleExpand,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll ONLY internal chat box container without scrolling the main window/page
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Scroll quick actions
  const scrollQuickActions = (direction: 'left' | 'right') => {
    if (quickActionsRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      quickActionsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const displayName = currentStudent?.name || currentUser?.displayName || currentUser?.name || 'Khwaish Sharma';

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        text: `👋 Hello **${displayName}**! I am your SmartPen Assistant.\n\nYou can ask me:\n\n• *"I want to enroll / register my child"*\n• *"Book a free demo class"*\n• *"How to GPAY coaching fee to coach?"*\n• *"What is my attendance summary and fee status?"*`,
        timestamp: '01:45 PM',
      }
    ]);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsTyping(true);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await api.sendAIChat(history);

      let actionType: ChatMessage['actionType'];
      if (res.toolResults && res.toolResults.length > 0) {
        for (const tr of res.toolResults) {
          if (tr.toolName === 'navigateToPage' && tr.result?.target) {
            const t = String(tr.result.target).toLowerCase();
            if (t.includes('demo')) actionType = 'demo';
            else if (t.includes('enroll')) actionType = 'enroll';
            else if (t.includes('gpay')) actionType = 'gpay';
            else if (t.includes('syllabus')) actionType = 'syllabus';
            else if (t.includes('portal') || t.includes('parent')) actionType = 'portal';
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: res.reply || "I've processed your request.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionType,
        },
      ]);
    } catch (err: any) {
      console.error('AI Chat request failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: err.message || "Sorry, I encountered an issue connecting to the AI Assistant. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickActions = [
    { 
      label: 'Enroll Student', 
      icon: Users, 
      color: 'text-amber-700 bg-amber-50/90 border-amber-200 hover:bg-amber-100', 
      action: () => handleSend("I want to enroll / register my child") 
    },
    { 
      label: 'Book Free Demo', 
      icon: Sparkles, 
      color: 'text-blue-700 bg-blue-50/90 border-blue-200 hover:bg-blue-100', 
      action: () => handleSend("Book a free demo class") 
    },
    { 
      label: 'GPAY to Coach', 
      icon: CreditCard, 
      color: 'text-emerald-700 bg-emerald-50/90 border-emerald-200 hover:bg-emerald-100', 
      action: () => handleSend("How to GPAY coaching fee to coach?") 
    },
    { 
      label: 'My Attendance', 
      icon: Calendar, 
      color: 'text-slate-700 bg-slate-100/90 border-slate-300 hover:bg-slate-200', 
      action: () => handleSend("What is my attendance summary and fee status?") 
    },
    { 
      label: 'Course Syllabus', 
      icon: BookOpen, 
      color: 'text-purple-700 bg-purple-50/90 border-purple-200 hover:bg-purple-100', 
      action: () => handleSend("Show 8-class handwriting curriculum") 
    },
    { 
      label: 'Contact Coach', 
      icon: Phone, 
      color: 'text-teal-700 bg-teal-50/90 border-teal-200 hover:bg-teal-100', 
      action: () => handleSend("How to contact Mrs. Deepthy Rock?") 
    },
  ];

  const roleLabel = currentUser?.role === 'admin' ? 'Admin' : 'Student';

  return (
    <div 
      className={`w-full bg-white flex flex-col overflow-hidden select-none ${
        isFloatingModal 
          ? 'h-full max-h-full' 
          : 'rounded-3xl border-2 border-blue-200/80 shadow-2xl shadow-blue-900/10 h-[560px] max-h-[560px]'
      }`}
      id="smartpen-ai-agent-core"
    >
      {/* 1. Header */}
      <div className="bg-[#124EBF] text-white px-4 py-2.5 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Rounded square container with Robot icon */}
          <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-inner shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-black text-sm tracking-tight text-white">SmartPen AI Agent</h3>
              <span className="bg-[#F95F1E] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-xs">
                V2.5
              </span>
            </div>
            <p className="text-[11px] text-blue-100 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span className="truncate">SmartPen Academy</span>
            </p>
          </div>
        </div>

        {/* Top-Right Control Buttons */}
        <div className="flex items-center gap-0.5 text-blue-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleResetChat}
            className="p-1.5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg min-h-[30px] min-w-[30px]"
            title="Restart Conversation"
            id="btn-chat-restart"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          {onToggleExpand && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="p-1.5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg min-h-[30px] min-w-[30px] hidden sm:flex"
              title={isExpanded ? "Collapse" : "Expand"}
              id="btn-chat-expand"
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
          )}
          {isFloatingModal && onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg min-h-[30px] min-w-[30px] ml-0.5"
              title="Close AI Assistant"
              id="btn-chat-close"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 2. Messages Scroll Area with fixed height & internal scrolling */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/60 scrollbar-thin scrollbar-thumb-slate-300 min-h-0"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-1.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* Bot Avatar on Left */}
            {m.sender === 'bot' && (
              <div className="w-6 h-6 rounded-lg bg-[#124EBF] flex items-center justify-center text-white shrink-0 shadow-2xs mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            {/* Message Speech Card with compact width and padding */}
            <div
              className={`text-xs leading-snug relative ${
                m.sender === 'user'
                  ? 'w-fit max-w-[80%] bg-gradient-to-r from-[#124EBF] to-[#0084F4] text-white px-3 py-1.5 rounded-xl rounded-tr-xs shadow-xs'
                  : 'w-fit max-w-[88%] bg-white text-slate-800 border border-slate-200/90 px-3 py-2 rounded-xl rounded-tl-xs shadow-2xs'
              }`}
            >
              {/* Message Content with tight vertical rhythm */}
              <div className="prose-sm whitespace-pre-line text-xs">
                {m.text.split('\n').map((line, lIdx) => {
                  if (line.startsWith('• ') || line.startsWith('* ')) {
                    return (
                      <div key={lIdx} className="flex items-start gap-1 my-0.5">
                        <span className={m.sender === 'user' ? 'text-amber-200 font-bold' : 'text-[#F95F1E] font-bold'}>•</span>
                        <span>
                          {line.replace(/^[•*]\s*/, '').split(/(\*\*.*?\*\*)/g).map((part, pIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={pIdx} className={m.sender === 'user' ? 'text-white font-black' : 'text-[#0E3589] font-bold'}>{part.slice(2, -2)}</strong>;
                            }
                            return part;
                          })}
                        </span>
                      </div>
                    );
                  }

                  const parts = line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
                  return (
                    <p key={lIdx} className={line ? 'my-0.5' : 'h-1'}>
                      {parts.map((part, pIdx) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={pIdx} className={m.sender === 'user' ? 'text-white font-black' : 'text-[#0E3589] font-bold'}>{part.slice(2, -2)}</strong>;
                        }
                        if (part.startsWith('*') && part.endsWith('*')) {
                          return <span key={pIdx} className={m.sender === 'user' ? 'text-blue-100 italic' : 'text-slate-600 italic font-medium'}>{part.slice(1, -1)}</span>;
                        }
                        if (part.startsWith('`') && part.endsWith('`')) {
                          return <code key={pIdx} className="px-1 py-0.2 bg-blue-50 text-[#0E3589] font-mono text-[10px] rounded border border-blue-200">{part.slice(1, -1)}</code>;
                        }
                        return part;
                      })}
                    </p>
                  );
                })}
              </div>

              {/* Action Buttons for Bot Responses */}
              {m.actionType && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                  {m.actionType === 'demo' && (
                    <Button
                      type="button"
                      variant="accent"
                      size="sm"
                      onClick={() => {
                        if (onOpenDemoModal) onOpenDemoModal();
                        else if (onNavigate) onNavigate('landing');
                      }}
                      leftIcon={<Sparkles className="w-3 h-3" />}
                      className="text-[11px] py-1 px-2.5 transform hover:-translate-y-0.5"
                    >
                      Open Free Demo Slot →
                    </Button>
                  )}

                  {m.actionType === 'gpay' && (
                    <Button
                      type="button"
                      variant="success"
                      size="sm"
                      onClick={() => onNavigate && onNavigate('gpay')}
                      leftIcon={<CreditCard className="w-3 h-3" />}
                      className="text-[11px] py-1 px-2.5 transform hover:-translate-y-0.5"
                    >
                      Pay ₹1,600 via GPAY →
                    </Button>
                  )}

                  {m.actionType === 'enroll' && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigate && onNavigate('enroll')}
                      leftIcon={<Users className="w-3 h-3" />}
                      className="text-[11px] py-1 px-2.5 transform hover:-translate-y-0.5"
                    >
                      Go to Enrollment Page →
                    </Button>
                  )}

                  {m.actionType === 'syllabus' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (onNavigate) onNavigate('landing');
                        const el = document.getElementById('syllabus-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      leftIcon={<BookOpen className="w-3 h-3" />}
                      className="text-[11px] py-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white border-transparent"
                    >
                      Explore 8-Class Syllabus →
                    </Button>
                  )}

                  {m.actionType === 'portal' && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => onNavigate && onNavigate('parentPortal')}
                      leftIcon={<Calendar className="w-3 h-3" />}
                      className="text-[11px] py-1 px-2.5"
                    >
                      Open Parent Portal →
                    </Button>
                  )}
                </div>
              )}

              {/* Timestamp Compact */}
              <div className={`text-[9.5px] mt-0.5 text-right font-medium leading-none ${
                m.sender === 'user' ? 'text-blue-100 opacity-90' : 'text-slate-400'
              }`}>
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-start gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-[#124EBF] flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl rounded-tl-xs px-2.5 py-1 shadow-2xs flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
              <span className="text-[10.5px] text-slate-500 font-medium ml-0.5">typing...</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. QUICK ACTIONS Section */}
      <div className="bg-white border-t border-slate-100 px-3 py-1.5 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1 text-[10px] font-extrabold text-[#F95F1E] uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-[#F95F1E]" />
            <span>QUICK ACTIONS</span>
          </div>

          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => scrollQuickActions('left')}
              className="p-0.5 text-slate-400 hover:text-slate-700 min-h-[30px] min-w-[30px]"
              title="Scroll Left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => scrollQuickActions('right')}
              className="p-0.5 text-slate-400 hover:text-slate-700 min-h-[30px] min-w-[30px]"
              title="Scroll Right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Quick Action Chips */}
        <div
          ref={quickActionsRef}
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar scroll-smooth"
        >
          {quickActions.map((qa, idx) => {
            const Icon = qa.icon;
            return (
              <Button
                key={idx}
                type="button"
                variant="outline"
                size="sm"
                onClick={qa.action}
                leftIcon={<Icon className="w-3 h-3 shrink-0" />}
                className={`text-[11px] py-1 px-2.5 ${qa.color}`}
              >
                {qa.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* 4. Input Form with Blue Send Button */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
      >
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="e.g. Enroll student, book demo, or GPAY to coach..."
            disabled={isTyping}
            id="input-smartpen-ai-message"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="icon"
          disabled={!inputMessage.trim() || isTyping}
          className="shadow-md shrink-0 transform active:scale-95"
          id="btn-smartpen-ai-send"
          title="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>

    </div>
  );
};
