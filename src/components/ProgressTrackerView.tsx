import React from 'react';
import { BarChart2, Flame, Award, BookOpen, MessageSquare, CheckCircle2 } from 'lucide-react';
import { HSKLevel } from '../types';

interface ProgressTrackerViewProps {
  hskLevel: HSKLevel;
  savedWordsCount: number;
}

export const ProgressTrackerView: React.FC<ProgressTrackerViewProps> = ({
  hskLevel,
  savedWordsCount,
}) => {
  const hskWordTargets: Record<HSKLevel, number> = {
    'HSK 1': 150,
    'HSK 2': 300,
    'HSK 3': 600,
    'HSK 4': 1200,
    'HSK 5': 2500,
    'HSK 6': 5000,
  };

  const targetCount = hskWordTargets[hskLevel];
  const progressPercentage = Math.min(100, Math.round((savedWordsCount / targetCount) * 100));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#E5E5E1] shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-5 h-5 text-red-600" />
          <h2 className="text-xl font-bold text-[#2D2D2D]">Tiến Độ Học Tiếng Trung Cá Nhân (Progress Tracker)</h2>
        </div>
        <p className="text-xs text-gray-500">
          Theo dõi số lượng từ vựng, chuỗi ngày học liên tục và mức độ hoàn thành chỉ tiêu {hskLevel}.
        </p>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E5E5E1] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FAF9F6] border border-[#E5E5E1] text-[#2D2D2D] flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Từ Vựng Đã Học</p>
            <p className="text-2xl font-bold text-[#2D2D2D]">{savedWordsCount} từ</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E5E1] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FAF9F6] border border-[#E5E5E1] text-[#2D2D2D] flex items-center justify-center font-bold">
            <Flame className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chuỗi Học (Streak)</p>
            <p className="text-2xl font-bold text-[#2D2D2D]">3 ngày liên tục</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E5E1] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FAF9F6] border border-[#E5E5E1] text-[#2D2D2D] flex items-center justify-center font-bold">
            <Award className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mục Tiêu {hskLevel}</p>
            <p className="text-2xl font-bold text-[#2D2D2D]">{progressPercentage}%</p>
          </div>
        </div>
      </div>

      {/* HSK Level Progress Bar */}
      <div className="bg-white rounded-2xl border border-[#E5E5E1] p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#2D2D2D]">
            Tiến độ từ vựng mục tiêu {hskLevel} ({savedWordsCount} / {targetCount} từ)
          </span>
          <span className="text-xs font-mono font-bold text-red-600">{progressPercentage}%</span>
        </div>

        <div className="w-full h-2 bg-[#F0EFED] rounded-full overflow-hidden border border-[#E5E5E1]">
          <div
            className="h-full bg-black transition-all duration-500 rounded-full"
            style={{ width: `${Math.max(2, progressPercentage)}%` }}
          />
        </div>

        <p className="text-xs text-gray-400">
          Mỗi từ vựng được lưu từ dịch thuật hoặc hội thoại AI sẽ tính vào chỉ tiêu {hskLevel} của bạn.
        </p>
      </div>
    </div>
  );
};
