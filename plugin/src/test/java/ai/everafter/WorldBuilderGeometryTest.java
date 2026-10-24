package ai.everafter;

import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.data.type.Leaves;
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
                    if (operation.getName().equals("getBlockData")) return Proxy.newProxyInstance(Leaves.class.getClassLoader(), new Class<?>[] {Leaves.class}, (data, change, settings) -> {
                        if (change.getName().equals("setPersistent")) return null;
                        if (change.getName().equals("getMaterial")) return blocks.get(position);
                        throw new UnsupportedOperationException(change.getName());
                    });
                    if (operation.getName().equals("setBlockData")) return null;
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

    private static final String[] REALMS = {"ember_keep", "sunken_archive", "sky_monastery", "thornwild"};

    private static java.util.Set<Position> reachable(Stage stage) {
        var reached = new java.util.HashSet<Position>();
        var queue = new java.util.ArrayDeque<Position>();
        Position start = new Position(180, 65, 31); reached.add(start); queue.add(start);
        while (!queue.isEmpty()) {
            Position at = queue.removeFirst();
            for (int[] step : new int[][] {{1, 0}, {-1, 0}, {0, 1}, {0, -1}}) {
                Position next = new Position(at.x + step[0], 65, at.z + step[1]);
                if (next.x < 153 || next.x > 207 || next.z < -49 || next.z > 39 || reached.contains(next)) continue;
                Material floor = stage.block(next.x, 64, next.z);
                if (floor == Material.AIR || floor == Material.WATER || floor == Material.LAVA
                        || stage.block(next.x, 65, next.z) != Material.AIR || stage.block(next.x, 66, next.z) != Material.AIR) continue;
                reached.add(next); queue.add(next);
            }
        }
        return reached;
    }

    @Test void everyRealmAndTrialHasWalkableEvidenceAndThreeRealProgressionGates() throws Exception {
        for (String realm : REALMS) for (String trial : new String[] {"riddle", "gauntlet", "parley"}) for (String mood : new String[] {"eerie", "wonder"}) {
            Stage stage = new Stage();
            stage.invoke("planChapter", new Class<?>[] {String.class, String.class, String.class, int.class}, realm, trial, mood, 3);
            stage.apply();
            var initial = reachable(stage);
            assertTrue(initial.contains(new Position(180, 65, 12)), realm + "/" + trial + " trial unreachable");
            assertTrue(initial.contains(new Position(170, 65, 16)), "Evidence approach must be reachable without jumping");
            int boards = 0;
            for (var entry : stage.blocks.entrySet()) {
                Position board = entry.getKey();
                if (entry.getValue() != Material.SPRUCE_SIGN || board.y != 66 || (board.z != 9 && board.z != 21)) continue;
                boards++;
                assertTrue(initial.contains(new Position(board.x, 65, board.z + 1)), realm + "/" + trial + " blocked inscription front: " + board);
                assertTrue(initial.contains(new Position(board.x, 65, board.z + 2)), "Reading apron must connect to the walkable stage");
            }
            assertTrue(boards >= 2, "Both inscription rows must contain actual reading boards");
            assertEquals(Material.LECTERN, stage.block(170, 65, 15));
            assertFalse(initial.contains(new Position(180, 65, -5)), "Trial gate can be bypassed");
            for (int step = 1; step <= 3; step++) {
                stage.invoke("planUnlock", new Class<?>[] {int.class}, step); stage.apply();
                var accessible = reachable(stage);
                int next = new int[] {-5, -24, -42}[step - 1];
                assertTrue(accessible.contains(new Position(180, 65, next)), realm + " stage " + step + " is blocked");
                if (step < 3) assertFalse(accessible.contains(new Position(180, 65, new int[] {-24, -42}[step - 1])), "A later sealed arena can be bypassed");
            }
            for (int z = 31; z >= -43; z--) for (int x = 179; x <= 181; x++) {
                assertNotEquals(Material.AIR, stage.block(x, 64, z), "Missing continuous road floor");
                assertEquals(Material.AIR, stage.block(x, 65, z));
                assertEquals(Material.AIR, stage.block(x, 66, z));
                assertEquals(Material.AIR, stage.block(x, 67, z), "Boss/escort headroom must stay clear");
            }
            assertTrue(stage.builder.runeLocations().isEmpty(), "The old compulsory three-stone loop must not remain");
            assertFalse(stage.builder.riddle().isBlank()); assertFalse(stage.builder.clueText().isBlank());
            for (var enemy : stage.builder.enemySpawns()) {
                assertTrue(enemy.getBlockZ() >= 7 && enemy.getBlockZ() <= 18);
                assertEquals(Material.AIR, stage.block(enemy.getBlockX(), 65, enemy.getBlockZ()));
                assertEquals(Material.AIR, stage.block(enemy.getBlockX(), 66, enemy.getBlockZ()));
            }
        }
    }

    @Test void realmsHaveDistinctAuthoredLandmarksAndCanonicalEvidence() throws Exception {
        Map<String, String> answers = Map.of("ember_keep", "fire", "sunken_archive", "river", "sky_monastery", "wind", "thornwild", "hole");
        for (String realm : REALMS) {
            Stage stage = new Stage();
            stage.invoke("planChapter", new Class<?>[] {String.class, String.class, String.class, int.class}, realm, "riddle", "wonder", 1);
            stage.apply();
            assertEquals(answers.get(realm), stage.builder.solution());
            assertEquals(2, stage.builder.enemySpawns().size());
            switch (realm) {
                case "ember_keep" -> { assertEquals(Material.LAVA, stage.block(159, 63, 13)); assertEquals(Material.ORANGE_STAINED_GLASS, stage.block(159, 64, 13)); assertEquals(Material.SHROOMLIGHT, stage.block(159, 84, 27)); }
                case "sunken_archive" -> { assertEquals(Material.WATER, stage.block(159, 63, 12)); assertEquals(Material.LIGHT_BLUE_STAINED_GLASS, stage.block(159, 64, 12)); assertEquals(Material.BOOKSHELF, stage.block(163, 67, 13)); }
                case "sky_monastery" -> { assertEquals(Material.PURPUR_BLOCK, stage.block(158, 80, 25)); assertEquals(Material.END_ROD, stage.block(158, 84, 25)); }
                case "thornwild" -> { assertEquals(Material.MANGROVE_WOOD, stage.block(158, 70, 27)); assertEquals(Material.MANGROVE_LEAVES, stage.block(158, 77, 27)); }
            }
        }
    }

    @Test void allChapterEntityChunksRemainInsideThePinnedAdventureStage() throws Exception {
        Stage stage = new Stage();
        stage.invoke("planChapter", new Class<?>[] {String.class, String.class, String.class, int.class}, "ember_keep", "gauntlet", "eerie", 3);
        EverafterPlugin.pinAdventure(stage.world, null);
        assertEquals(64, stage.tickets.size());
        var locations = new java.util.ArrayList<>(stage.builder.enemySpawns());
        locations.addAll(java.util.List.of(stage.builder.elinLocation(), stage.builder.adventureSpawn(), stage.builder.guideLocation(),
                stage.builder.trialLocation(), stage.builder.sentinelLocation(), stage.builder.bossLocation(), stage.builder.clueLocation()));
        for (var location : locations) assertTrue(stage.tickets.contains(new Position(location.getBlockX() >> 4, 0, location.getBlockZ() >> 4)), "Quest entity chunk could unload: " + location);
        assertFalse(stage.tickets.contains(new Position(0, 0, 0)));
    }
}
