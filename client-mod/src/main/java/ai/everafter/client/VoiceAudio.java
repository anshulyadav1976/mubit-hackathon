package ai.everafter.client;

import javax.sound.sampled.*;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;

/** Bounded microphone capture and WAV playback; callers use a background thread. */
final class VoiceAudio {
    static final AudioFormat TARGET = new AudioFormat(16000, 16, 1, true, false);
    private volatile Clip playing;
    private volatile TargetDataLine microphone;
    final AtomicBoolean recording = new AtomicBoolean();
    private volatile boolean closed;

    byte[] record() throws Exception {
        stopSpeech();
        AudioFormat source = null;
        for (AudioFormat candidate : new AudioFormat[] {TARGET,
                new AudioFormat(44100, 16, 1, true, false), new AudioFormat(48000, 16, 1, true, false),
                new AudioFormat(44100, 16, 2, true, false), new AudioFormat(48000, 16, 2, true, false)}) {
            if (AudioSystem.isLineSupported(new DataLine.Info(TargetDataLine.class, candidate))) { source = candidate; break; }
        }
        if (source == null) throw new LineUnavailableException("No supported microphone. Check macOS microphone permission for Minecraft/Prism.");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        TargetDataLine line = AudioSystem.getTargetDataLine(source);
        microphone = line;
        try {
            line.open(source, 8192);
            if (closed || !recording.get()) return new byte[0];
            line.start();
            int maximum = (int) (source.getFrameRate() * source.getFrameSize() * 15);
            byte[] buffer = new byte[4096];
            long deadline = System.nanoTime() + 15_000_000_000L;
            while (!closed && recording.get() && bytes.size() < maximum && System.nanoTime() < deadline) {
                int size = Math.min(buffer.length, maximum - bytes.size());
                size -= size % source.getFrameSize();
                int count = line.read(buffer, 0, size);
                if (count < 0) break;
                bytes.write(buffer, 0, count);
            }
        } finally {
            line.stop(); line.close(); microphone = null; recording.set(false);
        }
        return wave(bytes.toByteArray(), source);
    }

    static byte[] wave(byte[] pcm, AudioFormat source) throws Exception {
        if (pcm.length / source.getFrameSize() > source.getFrameRate() * 15) throw new IllegalArgumentException("Recording exceeded 15 seconds");
        try (AudioInputStream input = new AudioInputStream(new ByteArrayInputStream(pcm), source, pcm.length / source.getFrameSize());
             AudioInputStream converted = AudioSystem.getAudioInputStream(TARGET, input);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            // Java's resampler adds trailing padding; keep the recording within 15 seconds.
            byte[] normalized = converted.readNBytes(480000);
            try (AudioInputStream knownLength = new AudioInputStream(new ByteArrayInputStream(normalized), TARGET, normalized.length / 2)) {
                AudioSystem.write(knownLength, AudioFileFormat.Type.WAVE, output);
            }
            byte[] wav = output.toByteArray();
            if (wav.length > 480044) throw new IllegalArgumentException("Recording exceeded 15 seconds");
            return wav;
        }
    }

    void play(byte[] wav, java.util.function.BooleanSupplier allowed) throws Exception {
        if (closed || !allowed.getAsBoolean()) return;
        try (AudioInputStream stream = AudioSystem.getAudioInputStream(new ByteArrayInputStream(wav))) {
            Clip clip = AudioSystem.getClip();
            try {
                clip.open(stream);
                synchronized (this) {
                    if (closed || !allowed.getAsBoolean()) return;
                    stopSpeech(); playing = clip; clip.start();
                }
                while (!closed && allowed.getAsBoolean() && clip.isRunning()) Thread.sleep(30);
            } finally { clip.stop(); clip.close(); synchronized (this) { if (playing == clip) playing = null; } }
        }
    }

    synchronized void stopSpeech() { Clip clip = playing; if (clip != null) clip.stop(); }
    void close() {
        closed = true; recording.set(false); stopSpeech();
        TargetDataLine line = microphone; if (line != null) { line.stop(); line.close(); }
    }
}
