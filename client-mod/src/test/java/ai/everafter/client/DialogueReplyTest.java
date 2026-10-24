package ai.everafter.client;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class DialogueReplyTest {
    @Test void staleCharactersAndOutOfOrderRepliesCannotReplaceTheCurrentConversation() {
        assertFalse(EverafterClient.replyMatches("Oren", "request-b", "Mara", "request-b"));
        assertFalse(EverafterClient.replyMatches("Oren", "request-b", "Oren", "request-a"));
        assertFalse(EverafterClient.replyMatches("Oren", "request-b", "Oren", ""));
        assertTrue(EverafterClient.replyMatches("Oren", "request-b", "Oren", "request-b"));
        assertTrue(EverafterClient.replyMatches("Oren", "", "Oren", ""));
    }
    @Test void recordingOrSendingInvalidatesDelayedGreetingAudioPermanently() {
        long greeting = 1, afterRecording = 2, afterSend = 3;
        assertTrue(EverafterClient.speechMatches(greeting, greeting, false, false));
        assertFalse(EverafterClient.speechMatches(greeting, afterRecording, true, false));
        assertFalse(EverafterClient.speechMatches(greeting, afterRecording, false, false), "Old greeting must stay invalid after recording/transcription finishes");
        assertFalse(EverafterClient.speechMatches(afterRecording, afterSend, false, false));
        assertFalse(EverafterClient.speechMatches(afterSend, afterSend, true, false), "Capture, transcription and pending dialogue all block playback");
        assertFalse(EverafterClient.speechMatches(afterSend, afterSend, false, true));
        assertTrue(EverafterClient.speechMatches(afterSend, afterSend, false, false));
    }
}
