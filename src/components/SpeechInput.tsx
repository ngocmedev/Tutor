import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Loader2, Globe, AlertCircle } from 'lucide-react';
import { TextToSpeechService } from '../services/textToSpeech';

interface SpeechInputProps {
  onSendMessage: (text: string, recordedAudioUrl?: string) => void;
  placeholder?: string;
  defaultLang?: 'zh-CN' | 'vi-VN' | 'auto';
  disabled?: boolean;
  className?: string;
}

// Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const getSupportedMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const candidateTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/wav',
  ];
  for (const t of candidateTypes) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch (_) {}
  }
  return '';
};

const isMediaDevicesSupported = (): boolean => {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia
  );
};

export const SpeechInput: React.FC<SpeechInputProps> = ({
  onSendMessage,
  placeholder = 'Nói hoặc nhập tiếng Trung/Tiếng Việt...',
  defaultLang = 'auto',
  disabled = false,
  className = '',
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechLang, setSpeechLang] = useState<'zh-CN' | 'vi-VN'>(
    defaultLang === 'zh-CN' ? 'zh-CN' : 'vi-VN'
  );
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef(false);
  const baseTextRef = useRef('');
  const timerIntervalRef = useRef<number | null>(null);

  // Microphone MediaRecorder state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordedAudioUrlRef = useRef<string | undefined>(undefined);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    setRecordingSeconds(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const getApiKeyHeader = (): Record<string, string> => {
    const customKey = localStorage.getItem('user_gemini_api_key');
    return customKey && customKey.trim() ? { 'x-gemini-api-key': customKey.trim() } : {};
  };

  const transcribeAudioWithAI = async (audioDataUrl: string): Promise<string> => {
    try {
      setIsTranscribing(true);
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiKeyHeader() },
        body: JSON.stringify({ audioUrl: audioDataUrl, language: speechLang }),
      });

      if (!res.ok) return '';
      const data = await res.json();
      if (data && data.text) {
        return data.text.trim();
      }
      return '';
    } catch (e) {
      console.warn('AI STT transcription error:', e);
      return '';
    } finally {
      setIsTranscribing(false);
    }
  };

  const startMediaRecording = async (): Promise<boolean> => {
    try {
      if (!isMediaDevicesSupported()) {
        setMicError(
          'Không thể kết nối Micro. Trên điện thoại, bạn cần mở trang web qua kết nối HTTPS (hoặc localhost/Vercel) để trình duyệt cấp quyền Micro.'
        );
        return false;
      }

      TextToSpeechService.stop(); // Stop AI voice output before opening mic

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];

      let mediaRecorder: MediaRecorder;
      const mimeType = getSupportedMimeType();

      try {
        mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch (eConstruct) {
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          mediaChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (mediaChunksRef.current.length > 0) {
          const type = mediaRecorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(mediaChunksRef.current, { type });
          const reader = new FileReader();
          reader.onloadend = () => {
            recordedAudioUrlRef.current = reader.result as string;
          };
          reader.readAsDataURL(blob);
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      try {
        mediaRecorder.start(100);
      } catch (_) {
        mediaRecorder.start();
      }

      mediaRecorderRef.current = mediaRecorder;
      startTimer();
      return true;
    } catch (e: any) {
      console.warn('MediaRecorder error:', e);
      stopTimer();
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setMicError('Quyền truy cập Micro bị từ chối. Vui lòng vào Cài đặt trình duyệt và bật quyền Microphone cho trang web.');
      } else {
        setMicError(`Lỗi truy cập Micro: ${e?.message || 'Không thể khởi động Micro'}`);
      }
      return false;
    }
  };

  const stopMediaRecording = (): Promise<string | undefined> => {
    stopTimer();
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(recordedAudioUrlRef.current);
        return;
      }

      let resolved = false;
      const safeResolve = (url?: string) => {
        if (!resolved) {
          resolved = true;
          resolve(url);
        }
      };

      const timeout = setTimeout(() => {
        safeResolve(recordedAudioUrlRef.current);
      }, 2500);

      mediaRecorder.onstop = () => {
        clearTimeout(timeout);
        if (mediaChunksRef.current.length > 0) {
          const type = mediaRecorder.mimeType || getSupportedMimeType() || 'audio/webm';
          const blob = new Blob(mediaChunksRef.current, { type });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            recordedAudioUrlRef.current = dataUrl;
            safeResolve(dataUrl);
          };
          reader.readAsDataURL(blob);
        } else {
          safeResolve(recordedAudioUrlRef.current);
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      try {
        mediaRecorder.stop();
      } catch (e) {
        clearTimeout(timeout);
        safeResolve(recordedAudioUrlRef.current);
      }
    });
  };

  // Synchronous SpeechRecognition start inside click event handler
  const startSpeechRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    setSpeechSupported(true);

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      const recognition = new SpeechRecognition();
      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      // On Android/iOS mobile, continuous=false works best for native speech engines
      recognition.continuous = !isMobile;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        let liveTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i] && event.results[i][0] && event.results[i][0].transcript) {
            liveTranscript += event.results[i][0].transcript;
          }
        }

        const trimmed = liveTranscript.trim();
        if (trimmed) {
          const prefix = baseTextRef.current.trim();
          const fullText = prefix ? `${prefix} ${trimmed}` : trimmed;
          setInputText(fullText);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition event warning:', event.error);
        if (event.error === 'not-allowed' && !mediaStreamRef.current) {
          setMicError('Vui lòng bật quyền Microphone trong trình duyệt.');
        }
      };

      recognition.onend = () => {
        if (shouldKeepListeningRef.current && isMobile && mediaStreamRef.current) {
          try {
            recognition.start();
          } catch (_) {}
        }
      };

      // Call start() synchronously inside click stack
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Failed to start Speech Recognition synchronously:', e);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }
  };

  const toggleListening = () => {
    setMicError(null);

    // If currently listening, stop recording
    if (isListening || shouldKeepListeningRef.current) {
      shouldKeepListeningRef.current = false;
      setIsListening(false);
      stopSpeechRecognition();

      stopMediaRecording().then(async (audioUrl) => {
        if (audioUrl && !inputText.trim()) {
          const transcribedText = await transcribeAudioWithAI(audioUrl);
          if (transcribedText) {
            setInputText(transcribedText);
            baseTextRef.current = transcribedText;
          }
        }
      });
      return;
    }

    // Turning ON Mic:
    shouldKeepListeningRef.current = true;
    setIsListening(true);

    // 1. Start SpeechRecognition SYNCHRONOUSLY within the click handler stack
    startSpeechRecognition();

    // 2. Start MediaRecorder async
    startMediaRecording().then((success) => {
      if (!success) {
        shouldKeepListeningRef.current = false;
        setIsListening(false);
        stopSpeechRecognition();
      }
    });
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);
    baseTextRef.current = newText;
  };

  const handleClearText = () => {
    setInputText('');
    baseTextRef.current = '';
    recordedAudioUrlRef.current = undefined;
    setMicError(null);
  };

  const handleLangChange = (newLang: 'zh-CN' | 'vi-VN') => {
    setMicError(null);
    setSpeechLang(newLang);

    if (isListening) {
      stopSpeechRecognition();
      setTimeout(() => {
        if (shouldKeepListeningRef.current) {
          startSpeechRecognition();
        }
      }, 100);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    shouldKeepListeningRef.current = false;
    setIsListening(false);
    stopSpeechRecognition();
    const audioUrlToSend = await stopMediaRecording();

    let messageToSend = inputText.trim();

    // If user recorded audio without live text appearing
    if (!messageToSend && audioUrlToSend) {
      const transcribed = await transcribeAudioWithAI(audioUrlToSend);
      if (transcribed) {
        messageToSend = transcribed;
      } else {
        messageToSend = speechLang === 'zh-CN' ? '语音消息' : 'Tin nhắn giọng nói';
      }
    }

    if (!messageToSend || disabled || isTranscribing) return;

    setInputText('');
    baseTextRef.current = '';
    setMicError(null);

    onSendMessage(messageToSend, audioUrlToSend);
    recordedAudioUrlRef.current = undefined;
  };

  return (
    <div className={`bg-white rounded-xl border border-[#E5E5E1] shadow-xs p-3.5 ${className}`}>
      {/* Speech Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-[#E5E5E1]">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400" />
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Ngôn ngữ Mic:</span>
          <div className="inline-flex rounded-lg bg-[#F0EFED] p-0.5 border border-[#E5E5E1]">
            <button
              type="button"
              onClick={() => handleLangChange('zh-CN')}
              id="btn-lang-chinese"
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                speechLang === 'zh-CN'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              🇨🇳 Tiếng Trung (中文)
            </button>
            <button
              type="button"
              onClick={() => handleLangChange('vi-VN')}
              id="btn-lang-vietnamese"
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                speechLang === 'vi-VN'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              🇻🇳 Tiếng Việt
            </button>
          </div>
        </div>

        {isListening && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 animate-pulse bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            Đang thu âm: {formatRecordingTime(recordingSeconds)}
          </span>
        )}

        {isTranscribing && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 animate-pulse bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            AI đang nhận diện chữ...
          </span>
        )}
      </div>

      {/* Mic Error Banner */}
      {micError && (
        <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span className="flex-1">{micError}</span>
          <button
            type="button"
            onClick={() => setMicError(null)}
            className="ml-auto text-[10px] underline font-bold text-amber-900 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <div className="relative flex-1">
          <textarea
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder}
            rows={3}
            disabled={disabled || isTranscribing}
            id="input-speech-text"
            className="w-full bg-[#FAF9F6] border border-[#E5E5E1] rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-[#2D2D2D] focus:outline-none focus:ring-1 focus:ring-black focus:bg-white resize-y max-h-48 min-h-[70px] overflow-y-auto transition-all placeholder:text-gray-400 disabled:opacity-60 font-sans"
          />

          {inputText && !disabled && !isTranscribing && (
            <button
              type="button"
              onClick={handleClearText}
              className="absolute top-2 right-2 text-xs text-gray-400 hover:text-black cursor-pointer font-medium hover:underline bg-white/80 px-1.5 py-0.5 rounded-md backdrop-blur-xs"
            >
              Xóa để nói lại
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled || isTranscribing}
            id="btn-toggle-mic"
            title={isListening ? 'Bấm để dừng thu âm' : 'Bật Mic để nói'}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs border shrink-0 disabled:opacity-40 ${
              isListening
                ? 'bg-red-600 text-white border-red-600 animate-pulse ring-2 ring-red-400'
                : 'bg-[#F0EFED] text-[#2D2D2D] hover:bg-gray-200 border-[#E5E5E1]'
            }`}
          >
            {isListening ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5 text-red-600" />
            )}
          </button>

          <button
            type="submit"
            disabled={(!inputText.trim() && !isListening) || disabled || isTranscribing}
            id="btn-send-speech"
            className="w-11 h-11 rounded-xl bg-black hover:bg-gray-800 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 border border-black shrink-0"
          >
            {disabled || isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
