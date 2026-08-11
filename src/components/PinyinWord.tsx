import React from 'react';
import { Volume2 } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';

interface PinyinWordProps {
  chinese: string;
  pinyin: string;
  translation?: string;
  hskLevel?: string;
  size?: 'sm' | 'md' | 'lg';
  showSpeaker?: boolean;
  className?: string;
}

/**
 * Detect tone number from pinyin string for visual color accents
 */
export function getToneClass(pinyin: string): string {
  if (/[āēīōūǖĀĒĪŌŪǕ]/.test(pinyin)) return 'text-rose-600 bg-rose-50/80 border-rose-200';
  if (/[áéíóúǘÁÉÍÓÚǗ]/.test(pinyin)) return 'text-amber-600 bg-amber-50/80 border-amber-200';
  if (/[ǎěǐǒǔǚǍĚǏǑǓǙ]/.test(pinyin)) return 'text-emerald-600 bg-emerald-50/80 border-emerald-200';
  if (/[àèìòùǜÀÈÌÒÙǛ]/.test(pinyin)) return 'text-indigo-600 bg-indigo-50/80 border-indigo-200';
  return 'text-slate-600 bg-slate-50 border-slate-200';
}

export const PinyinWord: React.FC<PinyinWordProps> = ({
  chinese,
  pinyin,
  translation,
  hskLevel,
  size = 'md',
  showSpeaker = true,
  className = '',
}) => {
  const toneClass = getToneClass(pinyin);

  const sizeStyles = {
    sm: {
      chinese: 'text-base font-semibold',
      pinyin: 'text-xs',
      translation: 'text-xs',
      padding: 'p-1.5',
    },
    md: {
      chinese: 'text-xl font-bold tracking-wide',
      pinyin: 'text-sm font-medium',
      translation: 'text-xs text-slate-500',
      padding: 'p-2.5',
    },
    lg: {
      chinese: 'text-3xl font-extrabold tracking-wider',
      pinyin: 'text-base font-semibold',
      translation: 'text-sm text-slate-600 font-medium',
      padding: 'p-4',
    },
  }[size];

  return (
    <div
      className={`inline-flex flex-col items-center justify-between bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all ${sizeStyles.padding} ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`font-chinese text-slate-900 ${sizeStyles.chinese}`}>
          {chinese}
        </span>
        {showSpeaker && (
          <AudioPlayer text={chinese} compact label="" />
        )}
      </div>

      <span
        className={`mt-1 px-2 py-0.5 rounded-md border font-sans text-center ${toneClass} ${sizeStyles.pinyin}`}
      >
        {pinyin}
      </span>

      {translation && (
        <span className={`mt-1 text-center font-sans ${sizeStyles.translation}`}>
          {translation}
        </span>
      )}

      {hskLevel && (
        <span className="mt-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
          {hskLevel}
        </span>
      )}
    </div>
  );
};
