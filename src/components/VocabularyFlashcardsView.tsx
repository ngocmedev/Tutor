import React, { useState } from 'react';
import { BookOpen, Volume2, RotateCw, CheckCircle2, BookmarkCheck, Trash2 } from 'lucide-react';
import { VocabularyWord } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { PinyinWord } from './PinyinWord';

interface VocabularyFlashcardsViewProps {
  savedWords: VocabularyWord[];
  onRemoveWord: (wordText: string) => void;
}

export const VocabularyFlashcardsView: React.FC<VocabularyFlashcardsViewProps> = ({
  savedWords,
  onRemoveWord,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!savedWords || savedWords.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E5E1] shadow-xs p-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#FAF9F6] border border-[#E5E5E1] text-[#2D2D2D] flex items-center justify-center mx-auto text-2xl font-bold">
          📚
        </div>
        <h3 className="text-xl font-bold text-[#2D2D2D]">Chưa Có Từ Vựng Nào Được Lưu</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          Hãy quay lại tab <b>Smart Translator</b> hoặc <b>AI Conversation</b> và nhấn nút "+ Lưu từ vựng" để tích lũy bộ từ vựng cá nhân của bạn!
        </p>
      </div>
    );
  }

  const currentWord = savedWords[currentIndex % savedWords.length];

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E5E5E1] p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-bold text-[#2D2D2D]">
            Sổ Từ Vựng Flashcards ({savedWords.length} từ)
          </h2>
        </div>
        <span className="text-xs font-mono font-bold text-gray-400">
          Thẻ {currentIndex + 1} / {savedWords.length}
        </span>
      </div>

      {/* Interactive Flip Flashcard Container */}
      <div className="max-w-md mx-auto perspective-1000">
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          id="flashcard-flip-container"
          className="bg-white rounded-3xl border border-[#E5E5E1] shadow-xs p-8 min-h-[280px] flex flex-col justify-between items-center text-center cursor-pointer transition-all duration-300 hover:border-black select-none"
        >
          <div className="w-full flex justify-between items-center">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F0EFED] text-gray-700 font-bold border border-[#E5E5E1]">
              {currentWord.hskLevel || 'Vocabulary'}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1 font-semibold">
              <RotateCw className="w-3.5 h-3.5" /> Nhấn để lật thẻ
            </span>
          </div>

          {!isFlipped ? (
            /* Front of Flashcard (Chinese + Audio) */
            <div className="py-6 space-y-3">
              <h3 className="text-5xl font-medium font-chinese text-[#2D2D2D] tracking-wide">
                {currentWord.word}
              </h3>
              <p className="text-base font-mono text-gray-500">
                {currentWord.pinyin}
              </p>
            </div>
          ) : (
            /* Back of Flashcard (Vietnamese Translation + Meaning) */
            <div className="py-6 space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Nghĩa Tiếng Việt
              </span>
              <h4 className="text-2xl font-bold text-[#2D2D2D]">
                {currentWord.translation}
              </h4>
            </div>
          )}

          <div onClick={(e) => e.stopPropagation()} className="w-full pt-2">
            <AudioPlayer text={currentWord.word} label={`Nghe: ${currentWord.word}`} />
          </div>
        </div>

        {/* Card Navigation & Action Buttons */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => {
              setIsFlipped(false);
              setCurrentIndex((prev) => (prev > 0 ? prev - 1 : savedWords.length - 1));
            }}
            id="btn-prev-flashcard"
            className="px-4 py-2 rounded-xl bg-[#F0EFED] hover:bg-gray-200 text-[#2D2D2D] text-xs font-bold transition-all cursor-pointer"
          >
            ← Thẻ trước
          </button>

          <button
            onClick={() => onRemoveWord(currentWord.word)}
            id="btn-remove-flashcard"
            title="Xóa từ khỏi sổ tay"
            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all cursor-pointer border border-red-200"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setIsFlipped(false);
              setCurrentIndex((prev) => (prev + 1) % savedWords.length);
            }}
            id="btn-next-flashcard"
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Thẻ tiếp theo →
          </button>
        </div>
      </div>

      {/* Grid List of All Saved Words */}
      <div className="bg-white rounded-2xl border border-[#E5E5E1] p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Danh Sách Tất Cả Từ Vựng Đã Lưu</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {savedWords.map((word, idx) => (
            <div
              key={idx}
              className="bg-[#FAF9F6] rounded-xl p-3 border border-[#E5E5E1] flex flex-col justify-between"
            >
              <PinyinWord
                chinese={word.word}
                pinyin={word.pinyin}
                translation={word.translation}
                hskLevel={word.hskLevel}
                size="sm"
              />
              <button
                onClick={() => onRemoveWord(word.word)}
                className="mt-2 text-[11px] text-red-600 hover:text-red-800 font-semibold text-center cursor-pointer"
              >
                Xóa
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
