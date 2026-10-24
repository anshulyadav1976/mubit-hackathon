package ai.everafter.client;

/** Only explicit world clicks advance a turn; asynchronous work carries its generation. */
final class ConversationState {
    enum Phase { IDLE, RECORDING, TRANSCRIBING, WAITING, CANCELLED }
    private volatile Phase phase = Phase.IDLE;
    private volatile String pending = "";
    private volatile long generation;

    Phase phase() { return phase; }
    String pending() { return pending; }
    long generation() { return generation; }
    boolean busy() { return phase != Phase.IDLE && phase != Phase.CANCELLED; }
    boolean current(long expected) { return phase != Phase.CANCELLED && generation == expected; }
    boolean start() {
        if (phase != Phase.IDLE) return false;
        generation++; phase = Phase.RECORDING; return true;
    }
    boolean stop() {
        if (phase != Phase.RECORDING) return false;
        phase = Phase.TRANSCRIBING; return true;
    }
    boolean send(String id) {
        if (phase != Phase.TRANSCRIBING || id.isBlank()) return false;
        pending = id; generation++; phase = Phase.WAITING; return true;
    }
    boolean acceptReply(String id) {
        if (phase != Phase.WAITING || id.isEmpty() || !pending.equals(id)) return false;
        pending = ""; generation++; phase = Phase.IDLE; return true;
    }
    boolean speechAllowed(long expected) {
        return EverafterClient.speechMatches(expected, generation, busy(), phase == Phase.CANCELLED);
    }
    void fail() { if (phase != Phase.CANCELLED) { generation++; pending = ""; phase = Phase.IDLE; } }
    void cancel() { generation++; pending = ""; phase = Phase.CANCELLED; }
}
