import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  ArrowRight, 
  Calendar, 
  CreditCard, 
  ShieldCheck, 
  Phone,
  Clock,
  BookOpen,
  Award,
  HeartHandshake,
  MessageCircleQuestion,
  RefreshCw
} from 'lucide-react';
import { User, StudentProfile } from '../types';

interface HeroAgentPanelProps {
  onNavigate: (page: string) => void;
  currentUser?: User | null;
  students?: StudentProfile[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  action?: { type: string; label: string; page: string; icon?: React.ReactNode };
  time?: string;
}

export const HeroAgentPanel: React.FC<HeroAgentPanelProps> = ({ onNavigate, currentUser }) => {
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-welcome',
      role: 'assistant',
      text: "👋 **Welcome to SmartPen Academy!**\n\nI am Mrs. Deepthy Rock's AI Assistant. How can I help you and your child today?\n\n• Book a **Free 1:1 Demo Class** (4:00 PM – 7:00 PM)\n• Check **Fees & GPAY Payment** (₹1,600 for 8 classes)\n• View **Cursive & Print handwriting curriculum**",
      action: { 
        type: 'nav', 
        label: 'Book Free Demo Class →', 
        page: 'demo',
      },
      time: 'Just now'
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const parentQuickActions = [
    { 
      label: 'Book Free Demo (4–7 PM)', 
      query: 'I would like to book a free demo class for my child', 
      page: 'demo',
      icon: <Calendar className="w-3.5 h-3.5 text-blue-600" />
    },
    { 
      label: 'Course Fees (₹1,600)', 
      query: 'What is the fee structure and how do I pay via GPAY?', 
      page: 'gpay',
      icon: <CreditCard className="w-3.5 h-3.5 text-amber-600" />
    },
    { 
      label: '8-Class Syllabus', 
      query: 'What will my child learn in the 8-class handwriting program?', 
      page: 'syllabus',
      icon: <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
    },
    { 
      label: 'Coach & Timings', 
      query: 'Tell me about Mrs. Deepthy Rock, batch sizes, and daily timings', 
      page: 'home',
      icon: <Award className="w-3.5 h-3.5 text-purple-600" />
    },
  ];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleResetChat = () => {
    setMessages([
      {
        id: `m-${Date.now()}`,
        role: 'assistant',
        text: "👋 **Chat refreshed!** Ask me anything about SmartPen coaching, book your child's free trial class, or get instant assistance from Head Coach Mrs. Deepthy Rock.",
        action: { type: 'nav', label: 'Book Free Demo Class →', page: 'demo' },
        time: 'Just now'
      }
    ]);
  };

  const handleSend = async (customText?: string, targetNavPage?: string) => {
    const text = (customText || inputQuery).trim();
    if (!text || isProcessing) return;

    setInputQuery('');
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [
      ...prev, 
      { id: `m-user-${Date.now()}`, role: 'user', text, time: now }
    ]);
    setIsProcessing(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();

      let actionButton: { type: string; label: string; page: string } | undefined;
      const low = text.toLowerCase();
      
      if (targetNavPage) {
        if (targetNavPage === 'demo') actionButton = { type: 'nav', label: 'Open Demo Booking Window →', page: 'demo' };
        else if (targetNavPage === 'gpay') actionButton = { type: 'nav', label: 'Pay ₹1,600 via GPAY to Coach →', page: 'gpay' };
        else if (targetNavPage === 'enroll') actionButton = { type: 'nav', label: 'Open Enrollment Form →', page: 'enroll' };
      } else if (low.includes('demo') || low.includes('trial') || low.includes('slot') || low.includes('book')) {
        actionButton = { type: 'nav', label: 'Open Free Demo Booking Window →', page: 'demo' };
      } else if (low.includes('fee') || low.includes('gpay') || low.includes('pay') || low.includes('1600') || low.includes('1,600')) {
        actionButton = { type: 'nav', label: 'Pay ₹1,600 via Google Pay (GPAY) →', page: 'gpay' };
      } else if (low.includes('enroll') || low.includes('admission') || low.includes('register') || low.includes('join')) {
        actionButton = { type: 'nav', label: 'Complete Student Enrollment →', page: 'enroll' };
      }

      if (data.reply) {
        setMessages(prev => [
          ...prev, 
          { 
            id: `m-ai-${Date.now()}`,
            role: 'assistant', 
            text: data.reply,
            action: actionButton,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev, 
          { 
            id: `m-ai-${Date.now()}`,
            role: 'assistant', 
            text: "I'd be glad to help! You can book a free demo session for your child, view the complete handwriting curriculum, or enroll directly.",
            action: { type: 'nav', label: 'Book Free Demo Now →', page: 'demo' },
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev, 
        { 
          id: `m-ai-${Date.now()}`,
          role: 'assistant', 
          text: "SmartPen Academy offers personalized 1:1 handwriting coaching by Mrs. Deepthy Rock.\n\n• **Batch Timings**: 4:00 PM – 7:00 PM (Flexible)\n• **Fee**: ₹1,600 for 8 classes\n• **Demo**: Free 1-on-1 trial slot available!",
          action: { type: 'nav', label: 'Book Free Demo Now →', page: 'demo' },
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="w-full bg-white rounded-3xl border-2 border-blue-100 shadow-xl shadow-blue-900/10 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl hover:border-blue-200"
      id="hero-ai-agent-panel"
    >
      {/* 1. Friendly Parent Header */}
      <div className="bg-gradient-to-r from-[#0E3589] via-[#0E3589] to-[#0084F4] text-white px-5 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
              <Sparkles className="w-5 h-5 fill-amber-300" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0E3589] rounded-full shadow-xs"></span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                SmartPen Parent Assistant
              </h3>
              <span className="bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 text-[10px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider">
                Online
              </span>
            </div>
            <p className="text-[11px] text-blue-100/90 font-medium">
              Guided by Head Coach Mrs. Deepthy Rock
            </p>
          </div>
        </div>

        <button
          onClick={handleResetChat}
          title="Restart Conversation"
          className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          id="btn-hero-agent-reset"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Helpful Quick Parent Inquiries (Horizontal Chips) */}
      <div className="bg-blue-50/70 border-b border-blue-100/80 px-4 py-2.5">
        <div className="flex items-center gap-1 text-[11px] font-bold text-[#0E3589] uppercase tracking-wider mb-2">
          <MessageCircleQuestion className="w-3.5 h-3.5 text-[#F46E20]" />
          <span>Quick Questions from Parents:</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {parentQuickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(action.query, action.page)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-[#0E3589] text-xs font-semibold rounded-xl border border-slate-200 hover:border-amber-300 shadow-xs transition-all whitespace-nowrap cursor-pointer hover:shadow-sm shrink-0"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Interactive Friendly Chat Stream */}
      <div className="p-4 sm:p-5 flex-1 overflow-y-auto max-h-[300px] min-h-[220px] space-y-4 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-300">
        {messages.map((m) => (
          <div 
            key={m.id} 
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`flex items-start gap-2.5 max-w-[92%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar Icon */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-xs ${
                m.role === 'user' 
                  ? 'bg-[#F46E20] text-white' 
                  : 'bg-[#0E3589] text-white'
              }`}>
                {m.role === 'user' ? 'You' : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className={`px-4 py-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                m.role === 'user' 
                  ? 'bg-gradient-to-r from-[#0E3589] to-[#0084F4] text-white rounded-tr-xs' 
                  : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
              }`}>
                <div className="whitespace-pre-line prose-sm font-sans">
                  {m.text.split('\n').map((line, lIdx) => {
                    if (line.startsWith('• ') || line.startsWith('* ')) {
                      return (
                        <div key={lIdx} className="flex items-start gap-1.5 my-1">
                          <span className="text-[#F46E20] font-bold shrink-0">•</span>
                          <span>{line.replace(/^[•*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</span>
                        </div>
                      );
                    }
                    // Simple bold renderer
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <p key={lIdx} className={line ? 'my-1' : 'h-1'}>
                        {parts.map((p, pIdx) => {
                          if (p.startsWith('**') && p.endsWith('**')) {
                            return <strong key={pIdx} className={m.role === 'user' ? 'text-amber-200 font-extrabold' : 'text-[#0E3589] font-bold'}>{p.slice(2, -2)}</strong>;
                          }
                          return p;
                        })}
                      </p>
                    );
                  })}
                </div>

                {/* Primary Interactive Action Pill (If suggested by AI) */}
                {m.action && (
                  <button
                    onClick={() => onNavigate(m.action!.page)}
                    className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white font-extrabold rounded-xl text-xs transition-all shadow-md hover:shadow-lg cursor-pointer transform hover:-translate-y-0.5"
                    id={`btn-chat-action-${m.action.page}`}
                  >
                    <span>{m.action.label}</span>
                  </button>
                )}
              </div>
            </div>

            {m.time && (
              <span className={`text-[10px] text-slate-400 mt-1 px-9 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                {m.time}
              </span>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2.5 text-xs text-[#0E3589] bg-blue-50 border border-blue-100 p-2.5 rounded-2xl w-fit shadow-xs animate-pulse">
            <Sparkles className="w-4 h-4 text-[#F46E20] animate-spin" />
            <span className="font-bold">Coach Deepthy's assistant is drafting your answer...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* 4. Parent Friendly Input Bar */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Type your question (e.g. 'Can I book a demo for Saturday?')..."
            className="w-full bg-slate-50 hover:bg-white focus:bg-white text-slate-800 placeholder-slate-400 text-xs sm:text-[13px] px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-[#0084F4] focus:ring-2 focus:ring-blue-100 pr-11 transition-all"
            disabled={isProcessing}
            id="input-hero-agent-query"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isProcessing}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-[#0E3589] hover:bg-[#0084F4] disabled:opacity-30 text-white rounded-xl transition-all cursor-pointer shadow-sm"
            id="btn-hero-agent-submit"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* 5. Parent Trust Guarantee Footer */}
      <div className="bg-slate-50 px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 font-medium">
        <span className="flex items-center gap-1.5 text-[#0E3589]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          100% Parent & Child Friendly
        </span>
        <span className="flex items-center gap-1 text-slate-400 text-[10px]">
          <Phone className="w-3 h-3 text-[#F46E20]" />
          Direct Coach Hotline: 8861751000
        </span>
      </div>
    </div>
  );
};

