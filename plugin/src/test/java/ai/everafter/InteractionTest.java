package ai.everafter;

import org.bukkit.NamespacedKey;
import org.bukkit.World;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Mob;
import org.bukkit.entity.Villager;
import org.bukkit.event.EventHandler;
import org.bukkit.event.player.PlayerInteractAtEntityEvent;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.persistence.PersistentDataContainer;
import org.junit.jupiter.api.Test;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import static org.junit.jupiter.api.Assertions.*;

class InteractionTest {
    @Test void bothIndependentPaperEntityClickHandlersAreRegistered() throws Exception {
        assertNotSame(PlayerInteractEntityEvent.getHandlerList(), PlayerInteractAtEntityEvent.getHandlerList());
        assertNotNull(EverafterPlugin.class.getDeclaredMethod("onInteractEntity", PlayerInteractEntityEvent.class).getAnnotation(EventHandler.class));
        assertNotNull(EverafterPlugin.class.getDeclaredMethod("onInteractAtEntity", PlayerInteractAtEntityEvent.class).getAnnotation(EventHandler.class));
    }
    private World world() {
        return (World) Proxy.newProxyInstance(World.class.getClassLoader(), new Class<?>[]{World.class}, (proxy, method, args) -> {
            if (method.getName().equals("equals")) return proxy == args[0];
            throw new UnsupportedOperationException(method.getName());
        });
    }
    private Entity entity(Class<? extends Entity> type, World world, String identity) {
        var data = (PersistentDataContainer) Proxy.newProxyInstance(PersistentDataContainer.class.getClassLoader(), new Class<?>[]{PersistentDataContainer.class}, (proxy, method, args) -> {
            if (method.getName().equals("get")) return identity;
            throw new UnsupportedOperationException(method.getName());
        });
        return (Entity) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (proxy, method, args) -> switch (method.getName()) {
            case "getWorld" -> world;
            case "getPersistentDataContainer" -> data;
            default -> throw new UnsupportedOperationException(method.getName());
        });
    }
    @Test void npcSelectionRequiresProtectedVillagerIdentityInTheCurrentStoryWorld() {
        World story = world(), other = world(); var key = new NamespacedKey("everafter", "npc");
        assertEquals("Oren", EverafterPlugin.storyNpc(entity(Villager.class, story, "Oren"), story, key));
        assertEquals("Elin", EverafterPlugin.storyNpc(entity(Villager.class, story, "Elin"), story, key));
        assertNull(EverafterPlugin.storyNpc(entity(Villager.class, story, null), story, key));
        assertNull(EverafterPlugin.storyNpc(entity(Villager.class, other, "Oren"), story, key));
        assertNull(EverafterPlugin.storyNpc(entity(Entity.class, story, "Oren"), story, key));
        assertNull(EverafterPlugin.storyNpc(entity(Villager.class, story, "SomeoneElse"), story, key));
        assertEquals("Oren", EverafterPlugin.canonicalNpc("oren"));
    }
    @Test void fabricStringPayloadRoundTripsUnicodeAndRejectsTruncationOrExtraBytes() {
        String json = "{\"message\":\"Hello Oren — I prefer mysteries!\"}";
        byte[] encoded = EverafterPlugin.encodePayload(json);
        assertEquals(json, EverafterPlugin.decodePayload(encoded));
        assertThrows(IllegalArgumentException.class, () -> EverafterPlugin.decodePayload(Arrays.copyOf(encoded, encoded.length - 1)));
        assertThrows(IllegalArgumentException.class, () -> EverafterPlugin.decodePayload(Arrays.copyOf(encoded, encoded.length + 1)));
        assertThrows(IllegalArgumentException.class, () -> EverafterPlugin.decodePayload(new byte[]{(byte)128,(byte)128,(byte)128}));
        assertThrows(IllegalArgumentException.class, () -> EverafterPlugin.encodePayload("a".repeat(8193)));
    }
    @Test void clientDialogueOnlyCarriesBoundedTextAndTheSelectedEntityReference() {
        String valid = "{\"version\":1,\"entityId\":73,\"message\":\"I prefer puzzles\",\"requestId\":\"test-1\"}";
        var request = EverafterPlugin.ClientMessage.parse(valid);
        assertEquals(73, request.entityId()); assertEquals("I prefer puzzles", request.message()); assertEquals("test-1", request.requestId());
        for (String invalid : new String[]{valid.replace("puzzles", "a".repeat(1201)), valid.replace("73", "73.5"), valid.replace("test-1", "bad id"), valid.replace("\"version\":1", "\"version\":1.5"), valid.replace("I prefer puzzles", " "), "{}"})
            assertThrows(RuntimeException.class, () -> EverafterPlugin.ClientMessage.parse(invalid));
    }
    @Test void screenOpensBeforeAnUnsolicitedGreetingReply() {
        var channels = new java.util.ArrayList<String>();
        var payloads = new java.util.ArrayList<String>();
        Player player = (Player) Proxy.newProxyInstance(Player.class.getClassLoader(), new Class<?>[]{Player.class}, (proxy, method, args) -> {
            if (method.getName().equals("sendPluginMessage")) {
                channels.add((String) args[1]); payloads.add(EverafterPlugin.decodePayload((byte[]) args[2])); return null;
            }
            throw new UnsupportedOperationException(method.getName());
        });
        EverafterPlugin.sendOpening(player, null, EverafterPlugin.encodePayload("{\"npc\":\"Oren\",\"phase\":\"village\"}"), EverafterPlugin.encodePayload("{\"npc\":\"Oren\",\"requestId\":\"\",\"dialogue\":\"Welcome\"}"));
        assertEquals(java.util.List.of("everafter:open", "everafter:scene"), channels);
        var reply = com.google.gson.JsonParser.parseString(payloads.get(1)).getAsJsonObject();
        assertEquals("", reply.get("requestId").getAsString(), "Fresh screen has no pending request");
        assertEquals("Oren", reply.get("npc").getAsString());
    }
    @Test void elinGreetingMatchesAuthoritativeRescuePhaseAndRoute() {
        assertTrue(EverafterPlugin.openingGreeting("Elin", "adventure", "mystery").contains("trial"));
        assertTrue(EverafterPlugin.openingGreeting("Elin", "adventure", "combat").contains("Warden"));
        assertTrue(EverafterPlugin.openingGreeting("Elin", "rescued", "mystery").contains("follow you home"));
        assertTrue(EverafterPlugin.openingGreeting("Elin", "complete", "combat").contains("brought me home"));
    }
    private Mob mob(java.util.UUID id, boolean valid, boolean dead) {
        return (Mob) Proxy.newProxyInstance(Mob.class.getClassLoader(), new Class<?>[]{Mob.class}, (proxy, method, args) -> switch (method.getName()) {
            case "getUniqueId" -> id;
            case "isValid" -> valid;
            case "isDead" -> dead;
            default -> throw new UnsupportedOperationException(method.getName());
        });
    }
    @Test void actorLookupRefreshesAnInvalidWrapperAfterItsEntityReloads() {
        var id = java.util.UUID.randomUUID(); Mob original = mob(id, false, false), reloaded = mob(id, true, false);
        assertSame(reloaded, EverafterPlugin.loadedActor(original, requested -> { assertEquals(id, requested); return reloaded; }));
        assertNull(EverafterPlugin.loadedActor(original, ignored -> null));
        assertNull(EverafterPlugin.loadedActor(original, ignored -> mob(id, false, false)));
        assertNull(EverafterPlugin.loadedActor(original, ignored -> mob(id, true, true)));
        assertNull(EverafterPlugin.loadedActor(null, ignored -> { fail("No UUID exists to resolve"); return null; }));
    }
    @Test void villageNpcChunksArePinnedBeforePlayersArrive() {
        var chunks = new java.util.HashSet<String>();
        World world = (World) Proxy.newProxyInstance(World.class.getClassLoader(), new Class<?>[]{World.class}, (proxy, method, args) -> {
            if (method.getName().equals("addPluginChunkTicket")) { chunks.add(args[0] + ":" + args[1]); return true; }
            throw new UnsupportedOperationException(method.getName());
        });
        EverafterPlugin.pinVillage(world, null);
        assertEquals(64, chunks.size());
        var builder = new WorldBuilder(null, world);
        for (var location : java.util.List.of(builder.villageSpawn(), builder.maraLocation(), builder.orenLocation()))
            assertTrue(chunks.contains((location.getBlockX() >> 4) + ":" + (location.getBlockZ() >> 4)));
        assertFalse(chunks.contains("11:0"), "Village pinning stays separate from the adventure");
    }
    @Test void conversationPauseDisablesVillagerBrainAsWellAsItsCurrentPath() {
        var calls = new java.util.ArrayList<String>();
        var path = (com.destroystokyo.paper.entity.Pathfinder) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{com.destroystokyo.paper.entity.Pathfinder.class}, (proxy, method, args) -> {
            if (method.getName().equals("stopPathfinding")) { calls.add("stop-path"); return null; }
            throw new UnsupportedOperationException(method.getName());
        });
        Villager villager = (Villager) Proxy.newProxyInstance(Villager.class.getClassLoader(), new Class<?>[]{Villager.class}, (proxy, method, args) -> switch (method.getName()) {
            case "setAI" -> { calls.add("ai:" + args[0]); yield null; }
            case "getPathfinder" -> path;
            default -> throw new UnsupportedOperationException(method.getName());
        });
        EverafterPlugin.holdFriendly(villager, null, false);
        assertEquals(java.util.List.of("ai:false", "stop-path"), calls);
    }
}
