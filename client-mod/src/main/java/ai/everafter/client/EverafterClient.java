package ai.everafter.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.fabricmc.fabric.api.event.player.UseEntityCallback;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.client.Minecraft;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.phys.EntityHitResult;

import java.net.InetSocketAddress;

public final class EverafterClient implements ClientModInitializer {
    private static EverafterClient instance;
    private final UsePressTracker presses = new UsePressTracker();
    private ConversationController conversation;
    static boolean replyMatches(String npc, String pending, String incomingNpc, String requestId) {
        return npc.equals(incomingNpc) && pending.equals(requestId);
    }

    static boolean speechMatches(long expectedGeneration, long currentGeneration, boolean busy, boolean closed) {
        return expectedGeneration == currentGeneration && !busy && !closed;
    }

    public record Open(String json) implements CustomPacketPayload {
        public static final Type<Open> TYPE = new Type<>(Identifier.fromNamespaceAndPath("everafter", "open"));
        public static final StreamCodec<RegistryFriendlyByteBuf, Open> CODEC = StreamCodec.of((b, p) -> b.writeUtf(p.json(), 8192), b -> new Open(b.readUtf(8192)));
        @Override public Type<Open> type() { return TYPE; }
    }
    public record Reply(String json) implements CustomPacketPayload {
        public static final Type<Reply> TYPE = new Type<>(Identifier.fromNamespaceAndPath("everafter", "reply"));
        public static final StreamCodec<RegistryFriendlyByteBuf, Reply> CODEC = StreamCodec.of((b, p) -> b.writeUtf(p.json(), 8192), b -> new Reply(b.readUtf(8192)));
        @Override public Type<Reply> type() { return TYPE; }
    }
    public record Say(String json) implements CustomPacketPayload {
        public static final Type<Say> TYPE = new Type<>(Identifier.fromNamespaceAndPath("everafter", "say"));
        public static final StreamCodec<RegistryFriendlyByteBuf, Say> CODEC = StreamCodec.of((b, p) -> b.writeUtf(p.json(), 8192), b -> new Say(b.readUtf(8192)));
        @Override public Type<Say> type() { return TYPE; }
    }

    @Override public void onInitializeClient() {
        instance = this;
        PayloadTypeRegistry.playS2C().register(Open.TYPE, Open.CODEC);
        PayloadTypeRegistry.playS2C().register(Reply.TYPE, Reply.CODEC);
        PayloadTypeRegistry.playC2S().register(Say.TYPE, Say.CODEC);
        ClientTickEvents.START_CLIENT_TICK.register(client -> {
            boolean allowed = inWorld(client);
            int target = client.hitResult instanceof EntityHitResult hit ? hit.getEntity().getId() : -1;
            boolean rising = presses.update(client.options.keyUse.isDown(), target, allowed, System.currentTimeMillis());
            if (!allowed) { cancelConversation(); return; }
            if (conversation != null && !conversation.inReach(client)) cancelConversation();
            if (rising && conversation != null && conversation.busy()) {
                conversation.stop();
                if (target == conversation.entityId || target < 0) presses.consume();
            }
            if (conversation != null) conversation.tick();
        });
        UseEntityCallback.EVENT.register((player, level, hand, entity, hit) -> {
            if (level.isClientSide() && conversation != null && entity.getId() == conversation.entityId
                    && (conversation.busy() || !presses.hasOpening(entity.getId(), System.currentTimeMillis()))) {
                // Fabric FAIL cancels locally without sending another greeting-triggering packet.
                return InteractionResult.FAIL;
            }
            return InteractionResult.PASS;
        });
        HudElementRegistry.attachElementBefore(VanillaHudElements.CHAT, Identifier.fromNamespaceAndPath("everafter", "conversation"),
                (graphics, delta) -> { Minecraft client = Minecraft.getInstance(); if (conversation != null && inWorld(client)) conversation.render(client, graphics); });
        ClientPlayNetworking.registerGlobalReceiver(Open.TYPE, (payload, context) -> context.client().execute(() -> {
            Minecraft client = context.client();
            if (!inWorld(client)) return;
            try {
                JsonObject data = JsonParser.parseString(payload.json()).getAsJsonObject();
                if (data.get("version").getAsInt() != 1) return;
                String npc = data.get("npc").getAsString();
                if (!java.util.List.of("Mara", "Oren", "Elin").contains(npc)) return;
                int entity = data.get("entityId").getAsInt();
                if (entity < 0 || client.player == null || !client.player.getUUID().toString().equals(data.get("playerId").getAsString())) return;
                if (!presses.acceptOpen(entity, System.currentTimeMillis())) return;
                cancelConversation();
                ConversationController next = new ConversationController(npc, entity, data);
                if (!next.inReach(client)) return;
                conversation = next;
                conversation.start();
            } catch (RuntimeException ignored) {
                // A malformed server message must not crash the client.
            }
        }));
        ClientPlayNetworking.registerGlobalReceiver(Reply.TYPE, (payload, context) -> context.client().execute(() -> {
            if (conversation == null || !conversation.inReach(context.client())) return;
            try { conversation.receive(JsonParser.parseString(payload.json()).getAsJsonObject()); }
            catch (RuntimeException ignored) { conversation.problem("The reply could not be read. Use /talk or try again."); }
        }));
    }

    private void cancelConversation() {
        if (conversation != null) { conversation.cancel(); conversation = null; }
    }

    public static void observeUse(boolean pressed) {
        if (instance == null) return;
        Minecraft client = Minecraft.getInstance();
        int target = client.hitResult instanceof EntityHitResult hit ? hit.getEntity().getId() : -1;
        instance.presses.observeInput(pressed, target, inWorld(client), System.currentTimeMillis());
    }

    static boolean inWorld(Minecraft client) {
        return localServer(client) && client.screen == null && client.isWindowActive()
                && client.player != null && client.player.isAlive() && !client.player.isDeadOrDying();
    }

    private static boolean localServer(Minecraft client) {
        if (client.getConnection() == null) return false;
        var address = client.getConnection().getConnection().getRemoteAddress();
        return address instanceof InetSocketAddress socket && socket.getAddress() != null
                && socket.getAddress().isLoopbackAddress() && socket.getPort() == 25565;
    }
}
