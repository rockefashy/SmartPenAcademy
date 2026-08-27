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

  const displayName = currentStudent?.name || (currentUser as any)?.fullName || currentUser?.name || 'Khwaish Sharma';

  return (
    <>
      {/* Floating Toggle Button (Explicitly Hidden on Home/Landing screen) */}
      {!isWidgetOpen && !hideFloatingTrigger && (
        <div className="fixed bottom-6 right-6 z-40">
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleOpen}
            className="group relative flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-[#124EBF] to-[#0E3589] text-white rounded-full shadow-2xl hover:shadow-blue-900/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/30"
            id="btn-open-ai-chat"
            title="Open SmartPen AI Assistant"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F95F1E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#F95F1E] border-2 border-white"></span>
              </span>
            </div>
            
            <div className="text-left pr-1">
              <div className="text-xs font-black tracking-wide uppercase flex items-center gap-1.5">
                <span>AI ASSISTANT</span>
                <Sparkles className="w-3 h-3 text-[#F95F1E]" />
              </div>
              <p className="text-[11px] text-blue-100/90 font-medium leading-none mt-0.5">
                {displayName}
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
