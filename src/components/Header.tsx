import React from 'react';
import { Sparkles, MessageSquare, Languages, Mic, Volume2, BookOpen, BarChart2 } from 'lucide-react';
import { HSKLevel } from '../types';

export type AppMode = 'translator' | 'conversation' | 'shadowing' | 'tones' | 'flashcards' | 'progress';

interface HeaderProps {
  activeMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  hskLevel: HSKLevel;
  onLevelChange: (level: HSKLevel) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  onSelectMode,
  hskLevel,
  onLevelChange,
}) => {
  const levels: HSKLevel[] = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];

  const [apiKey, setApiKey] = React.useState<string>(() => {
    return localStorage.getItem('user_gemini_api_key') || '';
  });
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [inputKey, setInputKey] = React.useState(apiKey);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  const handleSaveKey = () => {
    const trimmed = inputKey.trim();
    if (trimmed) {
      localStorage.setItem('user_gemini_api_key', trimmed);
      setApiKey(trimmed);
    } else {
      localStorage.removeItem('user_gemini_api_key');
      setApiKey('');
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsModalOpen(false);
    }, 800);
  };

  const handleClearKey = () => {
    localStorage.removeItem('user_gemini_api_key');
    setApiKey('');
    setInputKey('');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsModalOpen(false);
    }, 800);
  };

  return (
    <header className="bg-white border-b border-[#E5E5E1] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow-sm shrink-0">
              中
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-bold text-[#2D2D2D] tracking-tight leading-none">
                  AI Chinese Tutor
                </h1>
                <span className="hidden sm:inline-block bg-[#F0EFED] text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-[#E5E5E1]">
                  Speaking v3.0
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate max-w-[140px] sm:max-w-none">
                Speaking & Conversation Coach
              </p>
            </div>
          </div>

          {/* HSK Level Picker & API Key Settings */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={() => {
                setInputKey(apiKey);
                setIsModalOpen(true);
              }}
              id="btn-open-api-key-modal"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold border transition-all cursor-pointer ${
                apiKey
                  ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                  : 'bg-[#FAF9F6] text-gray-600 border-[#E5E5E1] hover:bg-[#F0EFED]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
              <span>{apiKey ? '🔑 Key' : '⚙️ API Key'}</span>
            </button>

            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:inline">
                Target Level:
              </span>
              <select
                value={hskLevel}
                onChange={(e) => onLevelChange(e.target.value as HSKLevel)}
                id="select-hsk-level"
                className="bg-[#FAF9F6] border border-[#E5E5E1] text-[#2D2D2D] text-[11px] sm:text-xs font-bold rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-red-600 focus:border-red-600 cursor-pointer"
              >
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Gemini API Key Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-[#E5E5E1] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-[#2D2D2D] flex items-center gap-2">
                  🔑 Gemini API Key Cá Nhân
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Nhập Gemini API Key của riêng bạn để sử dụng tốc độ phản hồi tối đa và không lo bị chạm giới hạn Rate Limit của trang web.
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  API Key của bạn (Google AI Studio)
                </label>
                <input
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Dán mã Key tại đây (dạng: AIzaSy...)"
                  className="w-full bg-[#FAF9F6] border border-[#E5E5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#2D2D2D] focus:ring-1 focus:ring-red-600 focus:border-red-600 outline-none"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-800 leading-relaxed">
                💡 <strong>Chưa có API Key?</strong> Bạn có thể lấy Key miễn phí trong 30 giây tại{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-bold text-blue-900"
                >
                  Google AI Studio
                </a>.
              </div>

              {savedSuccess && (
                <div className="text-center text-xs font-bold text-green-600 bg-green-50 p-2 rounded-lg border border-green-200">
                  ✓ Đã lưu cài đặt API Key thành công!
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                {apiKey && (
                  <button
                    onClick={handleClearKey}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Dùng Key mặc định
                  </button>
                )}
                <button
                  onClick={handleSaveKey}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-xs transition-colors"
                >
                  Lưu Key
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Primary Mode Navigation Bar */}
        <nav className="flex items-center space-x-1.5 overflow-x-auto py-2.5 scrollbar-none border-t border-[#E5E5E1]">
          <button
            onClick={() => onSelectMode('translator')}
            id="nav-tab-translator"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${activeMode === 'translator'
                ? 'bg-[#2D2D2D] text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-[#F0EFED]'
              }`}
          >
            <Languages className="w-4 h-4" />
            <span>Smart Translator</span>
          </button>

          <button
            onClick={() => onSelectMode('conversation')}
            id="nav-tab-conversation"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${activeMode === 'conversation'
                ? 'bg-[#2D2D2D] text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-[#F0EFED]'
              }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Conversation</span>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          </button>

          <button
            onClick={() => onSelectMode('tones')}
            id="nav-tab-tones"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${activeMode === 'tones'
                ? 'bg-[#2D2D2D] text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-[#F0EFED]'
              }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Tone Master</span>
          </button>


          <button
            onClick={() => onSelectMode('progress')}
            id="nav-tab-progress"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${activeMode === 'progress'
                ? 'bg-[#2D2D2D] text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-[#F0EFED]'
              }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>My Progress</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
