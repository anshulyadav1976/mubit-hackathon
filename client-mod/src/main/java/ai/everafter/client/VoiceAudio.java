package ai.everafter.client;

import javax.sound.sampled.*;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.concurrent.TimeUnit;

/** Bounded microphone capture and WAV playback; callers use a background thread. */
final class VoiceAudio {
    static final AudioFormat TARGET = new AudioFormat(16000, 16, 1, true, false);
    private volatile Clip playing;
    private volatile Process player;
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
        if (System.getProperty("os.name", "").toLowerCase(java.util.Locale.ROOT).contains("mac")) {
            playMac(wav, allowed); return;
        }
        try (AudioInputStream stream = AudioSystem.getAudioInputStream(new ByteArrayInputStream(wav))) {
            Clip clip = AudioSystem.getClip();
            try {
                clip.open(stream);
                synchronized (this) {
                    if (closed || !allowed.getAsBoolean()) return;
                    stopSpeech(); playing = clip; clip.start();
                }
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(45);
                // Java Sound starts asynchronously; isRunning can still be false just after start().
                while (!closed && allowed.getAsBoolean() && clip.getLongFramePosition() < clip.getFrameLength()
                        && System.nanoTime() < deadline) Thread.sleep(30);
            } finally { clip.stop(); clip.close(); synchronized (this) { if (playing == clip) playing = null; } }
        }
    }

    private void playMac(byte[] wav, java.util.function.BooleanSupplier allowed) throws Exception {
        // Use the system output route on macOS, including Bluetooth and the built-in speakers.
        try (AudioInputStream ignored = AudioSystem.getAudioInputStream(new ByteArrayInputStream(wav))) { }
        Path file = Files.createTempFile("everafter-voice-", ".wav", PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
        Process process = null;
        try {
            Files.write(file, wav);
            synchronized (this) {
                if (closed || !allowed.getAsBoolean()) return;
                stopSpeech();
                ProcessBuilder command = new ProcessBuilder("/usr/bin/afplay", file.toString());
                command.environment().remove("MUBIT_API_KEY"); command.environment().remove("OPENROUTER_API_KEY");
                command.redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD);
                process = command.start(); player = process;
            }
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(45);
            while (!closed && allowed.getAsBoolean() && process.isAlive() && System.nanoTime() < deadline) Thread.sleep(30);
            if (process.isAlive() && !closed && allowed.getAsBoolean()) throw new IllegalStateException("Speech playback timed out");
            if (!closed && allowed.getAsBoolean() && process.exitValue() != 0) throw new IllegalStateException("macOS could not play the NPC voice");
        } finally {
            if (process != null) process.destroy();
            synchronized (this) { if (player == process) player = null; }
            Files.deleteIfExists(file);
        }
    }

    synchronized void stopSpeech() {
        Clip clip = playing; if (clip != null) clip.stop();
        Process process = player; if (process != null) process.destroy();
    }
    void close() {
        closed = true; recording.set(false); stopSpeech();
        TargetDataLine line = microphone; if (line != null) { line.stop(); line.close(); }
    }
}
