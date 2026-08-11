import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Volume2,
  RotateCcw,
  Send,
  Loader2,
  Award,
  Layers,
} from 'lucide-react';
import { HSKLevel, ConversationTopic, ConversationMessage, ConversationSession } from '../types';
import { SpeechInput } from './SpeechInput';
import { AudioPlayer } from './AudioPlayer';

interface ConversationViewProps {
  hskLevel: HSKLevel;
  onLevelChange: (level: HSKLevel) => void;
}

const TOPICS: ConversationTopic[] = [
  'Self Introduction',
  'Ordering Food',
  'Shopping',
  'University',
  'Travel',
  'Daily Life',
  'Hobbies',
  'Gaming',
  'Work',
  'Restaurant',
  'Asking Directions',
  'Free Conversation',
];

const LOCAL_STORAGE_KEY = 'ai_chinese_tutor_conversation_sessions';

const loadSavedSession = (topic: string, level: string): ConversationSession | null => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const key = `${topic}_${level}`;
    return store[key] || null;
  } catch (e) {
    console.warn('Failed to load saved session from localStorage:', e);
    return null;
  }
};

const saveSessionToStorage = (session: ConversationSession) => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    const key = `${session.topic}_${session.level}`;

    // Strip heavy audio Data URIs from messages saved in localStorage to keep payload < 50KB
    const cleanedMessages = (session.messages || []).slice(-25).map((m) => {
      if (m.audioUrl && m.audioUrl.startsWith('data:audio')) {
        const { audioUrl, ...rest } = m;
        return rest;
      }
      return m;
    });

    const sessionToSave = {
      ...session,
      messages: cleanedMessages,
    };

    store[key] = sessionToSave;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('LocalStorage quota reached, clearing old stored sessions:', e);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (_) {}
  }
};

const clearSessionFromStorage = (topic: string, level: string) => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const store = JSON.parse(raw);
    const key = `${topic}_${level}`;
    delete store[key];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('Failed to clear session from localStorage:', e);
  }
};

export const ConversationView: React.FC<ConversationViewProps> = ({
  hskLevel,
  onLevelChange,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<ConversationTopic>('Ordering Food');
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages]);

  // Save session to localStorage on update
  useEffect(() => {
    if (session && session.messages && session.messages.length > 0) {
      saveSessionToStorage(session);
    }
  }, [session]);

  const getApiKeyHeader = (): Record<string, string> => {
    const customKey = localStorage.getItem('user_gemini_api_key');
    return customKey && customKey.trim() ? { 'x-gemini-api-key': customKey.trim() } : {};
  };

  // Load session from localStorage or start a new session
  const startNewConversation = async (topic = selectedTopic, level = hskLevel) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiKeyHeader() },
        body: JSON.stringify({ level, topic }),
      });

      if (!response.ok) throw new Error('Failed to start conversation');

      const data: ConversationSession = await response.json();
      setSession(data);
      saveSessionToStorage(data);
    } catch (err: any) {
      console.error('Start conversation error:', err);
      setErrorMessage(err?.message || 'Error starting conversation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestartConversation = async () => {
    clearSessionFromStorage(selectedTopic, hskLevel);
    await startNewConversation(selectedTopic, hskLevel);
  };

  useEffect(() => {
    const saved = loadSavedSession(selectedTopic, hskLevel);
    if (saved && saved.messages && saved.messages.length > 0) {
      setSession(saved);
    } else {
      startNewConversation(selectedTopic, hskLevel);
    }
  }, [selectedTopic, hskLevel]);

  const handleSendMessage = async (text: string, recordedAudioUrl?: string) => {
    if (!session || !text.trim() || isSending) return;

    const trimmedText = text.trim();
    const optimisticUserMsg: ConversationMessage = {
      id: `msg_user_${Date.now()}`,
      sessionId: session.id,
      role: 'user',
      content: trimmedText,
      audioUrl: recordedAudioUrl,
      createdAt: new Date().toISOString(),
    };

    // Optimistically update session so user message displays immediately
    const optimisticSession: ConversationSession = {
      ...session,
      messages: [...session.messages, optimisticUserMsg],
      updatedAt: new Date().toISOString(),
    };
    setSession(optimisticSession);
    setIsSending(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiKeyHeader() },
        body: JSON.stringify({
          sessionId: session.id,
          userMessage: trimmedText,
          recordedAudioUrl,
          level: hskLevel,
          topic: selectedTopic,
        }),
      });

      if (!response.ok) throw new Error('Không thể xử lý tin nhắn');

      const data = await response.json();
      if (data.session) {
        setSession(data.session);
        saveSessionToStorage(data.session);
      }
    } catch (err: any) {
      console.error('Send message error:', err);
      setErrorMessage(err?.message || 'Lỗi gửi tin nhắn đến máy chủ AI.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Conversation Top Setup Controls */}
      <div className="bg-white rounded-2xl border border-[#E5E5E1] shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E5E5E1] pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold mb-1.5 border border-red-200">
              <Bot className="w-3.5 h-3.5" /> AI Chinese Tutor Mode
            </div>
            <h2 className="text-xl font-bold text-[#2D2D2D] tracking-tight">
              Luyện Nói Tiếng Trung Theo Chủ Đề (Conversation Practice)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              AI sẽ đóng vai người Trung Quốc, điều chỉnh từ vựng và ngữ pháp theo trình độ {hskLevel}. Lịch sử được tự động lưu.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRestartConversation}
              disabled={isLoading || isSending}
              id="btn-restart-conversation"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F0EFED] hover:bg-gray-200 text-[#2D2D2D] text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Bắt đầu cuộc trò chuyện mới
            </button>
          </div>
        </div>

        {/* Topics Selector */}
        <div>
          <label className="block text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
            Chọn Chủ Đề Trò Chuyện (Topic):
          </label>
          <div className="flex overflow-x-auto no-scrollbar gap-2 py-1 scroll-smooth">
            {TOPICS.map((topic) => (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic)}
                id={`btn-topic-${topic.replace(/\s+/g, '-').toLowerCase()}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedTopic === topic
                    ? 'bg-black text-white border-black shadow-xs'
                    : 'bg-[#FAF9F6] text-gray-700 border-[#E5E5E1] hover:bg-[#F0EFED]'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Conversation Messages Chat Stream */}
      <div className="bg-[#FAF9F6] rounded-2xl border border-[#E5E5E1] p-3 sm:p-6 min-h-[360px] max-h-[60vh] sm:max-h-[600px] overflow-y-auto space-y-4 sm:space-y-6">
        {isLoading && (
          <div className="text-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto" />
            <p className="text-sm font-semibold text-gray-600">
              Giao viên AI đang chuẩn bị câu mở đầu cho chủ đề "{selectedTopic}" ({hskLevel})...
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
            ⚠️ {errorMessage}
          </div>
        )}

        {session &&
          session.messages.map((msg, index) => {
            const isLatestAssistant =
              msg.role === 'assistant' && index === session.messages.length - 1;
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-3xl ${
                  msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs shadow-xs ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  {msg.role === 'user' ? 'ME' : 'AI'}
                </div>

                {/* Message Content Container */}
                <div className="space-y-2 flex-1">
                  <div
                    className={`rounded-2xl p-4 shadow-xs border ${
                      msg.role === 'user'
                        ? 'bg-[#FDFCF0] border-[#EBE8D0] text-[#2D2D2D] rounded-tr-none'
                        : 'bg-white border-[#E5E5E1] text-[#2D2D2D] rounded-tl-none'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {/* Chinese Spoken Sentence */}
                        <p className="text-xl font-medium font-chinese text-[#2D2D2D] tracking-wide">
                          {msg.content}
                        </p>
                        {/* Pinyin */}
                        {msg.pinyin && (
                          <p className="text-xs font-mono text-gray-400 mt-1">
                            {msg.pinyin}
                          </p>
                        )}
                        {/* Vietnamese Translation */}
                        {msg.translation && (
                          <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">
                            🇻🇳 {msg.translation}
                          </p>
                        )}
                      </div>

                      {/* Audio Player for Chinese */}
                      <AudioPlayer
                        text={msg.content}
                        compact
                        autoPlay={isLatestAssistant}
                        audioUrl={msg.role === 'user' ? msg.audioUrl : undefined}
                        label={msg.role === 'user' ? (msg.audioUrl ? 'Giọng của bạn' : 'Nghe đọc') : 'Nghe phát âm'}
                      />
                    </div>
                  </div>

                {/* AI Tutor Feedback Card for User Messages */}
                {msg.role === 'user' && msg.feedback && (
                  <div className="bg-white text-[#2D2D2D] rounded-xl p-3.5 text-xs space-y-2 border border-[#E5E5E1] shadow-xs">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-green-600 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-green-600" /> AI Speech Analysis
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            (msg.feedback.grammarStatus || 'Correct') === 'Correct'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          Grammar: {msg.feedback.grammarStatus || 'Correct'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0EFED] text-gray-700 border border-[#E5E5E1]">
                          Naturalness: {msg.feedback.naturalness || 'Very Natural'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-gray-600">
                      <p>
                        <span className="font-semibold text-gray-400">Vocabulary:</span>{' '}
                        {msg.feedback.vocabularyFeedback}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-400">Grammar:</span>{' '}
                        {msg.feedback.grammarFeedback}
                      </p>
                      {msg.feedback.suggestedImprovement ? (
                        <p className="text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          💡 <span className="font-semibold">Suggested Improvement:</span>{' '}
                          {msg.feedback.suggestedImprovement}
                        </p>
                      ) : (
                        <p className="text-green-700 font-semibold">
                          ✅ Your sentence is natural and grammatically correct!
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex gap-3 mr-auto max-w-xl">
            <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              AI
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#E5E5E1] shadow-xs flex items-center gap-2 text-xs font-medium text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
              AI Chinese Tutor is analyzing your answer and formulating response...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input controls for speaking or typing */}
      <SpeechInput
        onSendMessage={handleSendMessage}
        placeholder="Nhấp micro để nói tiếng Trung (hoặc gõ văn bản)..."
        defaultLang="zh-CN"
        disabled={isSending || isLoading}
      />
    </div>
  );
};
