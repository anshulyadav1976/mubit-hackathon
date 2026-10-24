package ai.everafter.client;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ScreenlessConversationTest {
    @Test void aFastPressReleaseBetweenTicksStillStartsAndStopsExactlyOnce() {
        UsePressTracker clicks = new UsePressTracker();
        clicks.update(false, 42, true, 1000);
        clicks.observeInput(true, 42, true, 1010);
        clicks.observeInput(false, 42, true, 1020);
        assertTrue(clicks.update(false, 42, true, 1050));
        assertTrue(clicks.acceptOpen(42, 1060));
        assertFalse(clicks.update(false, 42, true, 1100));
        clicks.observeInput(true, -1, true, 1110);
        clicks.observeInput(false, -1, true, 1120);
        assertTrue(clicks.update(false, -1, true, 1150), "An empty-hand air tap must stop capture too");
        clicks.consume();
        assertFalse(clicks.update(false, -1, true, 1200));
        assertFalse(clicks.acceptOpen(42, 1200));
    }

    @Test void rawAndSampledHeldEdgesAreNotCountedTwice() {
        UsePressTracker clicks = new UsePressTracker();
        clicks.observeInput(true, 42, true, 1000);
        assertTrue(clicks.update(true, 42, true, 1010));
        assertTrue(clicks.acceptOpen(42, 1020));
        clicks.observeInput(true, 42, true, 1030);
        assertFalse(clicks.update(true, 42, true, 1050));
        assertFalse(clicks.acceptOpen(42, 1050));
    }

    @Test void focusResetWithoutARawReleaseDoesNotLoseTheNextFastTap() {
        UsePressTracker clicks = new UsePressTracker();
        clicks.observeInput(true, 42, true, 1000);
        clicks.update(false, 42, false, 1010);
        clicks.observeInput(true, 42, true, 1020);
        clicks.observeInput(false, 42, true, 1030);
        assertTrue(clicks.update(false, 42, true, 1050));
        assertTrue(clicks.acceptOpen(42, 1060));
    }

    @Test void heldUseGrantsExactlyOneOpeningAndStopPressCannotReopen() {
        UsePressTracker clicks = new UsePressTracker();
        assertTrue(clicks.update(true, 42, true, 1000));
        assertTrue(clicks.acceptOpen(42, 1010));
        for (int time = 1050; time < 18000; time += 50) {
            assertFalse(clicks.update(true, 42, true, time));
            assertFalse(clicks.acceptOpen(42, time));
            assertFalse(clicks.hasOpening(42, time), "Held use must not trigger another server greeting");
        }
        clicks.update(false, 42, true, 18000);
        assertTrue(clicks.update(true, 42, true, 18100));
        clicks.consume();
        assertFalse(clicks.acceptOpen(42, 18110), "The stop click must not restart listening");
    }

    @Test void focusOrScreenCancellationRequiresReleaseAndANewNpcClick() {
        UsePressTracker clicks = new UsePressTracker();
        clicks.update(true, 42, true, 1000);
        clicks.update(true, 42, false, 1010);
        assertFalse(clicks.update(true, 42, true, 1020));
        assertFalse(clicks.acceptOpen(42, 1020));
        clicks.update(false, 42, true, 1030);
        assertTrue(clicks.update(true, 43, true, 1040));
        assertFalse(clicks.acceptOpen(42, 1041));
        assertTrue(clicks.acceptOpen(43, 1042));
        clicks.update(false, 43, true, 1100);
        clicks.update(true, 43, true, 1200);
        assertFalse(clicks.acceptOpen(43, 2800), "Unsolicited or delayed opens cannot auto-listen");
    }

    @Test void oneCaptureAutomaticallySubmitsOnlyItsCorrelatedReply() {
        ConversationState state = new ConversationState();
        assertTrue(state.start());
        long capture = state.generation();
        assertFalse(state.start());
        assertFalse(state.acceptReply(""), "The initial scripted greeting must never interrupt capture");
        assertTrue(state.stop(), "Stop and the 15-second recorder completion share this transition");
        assertFalse(state.stop());
        assertTrue(state.current(capture));
        assertTrue(state.send("request-a"));
        assertFalse(state.send("request-b"));
        assertFalse(state.current(capture));
        assertFalse(state.acceptReply(""));
        assertFalse(state.acceptReply("request-b"));
        assertTrue(state.acceptReply("request-a"));
        assertTrue(state.speechAllowed(state.generation()));
    }

    @Test void everyCancellationInvalidatesMicrophoneTranscriptAndDelayedSpeech() {
        for (ConversationState.Phase phase : new ConversationState.Phase[] {ConversationState.Phase.RECORDING,
                ConversationState.Phase.TRANSCRIBING, ConversationState.Phase.WAITING, ConversationState.Phase.IDLE}) {
            ConversationState state = new ConversationState();
            state.start(); long captured = state.generation();
            if (phase != ConversationState.Phase.RECORDING) state.stop();
            if (phase == ConversationState.Phase.WAITING || phase == ConversationState.Phase.IDLE) state.send("request-a");
            if (phase == ConversationState.Phase.IDLE) state.acceptReply("request-a");
            long speech = state.generation();
            state.cancel();
            assertFalse(state.current(captured), phase.toString());
            assertFalse(state.speechAllowed(speech), phase.toString());
            assertFalse(state.start(), "Cancellation cannot resume without a new validated NPC opening");
            assertFalse(state.acceptReply("request-a"), phase.toString());
        }
    }
}
