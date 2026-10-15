import React from 'react';
import { Mic, MicOff, Volume2, Sparkles } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';

interface VoiceControllerProps {
  onTranscriptReady: (text: string) => void;
}

export const VoiceController: React.FC<VoiceControllerProps> = ({ onTranscriptReady }) => {
  const { isSupported, isListening, transcript, isSpeaking, startListening, stopListening, speak } = useSpeech();

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
      if (transcript.trim()) {
        onTranscriptReady(transcript.trim());
      }
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <button
        type="button"
        onClick={handleToggleMic}
        className={`relative p-2.5 rounded-xl transition-all shadow-md flex items-center justify-center ${
          isListening
            ? 'bg-rose-600 text-white shadow-rose-500/30 scale-105 animate-pulse'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
        }`}
        title={isListening ? 'Stop voice recording' : 'Speak task in natural voice'}
      >
        {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        {isListening && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
          </span>
        )}
      </button>

      {isListening && (
        <div className="flex items-center space-x-2 bg-slate-900 border border-rose-500/40 px-3 py-1.5 rounded-xl text-xs text-rose-300 animate-fadeIn">
          <Sparkles className="h-3.5 w-3.5 animate-spin" />
          <span className="font-mono truncate max-w-xs">{transcript || 'Listening for your command...'}</span>
        </div>
      )}

      {isSpeaking && (
        <div className="flex items-center space-x-1.5 bg-blue-950 border border-blue-800 px-2.5 py-1 rounded-lg text-xs text-blue-300">
          <Volume2 className="h-3.5 w-3.5 animate-bounce" />
          <span>Speaking</span>
        </div>
      )}
    </div>
  );
};
