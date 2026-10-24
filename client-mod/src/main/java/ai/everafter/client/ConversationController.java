package ai.everafter.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.network.chat.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/** Voice conversation in the world: no Screen, mouse capture changes, or movement controls. */
final class ConversationController {
    private static ExecutorService worker(String name) {
        return Executors.newSingleThreadExecutor(task -> { Thread thread = new Thread(task, name); thread.setDaemon(true); return thread; });
    }
    private static final ExecutorService CAPTURE = worker("Everafter-microphone");
    private static final ExecutorService SPEECH = worker("Everafter-speech");
    private static final ExecutorService CLOSE = worker("Everafter-audio-close");
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    final String npc;
    final int entityId;
    private final String token;
    private final VoiceAudio audio = new VoiceAudio();
    private final ConversationState state = new ConversationState();
    private Future<?> captureTask, speechTask;
    private String status = "";
    private String subtitle = "";
    private String source = "";
    private long recordingAt, pendingAt;

    ConversationController(String npc, int entityId, JsonObject open) {
        this.npc = npc; this.entityId = entityId;
        token = open.has("backendToken") && open.get("backendToken").getAsString().matches("[a-fA-F0-9]{64}")
                ? open.get("backendToken").getAsString() : "";
    }
    boolean busy() { return state.busy(); }
    boolean recording() { return state.phase() == ConversationState.Phase.RECORDING; }

    boolean inReach(Minecraft client) {
        if (!EverafterClient.inWorld(client) || client.level == null) return false;
        var entity = client.level.getEntity(entityId);
        return entity != null && entity.isAlive() && client.player.distanceToSqr(entity) <= 36;
    }

    void start() {
        if (token.isEmpty()) { problem("Voice unavailable. Use chat or /talk; right-click again after reconnecting."); return; }
        if (!state.start()) return;
        invalidateSpeech();
        long generation = state.generation();
        recordingAt = System.currentTimeMillis(); subtitle = "";
        audio.recording.set(true);
        status = "Listening — right-click to send; another character switches";
        captureTask = CAPTURE.submit(() -> {
            try {
                byte[] wav = audio.record();
                if (!state.current(generation)) return;
                if (wav.length < 3244) throw new IllegalArgumentException("Recording too short. Right-click the villager to try again.");
                ui(generation, () -> { state.stop(); status = "Transcribing on this computer…"; });
                byte[] response = request("/api/transcribe", "audio/wav", wav, 8192);
                if (!state.current(generation)) return;
                String text = JsonParser.parseString(new String(response, java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject().get("text").getAsString();
                if (text.isBlank() || text.length() > 1200) throw new IllegalArgumentException("No clear short speech heard. Try again or use /talk.");
                ui(generation, () -> send(text));
            } catch (Exception failure) {
                audio.recording.set(false);
                ui(generation, () -> problem("Voice unavailable: " + explanation(failure)));
            }
        });
    }

    void stop() {
        if (!state.stop()) return;
        audio.recording.set(false);
        status = "Finishing and transcribing…";
    }

    private void send(String message) {
        Minecraft client = Minecraft.getInstance();
        if (!inReach(client)) { cancel(); return; }
        if (!ClientPlayNetworking.canSend(EverafterClient.Say.TYPE)) { problem("Village connection unavailable. Rejoin or use /talk."); return; }
        String id = UUID.randomUUID().toString();
        if (!state.send(id)) return;
        invalidateSpeech();
        JsonObject request = new JsonObject();
        request.addProperty("version", 1); request.addProperty("entityId", entityId);
        request.addProperty("message", message); request.addProperty("requestId", id);
        ClientPlayNetworking.send(new EverafterClient.Say(request.toString()));
        pendingAt = System.currentTimeMillis();
        status = "Your words sent — " + npc + " is thinking…";
    }

    void receive(JsonObject data) {
        if (!data.has("npc") || !data.has("dialogue")) return;
        String id = data.has("requestId") ? data.get("requestId").getAsString() : "";
        if (!EverafterClient.replyMatches(npc, state.pending(), data.get("npc").getAsString(), id) || !state.acceptReply(id)) return;
        present(data, id);
    }

    void narrate(JsonObject data) {
        if (!state.busy() && data.has("dialogue")) present(data, "");
    }

    private void present(JsonObject data, String id) {
        subtitle = data.get("dialogue").getAsString();
        if (subtitle.length() > 320) subtitle = subtitle.substring(0, 320);
        source = data.has("source") ? data.get("source").getAsString() : "EVERAFTER";
        boolean error = data.has("error") && data.get("error").getAsBoolean();
        status = error ? "Use /talk or right-click to try again." : "Preparing voice… right-click to interrupt and speak";
        invalidateSpeech();
        long generation = state.generation();
        if (!error && !token.isEmpty() && !subtitle.isBlank()) {
            JsonObject speech = new JsonObject();
            speech.addProperty("text", subtitle); speech.addProperty("npc", npc); speech.addProperty("requestId", id);
            speechTask = SPEECH.submit(() -> {
                try {
                    byte[] wav = request("/api/speech", "application/json", speech.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8), 10_000_000);
                    ui(generation, () -> status = "Speaking… right-click to interrupt and speak");
                    audio.play(wav, () -> state.speechAllowed(generation));
                    ui(generation, () -> status = "Right-click this character to speak");
                } catch (Exception failure) {
                    ui(generation, () -> { if (state.speechAllowed(generation)) status = "Voice playback unavailable. Reply shown above; /talk still works."; });
                }
            });
        }
    }

    void tick() {
        if (state.phase() == ConversationState.Phase.WAITING && System.currentTimeMillis() - pendingAt > 60000)
            problem("The reply took too long. Right-click the villager or use /talk to try again.");
    }

    void render(Minecraft client, GuiGraphics graphics) {
        int width = Math.min(520, client.getWindow().getGuiScaledWidth() - 24);
        var lines = client.font.split(Component.literal(subtitle), width - 20);
        int count = subtitle.isEmpty() ? 0 : Math.min(6, lines.size());
        int height = 40 + count * 10;
        int left = (client.getWindow().getGuiScaledWidth() - width) / 2;
        int top = Math.max(8, client.getWindow().getGuiScaledHeight() - height - 86);
        graphics.fill(left, top, left + width, top + height, 0xCE13202B);
        graphics.fill(left, top, left + 2, top + height, recording() ? 0xFFFF6B6B : 0xFFEABC77);
        String heading = npc + (recording() ? "  ●  " + Math.min(15, (System.currentTimeMillis() - recordingAt) / 1000) + "s / 15s" : source.isEmpty() ? "" : "  /  " + source);
        graphics.drawString(client.font, heading, left + 10, top + 7, 0xFFFFD495, true);
        graphics.drawString(client.font, client.font.plainSubstrByWidth(status, width - 20), left + 10, top + 22, 0xFFBED3DD, false);
        for (int i = 0; i < count; i++) graphics.drawString(client.font, lines.get(i), left + 10, top + 37 + i * 10, 0xFFF1F5F8, false);
    }

    void problem(String message) {
        state.fail(); audio.recording.set(false);
        if (captureTask != null) captureTask.cancel(true);
        invalidateSpeech(); CLOSE.execute(audio::close); status = message;
        Minecraft client = Minecraft.getInstance();
        if (client.player != null) client.player.displayClientMessage(Component.literal("Everafter: " + message + " Typed chat and /talk remain available."), false);
    }
    void cancel() {
        state.cancel(); audio.recording.set(false);
        if (captureTask != null) captureTask.cancel(true);
        invalidateSpeech();
        CLOSE.execute(audio::close);
    }
    private void invalidateSpeech() {
        if (speechTask != null) speechTask.cancel(true);
        SPEECH.execute(audio::stopSpeech);
    }
    private void ui(long generation, Runnable action) {
        Minecraft.getInstance().execute(() -> { if (state.current(generation)) action.run(); });
    }
    private byte[] request(String path, String contentType, byte[] body, int maximum) throws Exception {
        if (token.isEmpty()) throw new IllegalStateException("Right-click the villager to reconnect voice");
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8765" + path))
                .timeout(Duration.ofSeconds(45)).header("Content-Type", contentType).header("X-Everafter-Token", token)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        HttpResponse<java.io.InputStream> response = HTTP.send(request, HttpResponse.BodyHandlers.ofInputStream());
        try (var stream = response.body()) {
            byte[] bytes = stream.readNBytes(maximum + 1);
            if (bytes.length > maximum) throw new IllegalArgumentException("Voice response exceeded its limit");
            if (response.statusCode() != 200) throw new IllegalStateException(response.statusCode() == 401 || response.statusCode() == 403
                    ? "Right-click the character again to refresh the voice connection" : response.statusCode() == 422
                    ? "No clear speech heard. Try again or use /talk." : "Local voice service returned " + response.statusCode());
            return bytes;
        }
    }
    private static String explanation(Exception error) {
        if (error instanceof javax.sound.sampled.LineUnavailableException || error instanceof SecurityException)
            return "Check Minecraft/Prism microphone permission in macOS Settings.";
        String message = error.getMessage();
        return message == null || message.length() > 180 ? error.getClass().getSimpleName() : message;
    }
}
