import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Sparkles } from 'lucide-react';
import { User, StudentProfile } from '../types';
import { SmartPenAIAgentCore, ChatMessage } from './SmartPenAIAgentCore';

interface AIAgentChatWidgetProps {
  currentUser?: User | null;
  currentStudent?: StudentProfile | null;
  onNavigate?: (page: string, extraId?: string, defaultSection?: number) => void;
  onOpenDemoBooking?: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  hideFloatingTrigger?: boolean;
}

export const AIAgentChatWidget: React.FC<AIAgentChatWidgetProps> = ({
  currentUser,
  currentStudent,
  onNavigate,
  onOpenDemoBooking,
  messages,
  setMessages,
  isOpen: controlledIsOpen,
  onToggleOpen,
  hideFloatingTrigger = false,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if controlled from parent or internal
  const isWidgetOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const toggleOpen = onToggleOpen || (() => setInternalIsOpen(!internalIsOpen));

  const displayName = currentStudent?.name || currentUser?.firstName || currentUser?.name || 'Khwaish Sharma';

  return (
    <>
      {/* Floating Toggle Button (Explicitly Hidden on Home/Landing screen) */}
      {!isWidgetOpen && !hideFloatingTrigger && (
        <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,16px))] right-3 sm:right-6 z-30">
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleOpen}
            className="group relative flex items-center gap-2 sm:gap-3 px-3.5 py-2.5 sm:px-5 sm:py-3.5 bg-gradient-to-r from-[#124EBF] to-[#0E3589] text-white rounded-full shadow-xl hover:shadow-blue-900/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/30"
            id="btn-open-ai-chat"
            title="Open SmartPen AI Assistant"
          >
            <div className="relative">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F95F1E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-[#F95F1E] border-2 border-white"></span>
              </span>
            </div>
            
            <div className="text-left pr-0.5 sm:pr-1">
              <div className="text-[11px] sm:text-xs font-black tracking-wide uppercase flex items-center gap-1 sm:gap-1.5">
                <span>AI ASSISTANT</span>
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#F95F1E]" />
              </div>
              <p className="hidden sm:block text-[11px] text-blue-100/90 font-medium leading-none mt-0.5">
                SmartPen Academy
              </p>
            </div>
          </motion.button>
        </div>
      )}

      {/* Main Chat Dialog Popup */}
      <AnimatePresence>
        {isWidgetOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed z-50 bg-white rounded-3xl shadow-2xl border-2 border-blue-200 flex flex-col overflow-hidden transition-all duration-300 ${
              isExpanded
                ? 'inset-4 sm:inset-10 w-auto h-auto'
                : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[440px] md:w-[480px] h-[640px] max-h-[88vh]'
            }`}
            id="ai-agent-chat-modal"
          >
            <SmartPenAIAgentCore
              currentUser={currentUser}
              currentStudent={currentStudent}
              onNavigate={onNavigate}
              onOpenDemoModal={onOpenDemoBooking}
              messages={messages}
              setMessages={setMessages}
              isFloatingModal={true}
              onClose={toggleOpen}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded(!isExpanded)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
