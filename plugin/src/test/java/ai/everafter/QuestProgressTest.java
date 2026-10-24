package ai.everafter;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class QuestProgressTest {
    private EverafterPlugin.Quest quest(String trial) {
        return new EverafterPlugin.Quest(new EverafterPlugin.Chapter("ember_keep", trial, "broken_oath", "The Ember Oath", "Find the witness."));
    }
    private EverafterPlugin.Quest clearedTrial(String trial) {
        var q = quest(trial); q.meetGuide(); q.clueDiscovered = true; q.waveStarted = true;
        assertTrue(q.resolveTrial(trial, true, 0)); return q;
    }
    @Test void riddleGateRequiresTheActualClueAndCorrectAnswer() {
        var q = quest("riddle");
        assertFalse(q.resolveTrial("riddle", true, 0));
        q.meetGuide(); assertFalse(q.resolveTrial("riddle", true, 0));
        q.clueDiscovered = true; assertFalse(q.resolveTrial("riddle", false, 0));
        assertTrue(q.resolveTrial("riddle", true, 0));
        assertEquals("sentinel", q.stage); assertTrue(q.artifactClaimed);
        assertFalse(q.resolveTrial("riddle", true, 0), "A cleared gate cannot award the relic again");
    }
    @Test void aClaimThatGuardsDiedCannotSkipTheGauntlet() {
        var q = quest("gauntlet"); q.meetGuide(); q.clueDiscovered = true;
        assertFalse(q.resolveTrial("gauntlet", true, 0), "Wave must actually start");
        q.waveStarted = true; assertFalse(q.resolveTrial("gauntlet", true, 1));
        assertFalse(q.resolveTrial("riddle", true, 0), "Committed trial cannot be replaced");
        assertTrue(q.resolveTrial("gauntlet", false, 0));
    }
    @Test void peacefulTrialStillRequiresPhysicalWitnessEvidence() {
        var q = quest("parley"); q.meetGuide();
        assertFalse(q.resolveTrial("parley", false, 0));
        q.clueDiscovered = true; assertTrue(q.resolveTrial("parley", false, 0));
    }
    @Test void finalBargainNeedsTheRelicAndALivingSentinelsOath() {
        var q = clearedTrial("parley");
        assertFalse(q.spareBoss("Warden", true));
        assertFalse(q.spareBoss("Sentinel", false));
        assertTrue(q.spareBoss("Sentinel", true)); assertEquals("warden", q.stage);
        assertFalse(q.spareBoss("Warden", false));
        assertTrue(q.spareBoss("Warden", true)); assertEquals("rescue", q.stage);
        assertTrue(q.sentinelSpared); assertTrue(q.wardenSpared);
    }
    @Test void defeatedSentinelMakesFinalPeaceUnavailableAndActualFightNecessary() {
        var q = clearedTrial("gauntlet");
        assertFalse(q.defeatBoss("Sentinel", true), "An inactive boss cannot be killed by a model claim");
        assertTrue(q.startBoss("Sentinel"));
        assertFalse(q.defeatBoss("Sentinel", false));
        assertFalse(q.defeatBoss("Warden", true));
        assertTrue(q.defeatBoss("Sentinel", true));
        assertFalse(q.spareBoss("Warden", true), "A dead Sentinel cannot give a living oath");
        assertTrue(q.startBoss("Warden")); assertTrue(q.defeatBoss("Warden", true));
        assertEquals("rescue", q.stage); assertFalse(q.wardenSpared);
    }
    @Test void bossChallengesCannotResetAnActiveFightOrSkipASeal() {
        var q = quest("riddle"); assertFalse(q.startBoss("Sentinel")); assertFalse(q.startBoss("Warden"));
        q = clearedTrial("riddle"); assertTrue(q.startBoss("Sentinel")); assertFalse(q.startBoss("Sentinel")); assertFalse(q.startBoss("Warden"));
    }
    @Test void literalAnswersAndNegatedActionsDoNotBecomeFalseProgress() {
        assertTrue(EverafterPlugin.containsAnswer("I think the answer is fire!", "fire"));
        assertFalse(EverafterPlugin.containsAnswer("It is not fire", "fire"));
        assertFalse(EverafterPlugin.containsAnswer("A firefly", "fire"));
        assertTrue(EverafterPlugin.requestsAction("I challenge you", "none", "challenge"));
        assertFalse(EverafterPlugin.requestsAction("I don't want to fight you", "challenge", "challenge"));
        assertFalse(EverafterPlugin.requestsAction("I do not want peace", "bargain", "bargain"));
        assertFalse(EverafterPlugin.requestsAction("I already killed the Warden", "none", "challenge"));
    }
    @Test void committedHybridChapterAndModelSourceSurviveNewProposals() {
        var chapter = new EverafterPlugin.Chapter("thornwild", "parley", "willing_guardian", "A Living Promise", "Follow the living trail.");
        var committed = new EverafterPlugin.Decision("Ready", "hybrid", "wonder", 3, "Find Elin", "mubit", chapter, "none", "");
        String response = "{\"dialogue\":\"Show your proof\",\"route\":\"combat\",\"mood\":\"eerie\",\"difficulty\":1,\"source\":\"openrouter\",\"intent\":\"bargain\",\"answer\":\"\",\"chapter\":{\"realm\":\"ember_keep\",\"trial\":\"gauntlet\",\"twist\":\"false_trail\",\"title\":\"Another\",\"hook\":\"Another lead\"}}";
        var parsed = EverafterPlugin.Decision.parse(response, "adventure", committed);
        assertEquals(chapter, parsed.chapter()); assertEquals("hybrid", parsed.route()); assertEquals("wonder", parsed.mood()); assertEquals(3, parsed.difficulty());
        assertEquals("openrouter", parsed.source()); assertEquals("bargain", parsed.intent());
    }
    @Test void offeringPeaceDuringAnActiveSentinelFightUsesTheRealRelic() {
        var q = clearedTrial("riddle");
        assertTrue(q.startBoss("Sentinel"));
        assertTrue(EverafterPlugin.requestsAction("I offer peace and show the witness proof", "none", "bargain"));
        assertTrue(EverafterPlugin.requestsAction("I offer peace and show the witness relic", "bargain", "bargain"));
        assertFalse(q.spareBoss("Sentinel", false));
        assertEquals("Sentinel", q.activeBoss);
        assertTrue(q.spareBoss("Sentinel", true));
        assertEquals("warden", q.stage); assertEquals("", q.activeBoss); assertTrue(q.sentinelSpared);
    }
    @Test void firstFreedElinClickRescuesWhileSubsequentClicksCanOpenConversation() {
        var q = clearedTrial("parley");
        assertFalse(q.rescueClick("Elin", "adventure"), "Earlier seals still prevent rescue");
        q.spareBoss("Sentinel", true); q.spareBoss("Warden", true);
        assertTrue(q.rescueClick("Elin", "adventure"), "First Elin click takes the rescue-only path, before any microphone opening");
        assertFalse(q.rescueClick("Mara", "adventure"));
        assertFalse(q.rescueClick("Elin", "rescued"), "The next click is an ordinary conversation");
        assertFalse(q.rescueClick("Elin", "complete"));
    }
}
