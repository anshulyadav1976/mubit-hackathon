package ai.everafter.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.util.FormattedCharSequence;
import org.lwjgl.glfw.GLFW;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class DialogueScreen extends Screen {
    private static final ExecutorService WORKERS = Executors.newFixedThreadPool(3, task -> {
        Thread thread = new Thread(task, "Everafter-voice"); thread.setDaemon(true); return thread;
    });
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final String npc;
    private final int entityId;
    private final String token;
    private final VoiceAudio audio = new VoiceAudio();
    private EditBox input;
    private Button recordButton, sendButton;
    private volatile String reply = "Tell me what kind of story you want to live. Type below, or record your voice.";
    private String status = "Ready — type a reply or record up to 15 seconds.";
    private String source = "EVERAFTER";
    private volatile String pending = "";
    private volatile long speechGeneration;
    private long pendingAt;
    private volatile boolean transcribing;
    private volatile boolean capturing;
    private volatile boolean closed;
    private int scroll;
    private int left, panelWidth, replyTop, replyBottom;

    DialogueScreen(String npc, int entityId, JsonObject open) {
        super(Component.literal("A conversation with " + npc));
        this.npc = npc;
        this.entityId = entityId;
        this.token = open.has("backendToken") && open.get("backendToken").getAsString().matches("[a-fA-F0-9]{64}")
                ? open.get("backendToken").getAsString() : "";
        if (token.isEmpty()) status = "Voice unavailable. You can still type and send your reply.";
        if (open.has("dialogue")) reply = open.get("dialogue").getAsString();
    }

    @Override protected void init() {
        String previous = input == null ? "" : input.getValue();
        panelWidth = Math.min(560, width - 24);
        left = (width - panelWidth) / 2;
        replyTop = 57; replyBottom = height - 106;
        input = addRenderableWidget(new EditBox(font, left + 14, height - 86, panelWidth - 28, 20, Component.literal("Your reply to " + npc)));
        input.setMaxLength(1200); input.setValue(previous); input.setHint(Component.literal("Speak your mind…"));
        int buttonWidth = (panelWidth - 40) / 3;
        recordButton = addRenderableWidget(Button.builder(Component.literal("Record voice"), button -> toggleRecording())
                .bounds(left + 14, height - 59, buttonWidth, 20).build());
        sendButton = addRenderableWidget(Button.builder(Component.literal("Send to " + npc), button -> send())
                .bounds(left + 20 + buttonWidth, height - 59, buttonWidth, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Goodbye"), button -> onClose())
                .bounds(left + 26 + buttonWidth * 2, height - 59, buttonWidth, 20).build());
        setInitialFocus(input);
        updateButtons();
    }

    private void toggleRecording() {
        if (audio.recording.get()) {
            audio.recording.set(false);
            status = "Finishing your recording…";
            return;
        }
        if (capturing || transcribing || !pending.isEmpty() || token.isEmpty()) return;
        capturing = true;
        speechGeneration++;
        audio.recording.set(true);
        status = "Listening… click Stop when finished. Maximum 15 seconds.";
        updateButtons();
        WORKERS.execute(() -> {
            try {
                byte[] wav = audio.record();
                if (closed) return;
                if (wav.length < 3244) throw new IllegalArgumentException("Recording was too short. Please try again.");
                ui(() -> { capturing = false; transcribing = true; status = "Transcribing on this computer…"; updateButtons(); });
                byte[] response = request("/api/transcribe", "audio/wav", wav, 8192);
                String text = JsonParser.parseString(new String(response, java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject().get("text").getAsString();
                if (text.isBlank() || text.length() > 1200) throw new IllegalArgumentException("No clear short speech heard. Try again or type.");
                ui(() -> { input.setValue(text); transcribing = false; status = "Transcript ready. Edit it if needed, then Send."; updateButtons(); });
            } catch (Exception failure) {
                audio.recording.set(false);
                ui(() -> { capturing = false; transcribing = false; problem("Voice unavailable: " + explanation(failure) + " You can type instead."); });
            }
        });
    }

    private void send() {
        if (capturing || audio.recording.get() || transcribing || !pending.isEmpty()) return;
        String message = input.getValue().strip();
        if (message.isEmpty()) { status = "Write or record something first."; return; }
        if (!ClientPlayNetworking.canSend(EverafterClient.Say.TYPE)) { problem("The village connection is unavailable. Rejoin and try again."); return; }
        pending = UUID.randomUUID().toString(); pendingAt = System.currentTimeMillis();
        speechGeneration++;
        JsonObject request = new JsonObject();
        request.addProperty("version", 1); request.addProperty("entityId", entityId);
        request.addProperty("message", message); request.addProperty("requestId", pending);
        ClientPlayNetworking.send(new EverafterClient.Say(request.toString()));
        WORKERS.execute(audio::stopSpeech);
        status = npc + " is listening…";
        updateButtons();
    }

    void receive(JsonObject data) {
        if (!data.has("npc") || !npc.equals(data.get("npc").getAsString())) return;
        String id = data.has("requestId") ? data.get("requestId").getAsString() : "";
        if (!EverafterClient.replyMatches(npc, pending, data.get("npc").getAsString(), id)) return;
        long generation = ++speechGeneration;
        reply = data.get("dialogue").getAsString();
        if (reply.length() > 2000) reply = reply.substring(0, 2000);
        source = data.has("source") ? data.get("source").getAsString() : "EVERAFTER";
        pending = ""; scroll = 0;
        boolean error = data.has("error") && data.get("error").getAsBoolean();
        status = error ? "Please try again, or close and speak to the villager again." : "Reply received. You can continue the conversation.";
        updateButtons();
        if (!error && !token.isEmpty() && !reply.isBlank()) {
            String spoken = reply;
            JsonObject speech = new JsonObject();
            speech.addProperty("text", spoken); speech.addProperty("npc", npc); speech.addProperty("requestId", id);
            WORKERS.execute(() -> {
                try {
                    byte[] wav = request("/api/speech", "application/json", speech.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8), 10_000_000);
                    audio.play(wav, () -> canPlaySpeech(generation));
                } catch (Exception failure) {
                    ui(() -> { if (canPlaySpeech(generation)) status = "Reply shown above. Voice playback unavailable: " + explanation(failure); });
                }
            });
        }
    }

    private boolean canPlaySpeech(long generation) {
        return EverafterClient.speechMatches(generation, speechGeneration,
                capturing || transcribing || audio.recording.get() || !pending.isEmpty(), closed);
    }

    private byte[] request(String path, String contentType, byte[] body, int maximum) throws Exception {
        if (token.isEmpty()) throw new IllegalStateException("Reopen the villager to reconnect voice");
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8765" + path))
                .timeout(Duration.ofSeconds(45)).header("Content-Type", contentType).header("X-Everafter-Token", token)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        HttpResponse<java.io.InputStream> response = HTTP.send(request, HttpResponse.BodyHandlers.ofInputStream());
        try (var stream = response.body()) {
            byte[] bytes = stream.readNBytes(maximum + 1);
            if (bytes.length > maximum) throw new IllegalArgumentException("Voice response exceeded its limit");
            if (response.statusCode() != 200) throw new IllegalStateException(response.statusCode() == 401 || response.statusCode() == 403
                    ? "Reopen the villager to refresh the voice connection" : "Local voice service returned " + response.statusCode());
            return bytes;
        }
    }

    void problem(String message) { pending = ""; status = message; updateButtons(); }
    private void ui(Runnable action) { Minecraft.getInstance().execute(() -> { if (!closed) action.run(); }); }
    private static String explanation(Exception error) {
        if (error instanceof javax.sound.sampled.LineUnavailableException || error instanceof SecurityException) return "Check microphone permission for Minecraft/Prism in macOS Settings.";
        String message = error.getMessage();
        return message == null || message.length() > 180 ? error.getClass().getSimpleName() : message;
    }
    private void updateButtons() {
        if (recordButton == null) return;
        recordButton.setMessage(Component.literal(audio.recording.get() ? "Stop recording" : "Record voice"));
        recordButton.active = !token.isEmpty() && !transcribing && pending.isEmpty() && (!capturing || audio.recording.get());
        sendButton.active = !capturing && !transcribing && pending.isEmpty();
        input.setEditable(!capturing && !transcribing && pending.isEmpty());
    }

    @Override public void tick() {
        super.tick(); updateButtons();
        if (!pending.isEmpty() && System.currentTimeMillis() - pendingAt > 60000) problem("The reply took too long. You can send again.");
    }
    @Override public boolean keyPressed(KeyEvent event) {
        if ((event.key() == GLFW.GLFW_KEY_ENTER || event.key() == GLFW.GLFW_KEY_KP_ENTER) && input.isFocused()) { send(); return true; }
        return super.keyPressed(event);
    }
    @Override public boolean mouseScrolled(double x, double y, double horizontal, double vertical) {
        scroll = Math.max(0, scroll - (int) (vertical * 3));
        return true;
    }
    @Override public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
        graphics.fill(0, 0, width, height, 0xB008101A);
        graphics.fill(left, 12, left + panelWidth, height - 12, 0xED17212C);
        graphics.fill(left, 12, left + panelWidth, 14, 0xFFF0BD71);
        graphics.drawString(font, npc, left + 14, 24, 0xFFFFD495, true);
        graphics.drawString(font, "EVERAFTER  /  " + source, left + 14, 39, 0xFF90A8BD, false);
        List<FormattedCharSequence> lines = font.split(Component.literal(reply), panelWidth - 32);
        int visible = Math.max(1, (replyBottom - replyTop) / 11);
        scroll = Math.min(scroll, Math.max(0, lines.size() - visible));
        for (int i = 0; i < visible && scroll + i < lines.size(); i++) graphics.drawString(font, lines.get(scroll + i), left + 16, replyTop + i * 11, 0xFFEAF0F4, false);
        graphics.drawString(font, "Your words", left + 14, height - 99, 0xFFF0BD71, false);
        graphics.drawString(font, font.plainSubstrByWidth(status, panelWidth - 28), left + 14, height - 31, 0xFFAFCCD5, false);
        graphics.drawString(font, "Tab: controls   Enter: send   Scroll: reply   Esc: close", left + 14, height - 20, 0xFF7892A6, false);
        super.render(graphics, mouseX, mouseY, delta);
    }
    @Override public boolean isPauseScreen() { return false; }
    @Override public void removed() { closed = true; audio.recording.set(false); WORKERS.execute(audio::close); super.removed(); }
}
