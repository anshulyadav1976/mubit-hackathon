package ai.everafter;

import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Checks the actual queued geometry without a running Minecraft server. */
class WorldBuilderGeometryTest {
    record Position(int x, int y, int z) {}

    private static final class Stage {
        final Map<Position, Material> blocks = new HashMap<>();
        final java.util.Set<Position> tickets = new java.util.HashSet<>();
        final World world = (World) Proxy.newProxyInstance(World.class.getClassLoader(), new Class<?>[] {World.class}, (proxy, method, args) -> {
            if (method.getName().equals("addPluginChunkTicket")) { tickets.add(new Position((int) args[0], 0, (int) args[1])); return true; }
            if (method.getName().equals("getBlockAt")) {
                Position position = new Position((int) args[0], (int) args[1], (int) args[2]);
                return Proxy.newProxyInstance(Block.class.getClassLoader(), new Class<?>[] {Block.class}, (block, operation, values) -> {
                    if (operation.getName().equals("setType")) { blocks.put(position, (Material) values[0]); return null; }
                    if (operation.getName().equals("getState")) return null;
                    throw new UnsupportedOperationException(operation.getName());
                });
            }
            if (method.getName().equals("equals")) return proxy == args[0];
            if (method.getName().equals("hashCode")) return System.identityHashCode(proxy);
            if (method.getName().equals("toString")) return "geometry-test-world";
            throw new UnsupportedOperationException(method.getName());
        });
        final WorldBuilder builder = new WorldBuilder(null, world);

        void invoke(String name, Class<?>[] types, Object... args) throws Exception {
            Method method = WorldBuilder.class.getDeclaredMethod(name, types);
            method.setAccessible(true);
            method.invoke(builder, args);
        }

        @SuppressWarnings("unchecked")
        void apply() throws Exception {
            Field field = WorldBuilder.class.getDeclaredField("edits");
            field.setAccessible(true);
            var queue = (ArrayDeque<Runnable>) field.get(builder);
            assertTrue(queue.size() < 250000, "Bound the total world-write plan");
            while (!queue.isEmpty()) queue.removeFirst().run();
        }

        Material block(int x, int y, int z) { return blocks.getOrDefault(new Position(x, y, z), Material.AIR); }
    }

    @Test void towerHasAContinuousGroundLevelRescueApproachInBothMoods() throws Exception {
        for (boolean eerie : new boolean[] {false, true}) {
            Stage stage = new Stage();
            stage.invoke("terrain", new Class<?>[] {int.class, int.class, int.class, boolean.class}, 180, 0, 48, eerie);
            stage.invoke("path", new Class<?>[] {int.class, int.class, int.class, int.class, int.class, boolean.class}, 180, 35, 180, -27, 2, eerie);
            stage.invoke("buildTower", new Class<?>[] {boolean.class, int.class}, eerie, 3);
            stage.apply();
            for (int z = 29; z >= -23; z--) {
                assertNotEquals(Material.AIR, stage.block(180, 64, z), "Missing floor at " + z);
                assertEquals(Material.AIR, stage.block(180, 65, z), "Blocked feet at " + z);
                assertEquals(Material.AIR, stage.block(180, 66, z), "Blocked head at " + z);
            }
            assertEquals(4, stage.builder.enemySpawns().size());
            assertEquals(Material.AIR, stage.block(178, 65, -14));
            assertEquals(Material.AIR, stage.block(182, 66, -14));
        }
    }

    @Test void mysteryHasExactlyThreeSeparateVisibleReachableMarkers() throws Exception {
        for (boolean eerie : new boolean[] {false, true}) {
            Stage stage = new Stage();
            for (int[] point : new int[][] {{165, 8}, {196, 3}, {176, -10}}) {
                stage.invoke("rune", new Class<?>[] {int.class, int.class, String.class, boolean.class}, point[0], point[1], "RUNE", eerie);
            }
            stage.apply();
            assertEquals(3, stage.builder.runeLocations().size());
            assertEquals(3, stage.builder.runeLocations().stream().distinct().count());
            stage.builder.runeLocations().forEach(location -> {
                int x = location.getBlockX(), z = location.getBlockZ();
                assertEquals(eerie ? Material.CRYING_OBSIDIAN : Material.AMETHYST_BLOCK, stage.block(x, 65, z));
                assertEquals(Material.AIR, stage.block(x, 65, z - 1));
                assertEquals(Material.AIR, stage.block(x, 66, z - 1));
                assertNotEquals(Material.AIR, stage.block(x, 64, z - 1));
            });
        }
    }
    @Test void adventureTicketsKeepEveryQuestEntityAvailableWhilePlayerIsHome() throws Exception {
        Stage stage = new Stage();
        stage.invoke("buildTower", new Class<?>[] {boolean.class, int.class}, true, 3);
        for (int[] point : new int[][] {{165, 8}, {196, 3}, {176, -10}})
            stage.invoke("rune", new Class<?>[] {int.class, int.class, String.class, boolean.class}, point[0], point[1], "RUNE", true);
        EverafterPlugin.pinAdventure(stage.world, null);
        assertEquals(64, stage.tickets.size(), "Keep a fixed, bounded scene rather than loading arbitrary chunks");
        var locations = new java.util.ArrayList<>(stage.builder.enemySpawns());
        locations.addAll(stage.builder.runeLocations());
        locations.add(stage.builder.elinLocation());
        locations.add(stage.builder.adventureSpawn());
        for (var location : locations) assertTrue(stage.tickets.contains(new Position(location.getBlockX() >> 4, 0, location.getBlockZ() >> 4)), "Quest entity chunk could unload: " + location);
        assertFalse(stage.tickets.contains(new Position(0, 0, 0)), "Tickets must stay within the adventure stage");
    }
}
