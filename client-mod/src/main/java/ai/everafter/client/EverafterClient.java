package ai.everafter.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.client.Minecraft;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

import java.net.InetSocketAddress;

public final class EverafterClient implements ClientModInitializer {
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
        PayloadTypeRegistry.playS2C().register(Open.TYPE, Open.CODEC);
        PayloadTypeRegistry.playS2C().register(Reply.TYPE, Reply.CODEC);
        PayloadTypeRegistry.playC2S().register(Say.TYPE, Say.CODEC);
        ClientPlayNetworking.registerGlobalReceiver(Open.TYPE, (payload, context) -> context.client().execute(() -> {
            Minecraft client = context.client();
            if (!localServer(client)) return;
            try {
                JsonObject data = JsonParser.parseString(payload.json()).getAsJsonObject();
                if (data.get("version").getAsInt() != 1) return;
                String npc = data.get("npc").getAsString();
                if (!java.util.List.of("Mara", "Oren", "Elin").contains(npc)) return;
                int entity = data.get("entityId").getAsInt();
                if (entity < 0 || client.player == null || !client.player.getUUID().toString().equals(data.get("playerId").getAsString())) return;
                client.setScreen(new DialogueScreen(npc, entity, data));
            } catch (RuntimeException ignored) {
                // A malformed server message must not crash the client.
            }
        }));
        ClientPlayNetworking.registerGlobalReceiver(Reply.TYPE, (payload, context) -> context.client().execute(() -> {
            if (!localServer(context.client()) || !(context.client().screen instanceof DialogueScreen screen)) return;
            try { screen.receive(JsonParser.parseString(payload.json()).getAsJsonObject()); }
            catch (RuntimeException ignored) { screen.problem("The reply could not be read. You can try again."); }
        }));
    }

    private static boolean localServer(Minecraft client) {
        if (client.getConnection() == null) return false;
        var address = client.getConnection().getConnection().getRemoteAddress();
        return address instanceof InetSocketAddress socket && socket.getAddress() != null
                && socket.getAddress().isLoopbackAddress() && socket.getPort() == 25565;
    }
}
