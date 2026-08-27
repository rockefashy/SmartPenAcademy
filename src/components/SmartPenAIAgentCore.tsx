import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  Settings, 
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
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { User, StudentProfile } from '../types';
import { AIChatSettingsModal } from './AIChatSettingsModal';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const displayName = currentStudent?.name || (currentUser as any)?.fullName || currentUser?.name || 'Khwaish Sharma';

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

    const lowerText = text.toLowerCase();

    // Contextual responses & intent recognition
    setTimeout(async () => {
      let botReply = '';
      let actionType: ChatMessage['actionType'];

      if (lowerText.includes('demo') || lowerText.includes('trial') || lowerText.includes('slot') || lowerText.includes('book')) {
        botReply = "🎉 **Free Demo Class Available!**\n\nMrs. Deepthy Rock conducts 1:1 personalized demo classes across all 7 days (4:00 PM – 7:00 PM).\n\nWould you like to open the Free Demo Booking form now?";
        actionType = 'demo';
      } else if (lowerText.includes('gpay') || lowerText.includes('fee') || lowerText.includes('payment') || lowerText.includes('pay') || lowerText.includes('1600') || lowerText.includes('1,600')) {
        botReply = "💳 **Fee & Payment Details**\n\n• **Course Fee:** ₹1,600 for the complete 8-class mastery course.\n• **Payment Method:** Google Pay (GPAY) directly to Head Coach Mrs. Deepthy Rock.\n• **Contact / GPAY ID:** `8861751000`\n\nClick below to view the official GPAY QR Code & payment details:";
        actionType = 'gpay';
      } else if (lowerText.includes('enroll') || lowerText.includes('register') || lowerText.includes('admission') || lowerText.includes('join')) {
        botReply = "📝 **Fast Online Enrollment**\n\nYou can register your child in under 2 minutes. We offer customized batches for Kids (Ages 5–9), Juniors (Ages 10–14), and Teens & Adults.\n\nClick below to open the Enrollment page:";
        actionType = 'enroll';
      } else if (lowerText.includes('syllabus') || lowerText.includes('curriculum') || lowerText.includes('classes') || lowerText.includes('levels')) {
        botReply = "📚 **7-Step Handwriting Mastery Curriculum**\n\n1. Posture & 3-Point Grip\n2. Basic Strokes & Letter Geometry\n3. Cursive & Print Letter Formation\n4. Letter Joining & Word Flow\n5. Spacing & Margin Alignment\n6. Speed Writing & Exam Prep\n7. Final Assessment & Star Achiever Certificate";
        actionType = 'syllabus';
      } else if (lowerText.includes('attendance') || lowerText.includes('status') || lowerText.includes('summary') || lowerText.includes('progress')) {
        const attended = currentStudent?.classesAttended ?? 3;
        botReply = `📊 **Attendance & Fee Status for ${displayName}**\n\n• **Classes Completed:** ${attended} / 8 classes\n• **Classes Remaining:** ${8 - attended} classes\n• **Fee Status:** ✅ Paid (₹1,600)\n\nWould you like to open your Parent Portal for detailed reports?`;
        actionType = 'portal';
      } else {
        try {
          const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text,
              context: {
                user: displayName,
                role: currentUser?.role || 'student',
              },
            }),
          });
          const data = await res.json();
          botReply = data.reply || "I am here to assist with any questions about handwriting courses, batch slots (4:00 PM – 7:00 PM), or Mrs. Deepthy Rock's coaching.";
        } catch {
          botReply = "I am here to help you book free demo slots, check batch availability (4:00 PM – 7:00 PM), or enroll in our 8-class course.";
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: botReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionType,
        },
      ]);
      setIsTyping(false);
    }, 400);
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
          ? 'h-full' 
          : 'rounded-3xl border-2 border-blue-200/80 shadow-2xl shadow-blue-900/10 min-h-[580px] max-h-[660px]'
      }`}
      id="smartpen-ai-agent-core"
    >
      {/* 1. Header (Exact Match to User Blueprint) */}
      <div className="bg-[#124EBF] text-white px-5 py-3.5 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          {/* Rounded square container with Robot icon */}
          <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-inner shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-[15px] tracking-tight text-white">SmartPen AI Agent</h3>
              <span className="bg-[#F95F1E] text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-xs">
                V2.5
              </span>
            </div>
            <p className="text-xs text-blue-100 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span className="truncate">{displayName} ({roleLabel})</span>
            </p>
          </div>
        </div>

        {/* Top-Right Control Buttons */}
        <div className="flex items-center gap-1 text-blue-100">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-white/10 hover:text-white rounded-xl transition-colors cursor-pointer"
            title="AI Settings & System Directives"
            id="btn-chat-settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetChat}
            className="p-2 hover:bg-white/10 hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Restart Conversation"
            id="btn-chat-restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-2 hover:bg-white/10 hover:text-white rounded-xl transition-colors cursor-pointer hidden sm:block"
              title={isExpanded ? "Collapse" : "Expand"}
              id="btn-chat-expand"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {isFloatingModal && onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 hover:text-white rounded-xl transition-colors cursor-pointer ml-0.5"
              title="Close AI Assistant"
              id="btn-chat-close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Scroll Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-white scrollbar-thin scrollbar-thumb-slate-300"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* Bot Avatar on Left */}
            {m.sender === 'bot' && (
              <div className="w-8 h-8 rounded-xl bg-[#124EBF] flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                <Bot className="w-4.5 h-4.5" />
              </div>
            )}

            {/* Message Speech Card */}
            <div
              className={`max-w-[86%] sm:max-w-[84%] rounded-3xl px-5 py-4 text-xs sm:text-[13.5px] leading-relaxed relative ${
                m.sender === 'user'
                  ? 'bg-gradient-to-r from-[#124EBF] to-[#0084F4] text-white rounded-tr-xs shadow-md'
                  : 'bg-white text-slate-800 border border-slate-200/90 rounded-2xl rounded-tl-xs shadow-xs'
              }`}
            >
              {/* Message Content with bold & bullet point formatting */}
              <div className="prose-sm whitespace-pre-line">
                {m.text.split('\n').map((line, lIdx) => {
                  if (line.startsWith('• ') || line.startsWith('* ')) {
                    return (
                      <div key={lIdx} className="flex items-start gap-1.5 my-1">
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
                    <p key={lIdx} className={line ? 'my-1' : 'h-1.5'}>
                      {parts.map((part, pIdx) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={pIdx} className={m.sender === 'user' ? 'text-white font-black' : 'text-[#0E3589] font-bold'}>{part.slice(2, -2)}</strong>;
                        }
                        if (part.startsWith('*') && part.endsWith('*')) {
                          return <span key={pIdx} className={m.sender === 'user' ? 'text-blue-100 italic' : 'text-slate-600 italic font-medium'}>{part.slice(1, -1)}</span>;
                        }
                        if (part.startsWith('`') && part.endsWith('`')) {
                          return <code key={pIdx} className="px-1.5 py-0.5 bg-blue-50 text-[#0E3589] font-mono text-[11px] rounded border border-blue-200">{part.slice(1, -1)}</code>;
                        }
                        return part;
                      })}
                    </p>
                  );
                })}
              </div>

              {/* Action Buttons for Bot Responses */}
              {m.actionType && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-2">
                  {m.actionType === 'demo' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenDemoModal) onOpenDemoModal();
                        else if (onNavigate) onNavigate('landing');
                      }}
                      className="px-3.5 py-2 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer transform hover:-translate-y-0.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Open Free Demo Slot →</span>
                    </button>
                  )}

                  {m.actionType === 'gpay' && (
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate('gpay')}
                      className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer transform hover:-translate-y-0.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay ₹1,600 via GPAY →</span>
                    </button>
                  )}

                  {m.actionType === 'enroll' && (
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate('enroll')}
                      className="px-3.5 py-2 bg-gradient-to-r from-[#0E3589] to-[#0084F4] hover:from-[#09225a] hover:to-[#0070d0] text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer transform hover:-translate-y-0.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Go to Enrollment Page →</span>
                    </button>
                  )}

                  {m.actionType === 'syllabus' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigate) onNavigate('landing');
                        const el = document.getElementById('syllabus-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Explore 8-Class Syllabus →</span>
                    </button>
                  )}

                  {m.actionType === 'portal' && (
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate('parentPortal')}
                      className="px-3.5 py-2 bg-[#124EBF] hover:bg-[#0084F4] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Open Parent Portal →</span>
                    </button>
                  )}
                </div>
              )}

              {/* Timestamp at Bottom-Right */}
              <div className={`text-[10px] mt-2 text-right font-medium ${
                m.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
              }`}>
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#124EBF] flex items-center justify-center text-white shrink-0 shadow-xs">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
              <span className="text-xs text-slate-500 font-medium ml-1">SmartPen Assistant is typing...</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. QUICK ACTIONS Section (Matching Reference Image) */}
      <div className="bg-white border-t border-slate-100 px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#F95F1E] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#F95F1E]" />
            <span>QUICK ACTIONS</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => scrollQuickActions('left')}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="Scroll Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollQuickActions('right')}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Quick Action Chips */}
        <div
          ref={quickActionsRef}
          className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth"
        >
          {quickActions.map((qa, idx) => {
            const Icon = qa.icon;
            return (
              <button
                key={idx}
                onClick={qa.action}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer ${qa.color}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{qa.label}</span>
              </button>
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
        className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="e.g. Enroll student, book demo, or GPAY to coach..."
            className="w-full bg-white text-slate-800 placeholder-slate-400 text-xs sm:text-sm px-4 py-3 rounded-2xl border border-slate-300 focus:outline-none focus:border-[#124EBF] focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs"
            disabled={isTyping}
            id="input-smartpen-ai-message"
          />
        </div>

        <button
          type="submit"
          disabled={!inputMessage.trim() || isTyping}
          className="w-11 h-11 bg-[#124EBF] hover:bg-[#0084F4] disabled:opacity-40 text-white rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0 transform active:scale-95"
          id="btn-smartpen-ai-send"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* AI Settings Modal */}
      <AIChatSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveDirectives={() => {}}
      />
    </div>
  );
};
