import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Loader2, Globe, AlertCircle } from 'lucide-react';

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

export const SpeechInput: React.FC<SpeechInputProps> = ({
  onSendMessage,
  placeholder = 'Nói hoặc nhập tiếng Trung/Tiếng Việt...',
  defaultLang = 'auto',
  disabled = false,
  className = '',
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'zh-CN' | 'vi-VN'>(
    defaultLang === 'zh-CN' ? 'zh-CN' : 'vi-VN'
  );
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef(false);
  const baseTextRef = useRef('');

  // Real Microphone MediaRecorder state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordedAudioUrlRef = useRef<string | undefined>(undefined);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startMediaRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          mediaChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (mediaChunksRef.current.length > 0) {
          const blob = new Blob(mediaChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
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

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
    } catch (e) {
      console.warn('MediaRecorder error:', e);
    }
  };

  const stopMediaRecording = (): Promise<string | undefined> => {
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

      // 500ms safety timeout so sending message never hangs
      const timeout = setTimeout(() => {
        safeResolve(recordedAudioUrlRef.current);
      }, 500);

      mediaRecorder.onstop = () => {
        clearTimeout(timeout);
        if (mediaChunksRef.current.length > 0) {
          const blob = new Blob(mediaChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
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

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Keep microphone active continuously across pauses
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        const speechPart = (finalTranscript + ' ' + interimTranscript).trim();
        const prefix = baseTextRef.current.trim();
        const fullText = prefix ? (prefix + ' ' + speechPart) : speechPart;

        if (fullText) {
          setInputText(fullText);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          shouldKeepListeningRef.current = false;
          setIsListening(false);
          setMicError('Quyền truy cập Micro bị từ chối. Vui lòng cấp quyền Microphone trong trình duyệt.');
        } else if (event.error === 'network') {
          shouldKeepListeningRef.current = false;
          setIsListening(false);
          setMicError('Lỗi kết nối mạng dịch vụ giọng nói. Kiểm tra lại kết nối mạng.');
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          setMicError(`Lỗi nhận diện giọng nói: ${event.error}`);
        }
      };

      recognition.onend = () => {
        // Auto-restart if user hasn't explicitly stopped or submitted
        if (shouldKeepListeningRef.current) {
          try {
            recognition.start();
          } catch (e) {
            setIsListening(false);
            shouldKeepListeningRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;

      return () => {
        shouldKeepListeningRef.current = false;
        stopMediaRecording();
        try {
          recognition.abort();
        } catch (_) {}
      };
    } catch (e) {
      console.warn('Failed to initialize Speech Recognition:', e);
      setSpeechSupported(false);
    }
  }, [speechLang]);

  const toggleListening = () => {
    setMicError(null);
    if (!recognitionRef.current) return;

    if (isListening || shouldKeepListeningRef.current) {
      shouldKeepListeningRef.current = false;
      stopMediaRecording();
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Speech stop error:', e);
      }
      setIsListening(false);
    } else {
      shouldKeepListeningRef.current = true;
      startMediaRecording();
      try {
        recognitionRef.current.lang = speechLang;
        recognitionRef.current.start();
      } catch (err: any) {
        console.warn('Speech start error:', err);
        if (err?.name === 'InvalidStateError') {
          setIsListening(true);
        } else {
          shouldKeepListeningRef.current = false;
          setMicError('Không thể khởi động Micro. Vui lòng thử lại.');
        }
      }
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);
    baseTextRef.current = newText;

    if (recognitionRef.current) {
      const wasListening = isListening || shouldKeepListeningRef.current;
      try {
        recognitionRef.current.abort();
      } catch (_) {}

      if (wasListening) {
        shouldKeepListeningRef.current = true;
        setTimeout(() => {
          try {
            recognitionRef.current.lang = speechLang;
            recognitionRef.current.start();
          } catch (_) {}
        }, 150);
      }
    }
  };

  const handleClearText = () => {
    setInputText('');
    baseTextRef.current = '';
    recordedAudioUrlRef.current = undefined;
    setMicError(null);

    if (recognitionRef.current) {
      const wasListening = isListening || shouldKeepListeningRef.current;
      try {
        recognitionRef.current.abort(); // Aborts browser SpeechRecognition to clear internal results buffer
      } catch (_) {}

      // If mic was active, restart recognition cleanly with empty buffer
      if (wasListening) {
        shouldKeepListeningRef.current = true;
        setTimeout(() => {
          try {
            recognitionRef.current.lang = speechLang;
            recognitionRef.current.start();
          } catch (_) {}
        }, 150);
      }
    }
  };

  const handleLangChange = (newLang: 'zh-CN' | 'vi-VN') => {
    setMicError(null);
    shouldKeepListeningRef.current = false;
    baseTextRef.current = '';
    stopMediaRecording();
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      setIsListening(false);
    }
    setSpeechLang(newLang);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || disabled) return;

    const messageToSend = inputText.trim();

    shouldKeepListeningRef.current = false;
    const audioUrlToSend = await stopMediaRecording();

    setInputText('');
    baseTextRef.current = '';
    setMicError(null);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      setIsListening(false);
    }

    onSendMessage(messageToSend, audioUrlToSend);
    recordedAudioUrlRef.current = undefined;
  };

  return (
    <div className={`bg-white rounded-xl border border-[#E5E5E1] shadow-xs p-3.5 ${className}`}>
      {/* Speech Recognition Toolbar */}
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
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            Đang lắng nghe giọng nói...
          </span>
        )}

        {!speechSupported && (
          <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            Dùng Chrome/Edge để bật tính năng Micro
          </span>
        )}
      </div>

      {/* Mic Error Banner */}
      {micError && (
        <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{micError}</span>
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
            disabled={disabled}
            id="input-speech-text"
            className="w-full bg-[#FAF9F6] border border-[#E5E5E1] rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-[#2D2D2D] focus:outline-none focus:ring-1 focus:ring-black focus:bg-white resize-y max-h-48 min-h-[70px] overflow-y-auto transition-all placeholder:text-gray-400 disabled:opacity-60 font-sans"
          />

          {inputText && !disabled && (
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
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={disabled}
              id="btn-toggle-mic"
              title={isListening ? 'Tắt Mic' : 'Bật Mic để nói'}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs border shrink-0 disabled:opacity-40 ${
                isListening
                  ? 'bg-red-600 text-white border-red-600 animate-pulse'
                  : 'bg-[#F0EFED] text-[#2D2D2D] hover:bg-gray-200 border-[#E5E5E1]'
              }`}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5 text-red-600" />
              )}
            </button>
          )}

          <button
            type="submit"
            disabled={!inputText.trim() || disabled}
            id="btn-send-speech"
            className="w-11 h-11 rounded-xl bg-black hover:bg-gray-800 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 border border-black shrink-0"
          >
            {disabled ? (
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

