import React from 'react';
import { User, StudentProfile } from '../types';
import { SmartPenAIAgentCore, ChatMessage } from './SmartPenAIAgentCore';

interface HeroAgentPanelProps {
  onNavigate: (page: string, extraId?: string, defaultSection?: number) => void;
  currentUser?: User | null;
  currentStudent?: StudentProfile | null;
  onOpenDemoBooking?: () => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const HeroAgentPanel: React.FC<HeroAgentPanelProps> = ({ 
  onNavigate, 
  currentUser, 
  currentStudent,
  onOpenDemoBooking,
  messages,
  setMessages 
}) => {
  return (
    <div className="w-full" id="hero-ai-agent-panel">
      <SmartPenAIAgentCore
        currentUser={currentUser || null}
        currentStudent={currentStudent}
        onNavigate={onNavigate}
        onOpenDemoModal={onOpenDemoBooking}
        messages={messages}
        setMessages={setMessages}
        isFloatingModal={false}
      />
    </div>
  );
};
