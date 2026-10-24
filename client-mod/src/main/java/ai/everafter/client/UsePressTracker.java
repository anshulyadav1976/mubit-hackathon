package ai.everafter.client;

/** A held use key grants one NPC opening, never repeated microphone toggles. */
final class UsePressTracker {
    private boolean down;
    private boolean physicalDown, queued;
    private int queuedTarget;
    private long queuedAt;
    private long press, consumed, at;
    private int target = -1;

    void observeInput(boolean pressed, int entityId, boolean allowed, long now) {
        if (allowed && pressed && !physicalDown) { queued = true; queuedTarget = entityId; queuedAt = now; }
        physicalDown = pressed;
        if (!allowed) { queued = false; consumed = press; }
    }

    boolean update(boolean pressed, int entityId, boolean allowed, long now) {
        boolean rising = allowed && pressed && !down;
        down = pressed;
        if (!allowed) { queued = false; consumed = press; if (!pressed) physicalDown = false; return false; }
        if (queued) {
            queued = false; press++; target = queuedTarget; at = queuedAt; return true;
        }
        if (rising) { press++; target = entityId; at = now; }
        return rising;
    }
    void consume() { consumed = press; }
    boolean hasOpening(int entityId, long now) {
        return press != consumed && target == entityId && now >= at && now - at <= 1500;
    }
    boolean acceptOpen(int entityId, long now) {
        if (!hasOpening(entityId, now)) return false;
        consumed = press; return true;
    }
}
