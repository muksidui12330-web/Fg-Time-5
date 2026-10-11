import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  Leaf,
  RotateCcw,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface SproutAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STARTER_QUESTIONS = [
  'How do I create a Sprout post with music?',
  'Best indoor plants for beginner gardeners?',
  'How do group chats and follow-to-chat work?',
  'Suggest 5 creative hashtags for my plant photo',
];

export const SproutAiAssistantModal: React.FC<SproutAiAssistantModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello, welcome to FG TIME! 🌿 I am your Sprout Guide. I can help you discover app features (sprouts, clips, stories, group chats) or answer any houseplant, gardening, and eco-lifestyle questions. How can I help you blossom today?',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          userQuestion: text,
        }),
      });

      const data = await res.json();
      const modelMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply || 'FG TIME is thriving! Let me know if you need anything else. 🌿',
      };
      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      console.error('AI Chat Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `model-err-${Date.now()}`,
          role: 'model',
          text: 'Oops, my roots encountered a small glitch! Please try again in a moment. 🍃',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: 'Conversation refreshed! 🌿 Ask me anything about FG TIME features, plant care, or caption inspiration.',
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#12372A] rounded-3xl shadow-2xl border border-[#00C853]/30 overflow-hidden flex flex-col h-[600px] max-h-[90vh]">
        {/* Header */}
        <div className="p-4 px-5 bg-gradient-to-r from-[#12372A] via-[#1B5E20] to-[#00C853] text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center ring-2 ring-white/30">
              <Bot className="w-5 h-5 text-[#69F0AE]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm">Sprout Guide AI</h3>
                <span className="text-[10px] uppercase font-bold bg-[#00C853] px-2 py-0.2 rounded-full">
                  Assistant
                </span>
              </div>
              <p className="text-[11px] text-white/80">
                FG TIME Help & Botanical Knowledge
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Reset Chat"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat message stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-stone-50 dark:bg-[#101512]/60">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-[#00C853] text-white'
                    : 'bg-[#12372A] text-[#00C853] dark:bg-emerald-950 dark:text-[#69F0AE] ring-1 ring-[#00C853]/40'
                }`}
              >
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Leaf className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#00C853] text-white rounded-tr-none shadow-sm'
                    : 'bg-white dark:bg-[#12372A] text-stone-800 dark:text-stone-100 rounded-tl-none border border-stone-200 dark:border-emerald-800/80 shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-stone-400 text-xs py-2 px-3 bg-white dark:bg-[#12372A] rounded-2xl w-fit border border-stone-200 dark:border-emerald-800/60 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-[#00C853]" />
              <span>Sprout Guide is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick starter prompts */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 border-t border-stone-200 dark:border-emerald-900 bg-white dark:bg-[#12372A]">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-[#00C853]" />
              <span>Suggested Inquiries</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSendMessage(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-[#00C853] border border-[#00C853]/25 hover:bg-[#00C853] hover:text-white transition-all cursor-pointer text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white dark:bg-[#12372A] border-t border-stone-200 dark:border-emerald-800 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask Sprout Guide about FG TIME or plants..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-stone-100 dark:bg-[#101512] text-stone-800 dark:text-stone-100 placeholder-stone-400 border border-transparent focus:border-[#00C853] focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 rounded-2xl bg-[#00C853] hover:bg-[#00A344] text-white disabled:opacity-40 transition-transform active:scale-95 cursor-pointer shadow-md shadow-[#00C853]/20"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
