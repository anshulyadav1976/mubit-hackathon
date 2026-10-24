package ai.everafter;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class DecisionTest {
    @Test void rejectsMalformedOrUnexpectedDirectorData() {
        for (String input : new String[]{"null", "[]", "garbage", "{}", "{\"route\":\"lava\"}"}) assertEquals("fallback", EverafterPlugin.Decision.parse(input).source());
    }
    @Test void boundsTrustedFieldsWithoutExecutingContent() {
        String json = "{\"dialogue\":\"" + "a".repeat(400) + "\",\"route\":\"combat\",\"mood\":\"wonder\",\"difficulty\":900,\"source\":\"mubit\",\"objective\":\"" + "b".repeat(300) + "\"}";
        var decision = EverafterPlugin.Decision.parse(json);
        assertEquals("combat", decision.route()); assertEquals(3, decision.difficulty()); assertEquals(320, decision.dialogue().length()); assertEquals(160, decision.objective().length()); assertEquals("mubit", decision.source());
    }
    @Test void stripsControlsAndLimitsChatInput() {
        assertEquals("hello world", EverafterPlugin.clean(" hello\nworld ", 1200));
        assertEquals("abc", EverafterPlugin.clean("abcdef", 3)); assertEquals("", EverafterPlugin.clean(null, 10));
    }
    @Test void failedAndMalformedResponsesKeepCurrentChapterAndRescueFacts() {
        var combat = new EverafterPlugin.Decision("Ready", "combat", "wonder", 3, "Rescue Elin", "mubit");
        var combatFallback = EverafterPlugin.Decision.fallback("adventure", combat);
        assertEquals("combat", combatFallback.route());
        assertEquals("wonder", combatFallback.mood());
        assertEquals(3, combatFallback.difficulty());
        assertTrue(combatFallback.dialogue().contains("Hollow Watchers"));
        assertFalse(combatFallback.dialogue().contains("echo-stones"));
        var rescued = EverafterPlugin.Decision.fallback("rescued", combat);
        assertTrue(rescued.dialogue().contains("Elin is free"));
        assertTrue(rescued.objective().contains("Return home"));
        var complete = EverafterPlugin.Decision.parse("malformed", "complete", combat);
        assertEquals("combat", complete.route());
        assertTrue(complete.dialogue().contains("safely home"));
        assertFalse(complete.objective().contains("rescue"));
    }
    @Test void drainedBrowserInputWaitsForOrdinaryChatInsteadOfBeingLost() {
        var queue = new java.util.ArrayDeque<EverafterPlugin.DialogueInput>();
        var browser = new EverafterPlugin.DialogueInput("Please choose puzzles", "Oren");
        queue.add(browser);
        assertNull(EverafterPlugin.nextInput(queue, true));
        assertEquals(1, queue.size());
        assertEquals(browser, EverafterPlugin.nextInput(queue, false));
        assertTrue(queue.isEmpty());
        assertNull(EverafterPlugin.nextInput(queue, false));
    }
    @Test void lateAdventureRepliesAreDiscardedAfterRescueOrHomecoming() {
        assertTrue(EverafterPlugin.canDeliver("adventure", "adventure"));
        assertFalse(EverafterPlugin.canDeliver("adventure", "rescued"));
        assertFalse(EverafterPlugin.canDeliver("adventure", "complete"));
        assertFalse(EverafterPlugin.canDeliver("rescued", "complete"));
    }
}
