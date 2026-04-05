// Uses Web Speech API for real-time transcription (no API key needed)

export function startTranscription(
  onTranscript: (text: string, isFinal: boolean) => void
): (() => void) | null {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    console.warn("Speech recognition not supported");
    return null;
  }

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let manuallyStopped = false;
  let lastInterim = "";

  console.log("[Speech] Initializing recognition...");

  recognition.onstart = () => {
    console.log("[Speech] Microphone connected and listening started.");
  };

  recognition.onresult = (event: any) => {
    let interim = "";
    let final = "";

    console.log(`[Speech] onresult payload count: ${event.results.length - event.resultIndex}`);

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      const isFinal = event.results[i].isFinal;
      console.log(`[Speech] result[${i}] (isFinal: ${isFinal}): "${t}"`);
      
      if (isFinal) {
        final += t;
      } else {
        interim += t;
      }
    }

    lastInterim = interim;

    if (final) onTranscript(final, true);
    if (interim) onTranscript(interim, false);
  };

  recognition.onend = () => {
    console.log("[Speech] recognition ended implicitly or via stop().");
    if (lastInterim) {
      onTranscript(lastInterim, true);
      lastInterim = "";
    }
    if (!manuallyStopped) {
      console.log("[Speech] Restarting listener automatically...");
      setTimeout(() => {
        if (!manuallyStopped) {
          try {
            recognition.start();
          } catch (e) {
            console.error("[Speech] Auto-restart failed:", e);
          }
        }
      }, 10);
    } else {
      console.log("[Speech] Fully stopped as per user request.");
    }
  };

  recognition.onerror = (e: any) => {
    console.error("[Speech] ERROR encountered:", e.error);
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      console.warn("[Speech] Microphone access denied or no service available.");
      manuallyStopped = true;
    }
  };

  try {
    recognition.start();
  } catch(e) {
    console.error("[Speech] Initial start failed:", e);
  }

  return () => {
    manuallyStopped = true;
    if (lastInterim) {
      onTranscript(lastInterim, true);
      lastInterim = "";
    }
    try {
      recognition.stop();
    } catch(e) {}
  };
}

export function startMicRecording(): {
  getBase64Chunk: () => Promise<string>;
  stop: () => void;
} | null {
  return null; // placeholder — real mic data captured via SpeechRecognition above
}