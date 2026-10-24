package ai.everafter.client;

import org.junit.jupiter.api.Test;
import javax.sound.sampled.*;
import java.io.ByteArrayInputStream;
import static org.junit.jupiter.api.Assertions.*;

class VoiceAudioTest {
    @Test void recordsTheExactLocalWhisperWaveFormat() throws Exception {
        byte[] wav = VoiceAudio.wave(new byte[3200], VoiceAudio.TARGET);
        assertEquals(3244, wav.length);
        try (AudioInputStream stream = AudioSystem.getAudioInputStream(new ByteArrayInputStream(wav))) {
            assertEquals(16000, stream.getFormat().getSampleRate());
            assertEquals(1, stream.getFormat().getChannels());
            assertEquals(16, stream.getFormat().getSampleSizeInBits());
            assertFalse(stream.getFormat().isBigEndian());
        }
    }
    @Test void convertsNativeStereoCaptureToMono16kAndBoundsDuration() throws Exception {
        AudioFormat nativeFormat = new AudioFormat(48000, 16, 2, true, false);
        byte[] wav = VoiceAudio.wave(new byte[4800 * 4], nativeFormat);
        try (AudioInputStream stream = AudioSystem.getAudioInputStream(new ByteArrayInputStream(wav))) {
            assertEquals(16000, stream.getFormat().getSampleRate());
            assertEquals(1, stream.getFormat().getChannels());
        }
        assertTrue(VoiceAudio.wave(new byte[48000 * 4 * 15], nativeFormat).length <= 480044);
        assertThrows(IllegalArgumentException.class, () -> VoiceAudio.wave(new byte[32000 * 16], VoiceAudio.TARGET));
    }
    @Test void invalidatedSpeechNeverOpensAnAudioDeviceOrParsesStaleAudio() {
        VoiceAudio audio = new VoiceAudio();
        assertDoesNotThrow(() -> audio.play(new byte[]{1, 2, 3}, () -> false));
        audio.close();
        assertDoesNotThrow(() -> audio.play(new byte[]{1, 2, 3}, () -> true));
    }
}
