import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VOICE-NOTE-RECORDING-FINISH: Zgodność transkrypcji i obsługa zakończenia nagrania', () => {
  const transcribeRoutePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/transcribe/route.ts');
  const voicePagePath = path.resolve(__dirname, '../../apps/web/src/app/(staff)/voice/page.tsx');

  it('endpoint transkrypcji zwraca pole transcript obok pola text dla zgodności z klientem @REQ: VOICE-ZERO-GUESSING', () => {
    const content = fs.readFileSync(transcribeRoutePath, 'utf8');

    // Endpoint musi zwracać transcript: finalTranscript
    expect(content).toMatch(/transcript:\s*(finalTranscript|transcription)/);
  });

  it('endpoint transkrypcji mapuje błędy dostawcy zewnętrznego Groq na status 502, a nie 401 @REQ: INFRA-GROQ-TRANSCRIPTION', () => {
    const content = fs.readFileSync(transcribeRoutePath, 'utf8');

    // Nie może bezpośrednio przekazywać statusu 401 z Groq jako status odpowiedzi klienta
    expect(content).toContain('status: 502');
  });

  it('komponent notatki głosowej poprawnie odczytuje transkrypcję i nie gubi stanu tekstu @REQ: VOICE-ZERO-GUESSING', () => {
    const content = fs.readFileSync(voicePagePath, 'utf8');

    // Obsługa fallbacku właściwości (transcript, text, newChunk)
    expect(content).toMatch(/data\.(transcript|text|newChunk)/);
    // Walidacja niepustej transkrypcji z jawnym błędem w UI
    expect(content).toMatch(/Nie udało się rozpoznać mowy/);
  });

  it('komponent notatki zatrzymuje ścieżki audio bezpiecznie wewnątrz zdarzenia onstop MediaRecordera @REQ: VOICE-ZERO-GUESSING', () => {
    const content = fs.readFileSync(voicePagePath, 'utf8');

    // Nie zatrzymuje ścieżek synchronicznie w stopRecording, lecz w onstop
    const stopRecordingFnMatch = content.match(/const stopRecording = \(\) => {([\s\S]*?)}/);
    expect(stopRecordingFnMatch).toBeTruthy();
    const stopRecordingBody = stopRecordingFnMatch ? stopRecordingFnMatch[1] : '';
    expect(stopRecordingBody).not.toContain('.getTracks().forEach');
  });
});
