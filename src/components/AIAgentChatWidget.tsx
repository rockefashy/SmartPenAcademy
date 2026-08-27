import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User as UserIcon, 
  Sparkles, 
  Settings as SettingsIcon, 
  Lock, 
  LogIn, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  CreditCard, 
  Users, 
  FileText, 
  Bell, 
  RotateCcw, 
  Minimize2, 
  Maximize2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { AIChatSettingsModal, AIModelConfig } from './AIChatSettingsModal';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolResults?: any[];
  isAction?: boolean;
}

interface AIAgentChatWidgetProps {
  onNavigate?: (view: string, extraId?: string, defaultSection?: number) => void;
  onOpenDemoBooking?: () => void;
}

const STORAGE_KEY_CONFIG = 'smartpen_ai_config';

export const AIAgentChatWidget: React.FC<AIAgentChatWidgetProps> = ({ onNavigate, onOpenDemoBooking }) => {
  const { user, isAuthenticated, openLoginModal } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiConfig, setAiConfig] = useState<AIModelConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      apiKey: '',
      apiUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.5-flash',
      temperature: 0.7
    };
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && isAuthenticated) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen, isMinimized, isAuthenticated]);

  // Initial welcome greeting on auth state change
  useEffect(() => {
    if (isAuthenticated && user) {
      const initialGreeting: Message = {
        id: 'msg-welcome',
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: user.role === 'admin'
          ? `👋 Hello **${user.fullName || 'Admin'}**! I am your SmartPen AI Assistant.\n\nYou can speak naturally or give commands like:\n• *"Update attendance for Student 1, 2, 3 for today"*\n• *"Mark Aarav and Ananya as Present"*\n• *"Check pending fee alerts"*\n• *"Generate progress report for Khwaish"*`
          : `👋 Hello **${user.fullName || 'Parent/Student'}**! I am your SmartPen Assistant.\n\nYou can ask me:\n• *"I want to enroll / register my child"*\n• *"Book a free demo class"*\n• *"How to GPAY coaching fee to coach?"*\n• *"What is my attendance summary and fee status?"*`
      };
      setMessages([initialGreeting]);
    } else {
      const guestMessage: Message = {
        id: 'msg-guest',
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: `👋 **Welcome to SmartPen Academy AI!**\n\nI can help you explore handwriting courses, enroll for batches, book a free trial class, or make payments:\n• *"I want to enroll"* - Direct to Enrollment page\n• *"Book a free demo class"* - Open trial class booking\n• *"Pay fee via GPAY to coach"* - Direct Google Pay to 8861751000\n• Or sign in to view your attendance and progress reports!`
      };
      setMessages([guestMessage]);
    }
  }, [isAuthenticated, user?.id, user?.role]);

  const handleSaveConfig = (newConfig: AIModelConfig) => {
    setAiConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
    } catch (e) {}
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputPrompt.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Map messages for backend API
      const apiMessages = updatedHistory.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await api.sendAIChat(apiMessages, aiConfig);

      const assistantMessage: Message = {
        id: `msg-res-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolResults: response.toolResults
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-trigger navigation if navigateToPage tool was invoked
      if (response.toolResults && response.toolResults.length > 0) {
        for (const tool of response.toolResults) {
          if (tool.toolName === 'navigateToPage' && tool.success) {
            const target = tool.result?.target;
            if (target === 'demo') {
              if (onOpenDemoBooking) {
                onOpenDemoBooking();
              } else if (onNavigate) {
                onNavigate('landing');
              }
            } else if (target === 'enroll' && onNavigate) {
              onNavigate('enroll');
            } else if (target === 'parentPortal' && onNavigate) {
              onNavigate('parentPortal', tool.result?.studentId);
            } else if (target === 'about' && onNavigate) {
              onNavigate('about');
            } else if (target === 'admin' && onNavigate && user?.role === 'admin') {
              onNavigate('admin');
            }
          }
        }
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${error.message || 'Failed to process request with AI Agent.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    if (isAuthenticated && user) {
      setMessages([
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `Conversation reset. How can I assist you with SmartPen Academy today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } else {
      setMessages([]);
    }
  };

  // Quick Action Prompts
  const adminQuickPrompts = [
    { label: "Update Today's Attendance", prompt: "Update attendance for Student 1, 2, 3 for today", icon: Calendar, color: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100" },
    { label: "Check Fee Alerts", prompt: "Check pending fee alerts and dues", icon: Bell, color: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100" },
    { label: "List Enrolled Students", prompt: "List all enrolled students", icon: Users, color: "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100" },
    { label: "Record Fee Payment", prompt: "Record fee payment for Aarav Mehta for Classes 1 - 8 via GPAY", icon: CreditCard, color: "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100" },
    { label: "Generate Progress Report", prompt: "Generate progress report for Ananya Raghavan after 10 classes with 5 stars", icon: FileText, color: "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100" },
    { label: "View Demo Bookings", prompt: "Show recent free demo bookings", icon: Sparkles, color: "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100" },
  ];

  const studentQuickPrompts = [
    { label: "Enroll Student", prompt: "I want to enroll for classes", icon: Users, color: "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100" },
    { label: "Book Free Demo", prompt: "Book a free demo class", icon: Sparkles, color: "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100" },
    { label: "GPAY to Coach", prompt: "How do I pay fee via GPAY to coach?", icon: CreditCard, color: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100" },
    { label: "My Attendance", prompt: "What is my attendance summary?", icon: Calendar, color: "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100" },
    { label: "Fee Status", prompt: "Do I have any pending fee?", icon: CreditCard, color: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100" },
  ];

  const guestQuickPrompts = [
    { label: "Enroll Now", prompt: "I want to enroll a new student", icon: Users, color: "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100" },
    { label: "Book Free Demo", prompt: "I would like to book a free demo class", icon: Sparkles, color: "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100" },
    { label: "GPAY to Coach", prompt: "What is the GPAY number for coach fee payment?", icon: CreditCard, color: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100" },
    { label: "Course Fees", prompt: "What are the course fees and batch timings?", icon: FileText, color: "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100" },
  ];

  return (
    <>
      {/* Floating Trigger Button (Bottom Right) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            className="group relative flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-[#0E3589] to-[#1a4ec4] text-white rounded-full shadow-2xl hover:shadow-blue-900/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/30"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F46E20] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#F46E20] border-2 border-white"></span>
              </span>
            </div>
            
            <div className="text-left pr-1">
              <div className="text-xs font-black tracking-wide uppercase flex items-center gap-1.5">
                <span>AI Assistant</span>
                <Sparkles className="w-3 h-3 text-[#F46E20]" />
              </div>
              <p className="text-[11px] text-blue-100/90 font-medium leading-none">
                {isAuthenticated ? (user?.role === 'admin' ? 'Admin Commands' : 'Student Assistant') : 'Sign in to chat'}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Floating Chatbot Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ${
            isMinimized 
              ? 'w-80 h-16' 
              : 'w-[95vw] sm:w-[440px] md:w-[480px] h-[640px] max-h-[88vh]'
          }`}
        >
          {/* Header Bar */}
          <div className="px-5 py-3.5 bg-gradient-to-r from-[#0E3589] via-[#123e9e] to-[#194ec7] text-white flex items-center justify-between shadow-md select-none shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/25 shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-black tracking-tight truncate">SmartPen AI Agent</h2>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-[#F46E20] text-white uppercase tracking-wider">
                    v2.5
                  </span>
                </div>
                <div className="text-[11px] text-blue-100/90 truncate flex items-center gap-1">
                  {isAuthenticated && user ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                      <span className="font-semibold">{user.fullName || user.username}</span>
                      <span className="opacity-75">({user.role === 'admin' ? 'Admin' : 'Student'})</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                      <span className="opacity-90">Guest (Login required)</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsSettingsOpen(true)}
                title="AI Model & API Settings"
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearChat}
                title="Reset Conversation"
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Maximize" : "Minimize"}
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Chat Content (Visible when not minimized) */}
          {!isMinimized && (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
              {/* Messages Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-[#0E3589] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#0E3589] text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                      }`}
                    >
                      {/* Content formatted */}
                      <div className="whitespace-pre-wrap font-normal">
                        {msg.content.split('\n').map((line, lIdx) => {
                          // Highlight bold text markdown **text**
                          const parts = line.split(/(\*\*.*?\*\*)/g);
                          return (
                            <p key={lIdx} className={line.startsWith('•') ? 'pl-2 py-0.5' : 'py-0.5'}>
                              {parts.map((part, pIdx) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return (
                                    <strong key={pIdx} className="font-bold text-inherit">
                                      {part.slice(2, -2)}
                                    </strong>
                                  );
                                }
                                if (part.startsWith('*') && part.endsWith('*')) {
                                  return (
                                    <em key={pIdx} className="italic text-inherit">
                                      {part.slice(1, -1)}
                                    </em>
                                  );
                                }
                                return part;
                              })}
                            </p>
                          );
                        })}
                      </div>

                      {/* Tool Execution Result Cards */}
                      {msg.toolResults && msg.toolResults.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-2">
                          {msg.toolResults.map((tool, tIdx) => (
                            <div
                              key={tIdx}
                              className={`p-2.5 rounded-xl border text-[11px] ${
                                tool.success
                                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                                  : 'bg-red-50/80 border-red-200 text-red-950'
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold pb-1">
                                <div className="flex items-center gap-1.5">
                                  {tool.success ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                  )}
                                  <span>Action: {tool.toolName === 'navigateToPage' ? 'Page Navigation' : tool.toolName}</span>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-slate-200 uppercase font-semibold">
                                  Live Action
                                </span>
                              </div>

                              {/* Navigation Action Buttons within tool results */}
                              {tool.toolName === 'navigateToPage' && (
                                <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[10px] text-emerald-800 font-medium">
                                    {tool.result?.reason || `Navigated to ${tool.result?.target}`}
                                  </span>

                                  {tool.result?.target === 'demo' && (
                                    <button
                                      onClick={() => {
                                        if (onOpenDemoBooking) onOpenDemoBooking();
                                        else if (onNavigate) onNavigate('landing');
                                      }}
                                      className="px-2.5 py-1 bg-gradient-to-r from-[#0E3589] to-[#1a4ec4] hover:from-[#092666] hover:to-[#0E3589] text-white rounded-md text-[10px] font-bold inline-flex items-center gap-1 shadow-xs cursor-pointer"
                                    >
                                      <span>Open Demo Booking Slot</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                  )}

                                  {tool.result?.target === 'enroll' && onNavigate && (
                                    <button
                                      onClick={() => onNavigate('enroll')}
                                      className="px-2.5 py-1 bg-gradient-to-r from-[#F46E20] to-[#e05e12] hover:from-[#d8580d] hover:to-[#c44e0a] text-white rounded-md text-[10px] font-bold inline-flex items-center gap-1 shadow-xs cursor-pointer"
                                    >
                                      <span>Go to Enrollment Form</span>
                                      <ChevronRight className="w-2.5 h-2.5" />
                                    </button>
                                  )}

                                  {tool.result?.target === 'gpay' && (
                                    <a
                                      href={tool.result?.gpayLink || `upi://pay?pa=8861751000@okbizaxis&pn=SmartPen%20Academy&am=1600&cu=INR`}
                                      className="px-2.5 py-1 bg-[#F46E20] hover:bg-[#d95d13] text-white rounded-md text-[10px] font-bold inline-flex items-center gap-1 shadow-xs"
                                    >
                                      <span>Pay ₹1,600 via GPAY</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}

                                  {tool.result?.target === 'parentPortal' && onNavigate && (
                                    <button
                                      onClick={() => onNavigate('parentPortal', tool.result?.studentId)}
                                      className="px-2.5 py-1 bg-[#0E3589] hover:bg-[#092666] text-white rounded-md text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>Open Student Portal</span>
                                      <ChevronRight className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Fee Status Quick Payment Button */}
                              {tool.toolName === 'getFeeStatus' && tool.result?.gpayNumber && (
                                <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 flex items-center justify-between">
                                  <span className="text-[10px] text-emerald-800">
                                    GPAY: <strong>{tool.result.gpayNumber}</strong>
                                  </span>
                                  <a
                                    href={tool.result.gpayLink || `upi://pay?pa=8861751000@okbizaxis&pn=SmartPen%20Academy&am=1600&cu=INR`}
                                    className="px-2 py-1 bg-[#F46E20] hover:bg-[#d95d13] text-white rounded-md text-[10px] font-bold inline-flex items-center gap-1"
                                  >
                                    <span>Open GPAY</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              )}

                              {/* Attendance update indicator */}
                              {tool.toolName === 'updateAttendance' && onNavigate && user?.role === 'admin' && (
                                <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 flex items-center justify-between">
                                  <span className="text-[10px] text-emerald-800">
                                    Updated {tool.result?.updatedCount || 0} student attendance records
                                  </span>
                                  <button
                                    onClick={() => onNavigate('admin', undefined, 2)}
                                    className="px-2 py-1 bg-[#0E3589] hover:bg-[#092666] text-white rounded-md text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>View in Ledger</span>
                                    <ChevronRight className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <span className={`block text-[9px] mt-1.5 text-right opacity-60`}>
                        {msg.timestamp}
                      </span>
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-[#0E3589] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs p-3.5 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#0E3589] animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-[#0E3589] animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 rounded-full bg-[#0E3589] animate-bounce [animation-delay:0.4s]"></span>
                        <span className="text-xs text-slate-500 font-medium pl-1">Processing request...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Action Suggestion Buttons (Click of a button options) */}
              <div className="px-3.5 py-2 bg-white border-t border-slate-200">
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#F46E20]" />
                    Quick Actions
                  </span>
                  {!isAuthenticated && (
                    <button
                      onClick={() => openLoginModal()}
                      className="text-[10px] text-[#0E3589] font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <LogIn className="w-3 h-3" />
                      <span>Sign In</span>
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {(user?.role === 'admin' 
                    ? adminQuickPrompts 
                    : user?.role === 'student' 
                    ? studentQuickPrompts 
                    : guestQuickPrompts
                  ).map((btn, bIdx) => (
                    <button
                      key={bIdx}
                      type="button"
                      onClick={() => handleSendMessage(btn.prompt)}
                      disabled={isLoading}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${btn.color} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <btn.icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Bar */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={
                    user?.role === 'admin'
                      ? "e.g. Update attendance for Student 1,2,3 for today..."
                      : user?.role === 'student'
                      ? "e.g. Enroll student, book demo, or GPAY to coach..."
                      : "Ask anything, enroll, book demo, or GPAY fee..."
                  }
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-[#0E3589] focus:bg-white rounded-xl text-xs outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputPrompt.trim() || isLoading}
                  className={`p-2.5 bg-[#0E3589] hover:bg-[#092666] text-white rounded-xl transition-all shadow-md flex items-center justify-center shrink-0 cursor-pointer ${
                    !inputPrompt.trim() || isLoading ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Settings Modal */}
      <AIChatSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveConfig}
        currentConfig={aiConfig}
      />
    </>
  );
};
