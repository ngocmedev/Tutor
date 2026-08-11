import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { CHINESE_AUDIO_SPEEDS } from '../config/voiceConfig';
import { TextToSpeechService } from '../services/textToSpeech';

interface AudioPlayerProps {
  text: string;
  audioUrl?: string;
  autoPlay?: boolean;
  className?: string;
  compact?: boolean;
  label?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  text,
  audioUrl,
  autoPlay = false,
  className = '',
  compact = false,
  label,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [providerTag, setProviderTag] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const stopTimer = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    progressTimerRef.current = window.setInterval(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
        if (audioRef.current.duration) {
          setDuration(audioRef.current.duration);
        }
      }
    }, 100);
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      TextToSpeechService.stop();
      setIsPlaying(false);
      stopTimer();
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    // 1. If audioUrl is provided directly (e.g. User's recorded microphone audio)
    if (audioUrl) {
      setProviderTag('Giọng của bạn');
      TextToSpeechService.playAudioSource(
        audioUrl,
        speed,
        () => {
          setIsLoading(false);
          setIsPlaying(true);
          startTimer();
        },
        () => {
          setIsPlaying(false);
          setIsLoading(false);
          stopTimer();
          setCurrentTime(0);
        },
        (err) => {
          setIsLoading(false);
          setIsPlaying(false);
          stopTimer();
          setErrorMessage(err);
        }
      );
      setDuration(Math.max(1, Math.round(text.length * 0.35)));
      return;
    }

    // 2. Call TTS service for AI voice
    const response = await TextToSpeechService.speak(
      { text, speed, useChineseVoice: true },
      () => {
        setIsLoading(false);
        setIsPlaying(true);
        startTimer();
      },
      () => {
        setIsPlaying(false);
        setIsLoading(false);
        stopTimer();
        setCurrentTime(0);
      },
      (err) => {
        setIsLoading(false);
        setIsPlaying(false);
        stopTimer();
        setErrorMessage(err);
      }
    );

    if (response.providerUsed) {
      setProviderTag(
        response.providerUsed === 'elevenlabs' ? 'AI Voice' : 'Browser Speech'
      );
    }

    if (response.audioUrl || response.audioBase64) {
      const src = response.audioUrl || response.audioBase64;
      if (src) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(src);
        audioRef.current = audio;
        audio.playbackRate = speed;
        audio.onloadedmetadata = () => {
          setDuration(audio.duration || 3);
        };
        audio.onended = () => {
          setIsPlaying(false);
          setIsLoading(false);
          stopTimer();
          setCurrentTime(0);
        };

        try {
          await audio.play();
          setIsPlaying(true);
          setIsLoading(false);
          startTimer();
        } catch (playErr: any) {
          console.error('Mobile audio play error:', playErr);
          setIsLoading(false);
          setIsPlaying(false);
        }
      }
    } else {
      // Browser TTS fallback length estimation (~ 0.3s per character)
      setDuration(Math.max(1, Math.round(text.length * 0.35)));
    }
  };

  const handleRepeat = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    handlePlayPause();
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  useEffect(() => {
    if (autoPlay) {
      handlePlayPause();
    }
    return () => {
      stopTimer();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      TextToSpeechService.stop();
    };
  }, []);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          id="btn-speak-compact"
          title="Listen to Chinese pronunciation"
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#F0EFED] text-[#2D2D2D] hover:bg-black hover:text-white transition-colors cursor-pointer border border-[#E5E5E1] shadow-xs active:scale-95"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5 text-red-600 fill-red-600" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-red-600" />
          )}
          <span>{isPlaying ? 'Pause' : label || 'Listen'}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`bg-[#2D2D2D] text-white rounded-xl p-3.5 shadow-xs border border-[#E5E5E1] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            disabled={isLoading}
            id="btn-audio-play-pause"
            className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={handleRepeat}
            id="btn-audio-repeat"
            title="Repeat audio"
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {label && (
            <span className="text-xs font-semibold text-gray-200 line-clamp-1 max-w-[180px]">
              {label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {providerTag && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-mono">
              {providerTag}
            </span>
          )}

          {/* Speed Selector */}
          <div className="flex items-center bg-gray-800 rounded-lg p-0.5 border border-gray-700">
            {CHINESE_AUDIO_SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                  speed === s
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-gray-200'
                } transition-all cursor-pointer`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Bar & Timer */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono text-gray-400 w-10 text-right">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600"
        />
        <span className="text-[11px] font-mono text-gray-400 w-10">
          {formatTime(duration)}
        </span>
      </div>

      {errorMessage && (
        <div className="mt-2 text-xs text-amber-300 bg-amber-900/30 border border-amber-700/50 rounded px-2.5 py-1">
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
};
