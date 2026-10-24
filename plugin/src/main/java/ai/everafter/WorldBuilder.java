package ai.everafter;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.Sign;
import org.bukkit.block.data.BlockData;
import org.bukkit.block.data.type.Leaves;
import org.bukkit.block.data.type.Stairs;
import org.bukkit.block.BlockFace;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** Small authored stages; block changes are applied only by the server tick scheduler. */
public final class WorldBuilder {
    private static final int BLOCKS_PER_TICK = 1500;
    private final JavaPlugin plugin;
    private final World world;
    private final ArrayDeque<Runnable> edits = new ArrayDeque<>();
    private final List<Location> enemies = new ArrayList<>();
    private boolean busy;
    private boolean adventureBuilt;
    private boolean celebrated;
    private Realm realm = Realm.EMBER_KEEP;
    private String trial = "riddle";
    private int unlockedStage;

    private enum Realm {
        EMBER_KEEP("Ember Keep", Material.BLACKSTONE, Material.POLISHED_BLACKSTONE_BRICKS, Material.RED_NETHER_BRICKS, Material.SHROOMLIGHT,
                Material.ORANGE_STAINED_GLASS, "I eat the forest without a mouth. Water ends me. What am I?", "fire",
                "A charred oath tablet reads: We guarded a flame, never a prisoner. Water stills its hunger."),
        SUNKEN_ARCHIVE("Sunken Archive", Material.PRISMARINE, Material.DARK_PRISMARINE, Material.PRISMARINE_BRICKS, Material.SEA_LANTERN,
                Material.CYAN_STAINED_GLASS, "I have banks but no coins, a mouth but no voice. What am I?", "river",
                "A drowned ledger reads: Banks guide the current; its mouth opens to the sea. Elin was granted passage."),
        SKY_MONASTERY("Sky Monastery", Material.SMOOTH_QUARTZ, Material.QUARTZ_BRICKS, Material.PURPUR_BLOCK, Material.SEA_LANTERN,
                Material.LIGHT_BLUE_STAINED_GLASS, "You cannot hold me, yet I fill a sail. You hear me through bells. What am I?", "wind",
                "A brass vow-bell reads: No chain holds what fills a sail. The keeper vowed to shelter the lost."),
        THORNWILD("Thornwild", Material.MOSS_BLOCK, Material.MUD_BRICKS, Material.STRIPPED_MANGROVE_WOOD, Material.OCHRE_FROGLIGHT,
                Material.LIME_STAINED_GLASS, "The more you take from me, the larger I become. What am I?", "hole",
                "A gardener's journal reads: Take earth away and the hollow grows. Elin carries our seed of peace.");
        final String title, riddle, solution, clue;
        final Material ground, wall, trim, light, barrier;
        Realm(String title, Material ground, Material wall, Material trim, Material light, Material barrier, String riddle, String solution, String clue) {
            this.title = title; this.ground = ground; this.wall = wall; this.trim = trim; this.light = light; this.barrier = barrier;
            this.riddle = riddle; this.solution = solution; this.clue = clue;
        }
    }

    public WorldBuilder(JavaPlugin plugin, World world) {
        this.plugin = plugin;
        this.world = world;
    }

    public boolean isBusy() { return busy; }
    public Location villageSpawn() { return at(0, 65, 0, 180); }
    public Location maraLocation() { return at(0, 65, -10, 0); }
    public Location orenLocation() { return at(-12, 65, 0, -90); }
    public Location gateLocation() { return at(0, 65, -38, 180); }
    public Location adventureSpawn() { return at(180, 65, 31, 180); }
    public Location returnLocation() { return at(180, 65, 34, 0); }
    public Location elinLocation() { return at(180, 65, -42, 0); }
    public Location guideLocation() { return at(180, 65, 25, 0); }
    public Location trialLocation() { return at(180, 65, 12, 0); }
    public Location sentinelLocation() { return at(180, 65, -5, 0); }
    public Location bossLocation() { return at(180, 65, -24, 0); }
    public Location clueLocation() { return at(170, 65, 15, 0); }
    public String riddle() { return realm.riddle; }
    public String solution() { return realm.solution; }
    public String clueText() { return realm.clue; }
    public String realmName() { return realm.title; }
    public List<Location> enemySpawns() { return enemies.stream().map(Location::clone).toList(); }
    public List<Location> runeLocations() { return List.of(); }

    public void buildVillage(Runnable onComplete) {
        begin();
        terrain(0, 0, 55, false);
        // Plant the scenery first so roads and buildings always have clear approaches.
        for (int i = 0; i < 22; i++) {
            double a = i * Math.PI * 2 / 22;
            int x = (int) Math.round(Math.cos(a) * 45);
            int z = (int) Math.round(Math.sin(a) * 45);
            if (Math.abs(x) < 10 && z < 0) continue;
            tree(x, 65, z, i % 3 == 0 ? Material.CHERRY_LEAVES : Material.OAK_LEAVES, 6 + i % 3);
        }
        tree(13, 65, 27, Material.CHERRY_LEAVES, 9);
        tree(-33, 65, -1, Material.OAK_LEAVES, 8);
        pond(31, 30, 7, false);
        path(0, 26, 0, -39, 2, false);
        path(-31, 0, 30, 0, 2, false);
        path(-20, 0, -20, -12, 1, false);
        path(19, 0, 19, -12, 1, false);
        path(-13, 0, -13, 22, 1, false);
        path(-13, 22, -26, 22, 1, false);
        path(-26, 22, -26, 18, 1, false);
        path(13, 0, 13, 21, 1, false);
        path(13, 21, 27, 21, 1, false);
        path(27, 21, 27, 17, 1, false);
        plaza(0, 0, 6, Material.STONE_BRICKS);
        house(-20, -20, 5, 5, Material.SPRUCE_PLANKS, Material.DARK_OAK_STAIRS, "THE LANTERN INN", "A light for the lost");
        house(19, -20, 5, 5, Material.WHITE_TERRACOTTA, Material.DARK_PRISMARINE_STAIRS, "MARA'S HOME", "Someone is missing...");
        house(-26, 12, 5, 5, Material.MUSHROOM_STEM, Material.BRICK_STAIRS, "OREN'S ARCHIVE", "Every stone remembers");
        house(27, 11, 5, 5, Material.STRIPPED_BIRCH_WOOD, Material.DEEPSLATE_TILE_STAIRS, "THE GREEN CUP", "Tea, tales & tomorrow");
        fountain(0, 11);
        market(-10, 13, Material.RED_WOOL);
        market(10, 13, Material.YELLOW_WOOL);
        garden(-17, 25);
        bench(-7, -6, BlockFace.SOUTH);
        bench(7, -6, BlockFace.SOUTH);
        for (int z : new int[] {-31, -21, -5, 20}) {
            lamp(-4, z, false);
            lamp(4, z, false);
        }
        for (int x : new int[] {-29, -12, 12, 29}) lamp(x, 3, false);
        arch(0, -38, false, false);
        sign(3, 65, -35, BlockFace.SOUTH, "THE UNWRITTEN", "Your words choose", "what lies beyond", "/everafter go");
        sign(-3, 65, -3, BlockFace.SOUTH, "EVERAFTER", "Talk to Mara", "or Archivist Oren", "Right-click to talk");
        sign(-12, 65, 2, BlockFace.SOUTH, "ARCHIVIST OREN", "Ask about the ruins", "Speak in chat", "or /talk ...");
        sign(1, 65, -12, BlockFace.SOUTH, "MARA", "Her sister is lost", "Your story begins", "with a conversation");
        bunting(-6, 19, 6, 19);
        run(onComplete);
    }

    public void buildAdventure(String route, String mood, int difficulty, Runnable onComplete) {
        String selectedTrial = switch (route) {
            case "mystery" -> "riddle";
            case "combat" -> "gauntlet";
            case "hybrid" -> "parley";
            default -> throw new IllegalArgumentException("Invalid adventure route");
        };
        buildChapter(route.equals("combat") ? "ember_keep" : "sunken_archive", selectedTrial, mood, difficulty, onComplete);
    }

    public void buildChapter(String realm, String trial, String mood, int difficulty, Runnable onComplete) {
        validateChapter(realm, trial, mood, difficulty);
        if (adventureBuilt) throw new IllegalStateException("Chapter has already been built");
        begin();
        planChapter(realm, trial, mood, difficulty);
        adventureBuilt = true;
        run(onComplete);
    }

    public void unlockStage(int stage) {
        if (stage < 1 || stage > 3) throw new IllegalArgumentException("Unknown chapter stage");
        if (!adventureBuilt) throw new IllegalStateException("Build the chapter first");
        if (!Bukkit.isPrimaryThread()) throw new IllegalStateException("Unlock on the main server thread");
        if (stage <= unlockedStage) return;
        boolean alreadyRunning = busy;
        if (!alreadyRunning) begin();
        planUnlock(stage);
        if (!alreadyRunning) run(() -> {});
    }

    private static void validateChapter(String realm, String trial, String mood, int difficulty) {
        if (!List.of("ember_keep", "sunken_archive", "sky_monastery", "thornwild").contains(realm)
                || !List.of("riddle", "gauntlet", "parley").contains(trial)
                || !List.of("eerie", "wonder").contains(mood) || difficulty < 1 || difficulty > 3)
            throw new IllegalArgumentException("Invalid chapter choices");
    }

    private void planChapter(String selectedRealm, String selectedTrial, String mood, int difficulty) {
        validateChapter(selectedRealm, selectedTrial, mood, difficulty);
        realm = Realm.valueOf(selectedRealm.toUpperCase(java.util.Locale.ROOT));
        trial = selectedTrial; unlockedStage = 0; enemies.clear();
        boolean eerie = mood.equals("eerie");
        for (int dx = -54; dx <= 54; dx++) for (int z = -54; z <= 54; z++) {
            if (dx * dx + z * z > 54 * 54) continue;
            set(180 + dx, 63, z, realm == Realm.EMBER_KEEP ? Material.NETHERRACK : realm.ground);
            Material top = Math.floorMod(dx * 17 + z * 11, 19) == 0 ? realm.trim : realm.ground;
            set(180 + dx, 64, z, top);
        }
        switch (realm) {
            case EMBER_KEEP -> emberKeep(eerie);
            case SUNKEN_ARCHIVE -> sunkenArchive(eerie);
            case SKY_MONASTERY -> skyMonastery(eerie);
            case THORNWILD -> thornwild(eerie);
        }
        enclosure();
        arena(180, 12, 10);
        arena(180, -5, 11);
        arena(180, -24, 12);
        refuge(eerie);
        road(180, 34, 180, -43, 3);
        road(180, 16, 170, 16, 1);
        // The evidence is a visible block, with standing room and a road to its south.
        box(169, 64, 14, 171, 64, 16, realm.trim);
        set(170, 65, 15, Material.LECTERN);
        set(168, 65, 15, realm.light);
        inscription(157, 21, "EVIDENCE", realm.clue);
        String instruction = switch (trial) {
            case "riddle" -> realm.riddle + " Tell Ivo your answer after reading the evidence.";
            case "gauntlet" -> "The oath demands courage. Defeat the trial guards, then seek the Sentinel. Evidence may still change a later bargain.";
            default -> "Read the oath evidence. Ask Ivo what the guardians truly protect, then offer a bargain grounded in what you discovered.";
        };
        inscription(157, 9, trial.toUpperCase(java.util.Locale.ROOT) + " TRIAL", instruction);
        sign(185, 65, 28, BlockFace.SOUTH, realm.title, "Read the evidence", "Speak with Ivo", "Then face the Watch");
        sign(185, 65, 32, BlockFace.SOUTH, "WAY HOME", "Return arch behind", "/everafter home", "Bring Elin back");
        arch(180, 35, eerie, true);
        for (int z : new int[] {26, 17, -5, -24, -41}) for (int x : new int[] {166, 194}) {
            column(x, 65, z, 3, realm.trim);
            set(x, 68, z, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
            set(x, 64, z, realm.light);
        }
        for (Location location : List.of(guideLocation(), trialLocation(), sentinelLocation(), bossLocation(), elinLocation())) {
            int x = location.getBlockX(), z = location.getBlockZ();
            box(x - 1, 64, z - 1, x + 1, 64, z + 1, realm.ground);
            box(x - 1, 65, z - 1, x + 1, 68, z + 1, Material.AIR);
        }
        enemies.add(at(176, 65, 9, 0));
        enemies.add(at(184, 65, 10, 0));
        if (difficulty >= 2) enemies.add(at(177, 65, 17, 0));
        if (difficulty >= 3) enemies.add(at(185, 65, 17, 0));
        for (Location enemy : enemies) box(enemy.getBlockX(), 65, enemy.getBlockZ(), enemy.getBlockX(), 68, enemy.getBlockZ(), Material.AIR);
        for (int stage = 1; stage <= 3; stage++) gate(stage);
        if (edits.size() > 250000) throw new IllegalStateException("Chapter exceeds the bounded edit budget");
    }

    private void enclosure() {
        for (int x : new int[] {154, 206}) box(x, 64, -48, x, 71, 38, realm.wall);
        for (int z : new int[] {-48, 38}) box(154, 64, z, 206, 71, z, realm.wall);
        for (int z = -46; z <= 36; z += 8) for (int x : new int[] {154, 206}) {
            column(x, 65, z, 10, realm.trim);
            set(x, 75, z, realm.light);
        }
    }

    private static int gateZ(int stage) { return new int[] {3, -14, -35}[stage - 1]; }

    private void gate(int stage) {
        int z = gateZ(stage);
        box(154, 65, z, 206, 70, z, realm.wall);
        for (int x : new int[] {174, 186}) {
            box(x - 1, 65, z - 1, x + 1, 73, z + 1, realm.trim);
            set(x, 74, z, realm.light);
        }
        box(176, 70, z, 184, 71, z, realm.trim);
        box(176, 65, z, 184, 69, z, realm.barrier);
        sign(188, 66, z + 1, BlockFace.SOUTH, "SEALED CROSSING", stage == 1 ? "Clear Ivo's trial" : stage == 2 ? "Resolve the Sentinel" : "Resolve the Warden", "The oath opens", "the way forward");
    }

    private void planUnlock(int stage) {
        if (stage < 1 || stage > 3) throw new IllegalArgumentException("Unknown chapter stage");
        for (int current = unlockedStage + 1; current <= stage; current++) {
            int z = gateZ(current);
            box(176, 65, z, 184, 69, z, Material.AIR);
            for (int x = 176; x <= 184; x++) set(x, 64, z, realm.light);
            sign(188, 66, z + 1, BlockFace.SOUTH, "THE OATH YIELDS", "A path is open", "Your choice mattered", "Go onward");
        }
        unlockedStage = Math.max(stage, unlockedStage);
    }

    private void road(int x1, int z1, int x2, int z2, int width) {
        int length = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
        for (int i = 0; i <= length; i++) {
            int x = x1 + (length == 0 ? 0 : (x2 - x1) * i / length);
            int z = z1 + (length == 0 ? 0 : (z2 - z1) * i / length);
            for (int dx = -width; dx <= width; dx++) for (int dz = -width; dz <= width; dz++) {
                set(x + dx, 64, z + dz, Math.abs(dx) == width ? realm.trim : realm.ground);
                box(x + dx, 65, z + dz, x + dx, 68, z + dz, Material.AIR);
            }
        }
    }

    private void arena(int x, int z, int radius) {
        for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
            int d = dx * dx + dz * dz;
            if (d > radius * radius) continue;
            set(x + dx, 64, z + dz, d >= (radius - 1) * (radius - 1) ? realm.trim : realm.ground);
            box(x + dx, 65, z + dz, x + dx, 68, z + dz, Material.AIR);
            if (d > (radius - 2) * (radius - 2) && Math.floorMod(dx * 3 + dz, 9) == 0) set(x + dx, 64, z + dz, realm.light);
        }
    }

    private void refuge(boolean eerie) {
        box(172, 64, -46, 188, 64, -38, realm.trim);
        for (int x : new int[] {172, 188}) for (int z : new int[] {-46, -38}) column(x, 65, z, 7, realm.wall);
        box(171, 72, -47, 189, 72, -37, realm.trim);
        box(174, 73, -46, 186, 73, -38, realm.ground);
        set(180, 74, -42, realm.light);
        set(175, 65, -44, Material.WHITE_CARPET);
        set(185, 65, -44, Material.BARREL);
        set(185, 66, -44, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
        sign(187, 65, -39, BlockFace.SOUTH, "ELIN'S REFUGE", "Not every guardian", "guards a prisoner", "Listen before judging");
    }

    private void emberKeep(boolean eerie) {
        // Nether palette and contained lava; this remains the dedicated overworld scene.
        for (int x : new int[] {159, 201}) for (int z : new int[] {27, -25}) bastion(x, z, 18, Material.POLISHED_BLACKSTONE_BRICKS, Material.RED_NETHER_BRICKS);
        for (int x : new int[] {159, 201}) for (int z : new int[] {13, -7}) {
            box(x - 2, 63, z - 3, x + 2, 63, z + 3, Material.LAVA);
            box(x - 3, 64, z - 4, x + 3, 64, z + 4, Material.BASALT);
            box(x - 2, 64, z - 3, x + 2, 64, z + 3, Material.ORANGE_STAINED_GLASS);
        }
        for (int x : new int[] {150, 210, 145, 215}) for (int z : new int[] {5, -18, 29}) {
            column(x, 65, z, 7, Material.CRIMSON_STEM);
            canopy(x, 72, z, 3, Material.NETHER_WART_BLOCK);
            set(x, 69, z + 1, Material.SHROOMLIGHT);
        }
        for (int x : new int[] {169, 191}) {
            column(x, 65, -31, 13, Material.BASALT);
            column(x, 78, -31, 6, Material.RED_NETHER_BRICKS);
            set(x, 84, -31, eerie ? Material.SOUL_FIRE : Material.FIRE);
        }
        box(169, 77, -31, 191, 78, -31, Material.POLISHED_BLACKSTONE_BRICKS);
        for (int x = 174; x <= 186; x += 3) {
            column(x, 79, -31, 5 - Math.abs(180 - x) / 3, Material.GILDED_BLACKSTONE);
            set(x, 78, -31, Material.SHROOMLIGHT);
        }
    }

    private void sunkenArchive(boolean eerie) {
        for (int x : new int[] {159, 201}) {
            box(x - 2, 63, -44, x + 2, 63, 31, Material.WATER);
            box(x - 2, 64, -44, x + 2, 64, 31, Material.LIGHT_BLUE_STAINED_GLASS);
            for (int z = -41; z < 32; z += 9) set(x, 63, z, Material.SEA_LANTERN);
        }
        for (int z : new int[] {25, 7, -12, -31}) for (int x : new int[] {164, 196}) {
            column(x, 65, z, 10, Material.PRISMARINE_BRICKS);
            box(x - 1, 74, z - 1, x + 1, 75, z + 1, Material.DARK_PRISMARINE);
            set(x, 76, z, Material.SEA_LANTERN);
        }
        for (int x : new int[] {163, 197}) for (int z : new int[] {13, -5, -24}) {
            box(x - 1, 65, z - 3, x + 1, 69, z + 3, Material.BOOKSHELF);
            box(x - 1, 70, z - 3, x + 1, 70, z + 3, Material.WAXED_OXIDIZED_COPPER);
        }
        for (int z : new int[] {7, -12, -31}) {
            box(164, 75, z, 196, 76, z, Material.DARK_PRISMARINE);
            box(169, 77, z, 191, 77, z, Material.OXIDIZED_CUT_COPPER);
        }
        box(168, 72, -32, 192, 75, -32, Material.CYAN_STAINED_GLASS);
        for (int x = 169; x <= 191; x += 4) column(x, 72, -32, 5, eerie ? Material.CRYING_OBSIDIAN : Material.SEA_LANTERN);
    }

    private void skyMonastery(boolean eerie) {
        for (int x : new int[] {158, 202}) for (int z : new int[] {25, -25}) {
            box(x - 4, 64, z - 4, x + 4, 64, z + 4, Material.SMOOTH_QUARTZ);
            for (int dx : new int[] {-3, 3}) for (int dz : new int[] {-3, 3}) column(x + dx, 65, z + dz, 9, Material.QUARTZ_PILLAR);
            for (int tier = 0; tier < 4; tier++) box(x - 5 + tier, 74 + tier * 2, z - 5 + tier, x + 5 - tier, 74 + tier * 2, z + 5 - tier, Material.PURPUR_BLOCK);
            column(x, 81, z, 4, Material.END_ROD);
        }
        for (int z : new int[] {16, -5, -24}) {
            for (int x : new int[] {168, 192}) {
                column(x, 65, z, 8, Material.QUARTZ_PILLAR);
                set(x, 73, z, Material.WAXED_COPPER_BLOCK);
                set(x, 74, z, Material.LIGHTNING_ROD);
            }
            box(168, 72, z, 192, 72, z, Material.SMOOTH_QUARTZ);
            for (int x : new int[] {171, 177, 183, 189}) {
                set(x, 71, z, Material.IRON_CHAIN);
                set(x, 70, z, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
            }
        }
        for (int x : new int[] {146, 210}) for (int z : new int[] {16, -10, -32}) {
            canopy(x, 70, z, 4, Material.WHITE_WOOL);
            canopy(x + 4, 71, z + 2, 3, Material.WHITE_WOOL);
        }
        box(171, 69, -32, 189, 69, -32, Material.YELLOW_STAINED_GLASS);
        box(175, 70, -32, 185, 75, -32, Material.YELLOW_STAINED_GLASS);
        set(180, 73, -31, Material.SEA_LANTERN);
    }

    private void thornwild(boolean eerie) {
        for (int x : new int[] {158, 202}) for (int z : new int[] {27, 10, -10, -29}) {
            box(x - 1, 65, z - 1, x + 1, 73, z + 1, Material.MANGROVE_WOOD);
            column(x + (x < 180 ? 2 : -2), 70, z, 6, Material.MANGROVE_WOOD);
            canopy(x, 76, z, 5, eerie ? Material.DARK_OAK_LEAVES : Material.MANGROVE_LEAVES);
            set(x, 72, z + 2, Material.OCHRE_FROGLIGHT);
        }
        for (int z : new int[] {20, -10, -31}) {
            for (int x : new int[] {170, 190}) {
                column(x, 65, z, 7, Material.STRIPPED_MANGROVE_WOOD);
                canopy(x, 72, z, 3, Material.MOSS_BLOCK);
            }
            box(170, 72, z, 190, 73, z, Material.MANGROVE_ROOTS);
            for (int x : new int[] {174, 180, 186}) set(x, 71, z, Material.PEARLESCENT_FROGLIGHT);
        }
        for (int x : new int[] {162, 198}) for (int z : new int[] {18, -4, -25}) {
            box(x - 2, 64, z - 3, x + 2, 64, z + 3, Material.ROOTED_DIRT);
            for (int dx : new int[] {-2, 2}) for (int dz : new int[] {-2, 2}) {
                set(x + dx, 65, z + dz, Material.AZALEA);
            }
        }
        box(168, 65, -32, 192, 67, -32, Material.MANGROVE_ROOTS);
        canopy(180, 78, -32, 6, eerie ? Material.DARK_OAK_LEAVES : Material.FLOWERING_AZALEA_LEAVES);
        column(170, 68, -32, 10, Material.MANGROVE_WOOD);
        column(190, 68, -32, 10, Material.MANGROVE_WOOD);
    }

    private void bastion(int x, int z, int height, Material wall, Material trim) {
        for (int y = 65; y < 65 + height; y++) for (int dx = -3; dx <= 3; dx++) for (int dz = -3; dz <= 3; dz++) {
            if (Math.abs(dx) == 3 || Math.abs(dz) == 3) set(x + dx, y, z + dz, wall);
        }
        box(x - 4, 65 + height, z - 4, x + 4, 65 + height, z + 4, trim);
        for (int dx = -4; dx <= 4; dx += 2) for (int dz : new int[] {-4, 4}) column(x + dx, 66 + height, z + dz, 2, wall);
        for (int dx : new int[] {-3, 3}) box(x + dx, 70, z - 1, x + dx, 78, z + 1, Material.ORANGE_STAINED_GLASS);
        set(x, 66 + height, z, Material.SHROOMLIGHT);
    }

    private void canopy(int x, int y, int z, int radius, Material material) {
        for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) for (int dy = -2; dy <= 2; dy++) {
            if (dx * dx + dz * dz + dy * dy * 3 > radius * radius) continue;
            int bx = x + dx, by = y + dy, bz = z + dz;
            if (material.name().endsWith("_LEAVES")) {
                checkBounds(bx, by, bz);
                edits.add(() -> {
                    Block block = world.getBlockAt(bx, by, bz); block.setType(material, false);
                    Leaves data = (Leaves) block.getBlockData(); data.setPersistent(true); block.setBlockData(data, false);
                });
            } else set(bx, by, bz, material);
        }
    }

    private void inscription(int x, int z, String heading, String text) {
        List<String> lines = new ArrayList<>();
        String line = "";
        for (String word : text.split(" ")) {
            if (!line.isEmpty() && line.length() + word.length() + 1 > 18) { lines.add(line); line = ""; }
            line += (line.isEmpty() ? "" : " ") + word;
        }
        if (!line.isEmpty()) lines.add(line);
        for (int start = 0; start < lines.size(); start += 3) {
            int bx = x + start;
            // A continuous reading apron keeps shelves and roots out of the signs' approach.
            box(bx - 1, 64, z + 1, bx + 1, 64, z + 2, realm.ground);
            box(bx - 1, 65, z + 1, bx + 1, 67, z + 2, Material.AIR);
            set(bx, 65, z, realm.trim);
            sign(bx, 66, z, BlockFace.SOUTH, start == 0 ? heading : "...continued", lines.get(start), start + 1 < lines.size() ? lines.get(start + 1) : "", start + 2 < lines.size() ? lines.get(start + 2) : "");
        }
    }

    public void celebrate() {
        if (celebrated || busy) return;
        begin();
        celebrated = true;
        bunting(-7, -7, 7, -7);
        bunting(-7, 5, 7, 5);
        for (int x : new int[] {-8, 8}) for (int z : new int[] {-9, 0, 9}) {
            set(x, 65, z, Material.FLOWER_POT);
            set(x, 65, z + 1, Material.PINK_TULIP);
        }
        sign(3, 65, -3, BlockFace.SOUTH, "ELIN IS HOME", "The village remembers", "You changed this story", "Thank you, traveler");
        run(() -> world.getPlayers().stream().filter(p -> p.getLocation().distanceSquared(villageSpawn()) < 10000)
                .forEach(p -> p.sendTitle("§6Everafter remembers", "§fA sister home. A story changed.", 15, 90, 25)));
    }

    private void terrain(int cx, int cz, int radius, boolean eerie) {
        Random random = new Random(cx + 7941L);
        for (int x = -radius; x <= radius; x++) for (int z = -radius; z <= radius; z++) {
            double r = Math.hypot(x, z);
            if (r > radius) continue;
            set(cx + x, 63, cz + z, Material.DIRT);
            Material grass = eerie && random.nextInt(7) == 0 ? Material.PODZOL : Material.GRASS_BLOCK;
            set(cx + x, 64, cz + z, grass);
            if (r > radius - 7 && !(Math.abs(x) < 8 && z < 0)) {
                int height = Math.max(0, (int) (Math.sin((r - radius + 7) * Math.PI / 7) * (2 + (Math.sin(x * .23) + Math.cos(z * .19)))));
                for (int y = 65; y <= 64 + height; y++) set(cx + x, y, cz + z, y == 64 + height ? grass : Material.DIRT);
            } else if (r > 8 && random.nextInt(24) == 0) {
                Material[] flowers = eerie ? new Material[] {Material.DEAD_BUSH, Material.FERN, Material.BROWN_MUSHROOM}
                        : new Material[] {Material.AZURE_BLUET, Material.CORNFLOWER, Material.PINK_TULIP, Material.FERN};
                set(cx + x, 65, cz + z, flowers[random.nextInt(flowers.length)]);
            }
        }
    }

    private void house(int cx, int cz, int rx, int rz, Material plaster, Material roof, String name, String subtitle) {
        box(cx - rx - 1, 64, cz - rz - 1, cx + rx + 1, 64, cz + rz + 2, Material.COBBLESTONE);
        box(cx - rx + 1, 64, cz - rz + 1, cx + rx - 1, 64, cz + rz - 1, Material.SPRUCE_PLANKS);
        box(cx - rx, 65, cz - rz, cx + rx, 69, cz + rz, plaster);
        box(cx - rx + 1, 65, cz - rz + 1, cx + rx - 1, 69, cz + rz - 1, Material.AIR);
        for (int x : new int[] {cx - rx, cx, cx + rx}) for (int z : new int[] {cz - rz, cz + rz}) column(x, 65, z, 5, Material.STRIPPED_SPRUCE_LOG);
        for (int z : new int[] {cz - rz, cz + rz}) box(cx - rx, 69, z, cx + rx, 69, z, Material.DARK_OAK_WOOD);
        for (int x : new int[] {cx - rx, cx + rx}) box(x, 69, cz - rz, x, 69, cz + rz, Material.DARK_OAK_WOOD);
        for (int z : new int[] {cz - rz, cz + rz}) for (int x : new int[] {cx - 3, cx + 3}) {
            box(x - 1, 66, z, x + 1, 67, z, Material.LIGHT_BLUE_STAINED_GLASS);
            set(x, 65, z + (z > cz ? 1 : -1), Material.SPRUCE_TRAPDOOR);
        }
        for (int x : new int[] {cx - rx, cx + rx}) box(x, 66, cz - 1, x, 67, cz + 1, Material.LIGHT_BLUE_STAINED_GLASS);
        box(cx, 65, cz + rz, cx, 67, cz + rz, Material.AIR);
        path(cx, cz + rz + 1, cx, cz + rz + 4, 1, false);
        for (int offset = -rx - 1; offset <= rx + 1; offset++) {
            int roofY = 70 + rx - Math.abs(offset);
            BlockFace face = offset < 0 ? BlockFace.EAST : BlockFace.WEST;
            for (int z = cz - rz - 1; z <= cz + rz + 1; z++) {
                if (offset == 0) set(cx, roofY, z, Material.DARK_OAK_SLAB);
                else stairs(cx + offset, roofY, z, roof, face);
            }
            if (Math.abs(offset) <= rx) for (int y = 70; y < roofY; y++) {
                set(cx + offset, y, cz - rz, plaster);
                set(cx + offset, y, cz + rz, plaster);
            }
        }
        set(cx, 71, cz + rz, Material.SEA_LANTERN);
        box(cx + rx - 2, 69, cz - 2, cx + rx - 1, 77, cz - 1, Material.BRICKS);
        set(cx + rx - 2, 78, cz - 2, Material.CAMPFIRE);
        set(cx - rx + 2, 65, cz - rz + 2, Material.CRAFTING_TABLE);
        set(cx + rx - 2, 65, cz - rz + 2, Material.BARREL);
        set(cx, 68, cz, Material.LANTERN);
        set(cx - rx + 2, 65, cz, Material.BOOKSHELF);
        sign(cx + 2, 65, cz + rz + 2, BlockFace.SOUTH, name, subtitle, "Welcome inside", "");
    }

    private void tree(int x, int y, int z, Material leaves, int height) {
        column(x, y, z, height, Material.OAK_LOG);
        column(x + 1, y + height - 3, z, 2, Material.OAK_LOG);
        for (int dy = -3; dy <= 2; dy++) for (int dx = -4; dx <= 4; dx++) for (int dz = -4; dz <= 4; dz++) {
            if (dx * dx + dz * dz + dy * dy * 1.6 > 18 || (dx == 0 && dz == 0 && dy < 0)) continue;
            BlockData data = Bukkit.createBlockData(leaves);
            ((Leaves) data).setPersistent(true);
            set(x + dx, y + height - 1 + dy, z + dz, data);
        }
        for (int dx : new int[] {-2, 2}) set(x + dx, y + height - 4, z, Material.LANTERN);
    }

    private void arch(int x, int z, boolean eerie, boolean home) {
        Material stone = eerie ? Material.POLISHED_BLACKSTONE_BRICKS : Material.MOSSY_STONE_BRICKS;
        plaza(x, z, 5, Material.STONE_BRICKS);
        for (int dx : new int[] {-3, 3}) {
            box(x + dx - 1, 65, z, x + dx + 1, 65, z, stone);
            column(x + dx, 66, z, 6, stone);
            set(x + dx, 72, z, Material.CHISELED_STONE_BRICKS);
            set(x + dx, 73, z, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
        }
        box(x - 2, 71, z, x + 2, 71, z, stone);
        box(x - 1, 72, z, x + 1, 72, z, stone);
        set(x, 73, z, Material.SEA_LANTERN);
        set(x, 74, z, Material.AMETHYST_BLOCK);
        // An open frame is traversable and cannot create a vanilla Nether portal.
        for (int dx = -2; dx <= 2; dx++) set(x + dx, 64, z, home ? Material.WAXED_COPPER_BLOCK : Material.AMETHYST_BLOCK);
    }

    private void ruin(int x, int z, boolean eerie, int height) {
        Material stone = eerie ? Material.CRACKED_DEEPSLATE_BRICKS : Material.MOSSY_STONE_BRICKS;
        box(x - 1, 64, z - 1, x + 1, 64, z + 1, stone);
        column(x, 65, z, height, stone);
        set(x + 1, 65, z, Material.COBBLESTONE_WALL);
        set(x, 65 + height, z, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
        set(x - 2, 65, z + 1, Material.MOSSY_COBBLESTONE_SLAB);
    }

    private void path(int x1, int z1, int x2, int z2, int halfWidth, boolean eerie) {
        int length = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
        for (int i = 0; i <= length; i++) {
            int x = x1 + (length == 0 ? 0 : (int) Math.round((x2 - x1) * (double) i / length));
            int z = z1 + (length == 0 ? 0 : (int) Math.round((z2 - z1) * (double) i / length));
            for (int dx = -halfWidth; dx <= halfWidth; dx++) for (int dz = -halfWidth; dz <= halfWidth; dz++) {
                Material material = Math.floorMod(x + dx + (z + dz) * 7, 6) == 0 ? Material.GRAVEL
                        : eerie ? Material.COBBLED_DEEPSLATE : Material.PACKED_MUD;
                set(x + dx, 64, z + dz, material);
                box(x + dx, 65, z + dz, x + dx, 67, z + dz, Material.AIR);
            }
        }
    }

    private void plaza(int x, int z, int radius, Material material) {
        for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dz * dz > radius * radius) continue;
            set(x + dx, 64, z + dz, dx * dx + dz * dz > (radius - 1) * (radius - 1) ? Material.STONE_BRICKS : material);
            set(x + dx, 65, z + dz, Material.AIR);
        }
    }

    private void pond(int x, int z, int radius, boolean eerie) {
        for (int dx = -radius; dx <= radius; dx++) for (int dz = -radius; dz <= radius; dz++) {
            int d = dx * dx + dz * dz;
            if (d > radius * radius) continue;
            set(x + dx, 62, z + dz, Material.CLAY);
            set(x + dx, 63, z + dz, d < (radius - 1) * (radius - 1) ? Material.WATER : Material.MOSSY_COBBLESTONE);
            set(x + dx, 64, z + dz, d < (radius - 1) * (radius - 1) ? Material.AIR : Material.MOSS_BLOCK);
            set(x + dx, 65, z + dz, Material.AIR);
            if (d < (radius - 2) * (radius - 2) && Math.floorMod(dx * 5 + dz * 3, 11) == 0) set(x + dx, 64, z + dz, Material.LILY_PAD);
        }
        for (int dz : new int[] {-2, 1, 3}) set(x, 63, z + dz, eerie ? Material.SCULK : Material.SEA_LANTERN);
    }

    private void fountain(int x, int z) {
        plaza(x, z, 4, Material.STONE_BRICKS);
        for (int dx = -2; dx <= 2; dx++) for (int dz = -2; dz <= 2; dz++) {
            if (Math.abs(dx) == 2 || Math.abs(dz) == 2) set(x + dx, 65, z + dz, Material.STONE_BRICK_SLAB);
            else set(x + dx, 64, z + dz, Material.WATER);
        }
        column(x, 64, z, 4, Material.CHISELED_STONE_BRICKS);
        set(x, 68, z, Material.WATER);
        for (int dx : new int[] {-1, 1}) set(x + dx, 67, z, Material.STONE_BRICK_SLAB);
        for (int dz : new int[] {-1, 1}) set(x, 67, z + dz, Material.STONE_BRICK_SLAB);
    }

    private void lamp(int x, int z, boolean eerie) {
        set(x, 65, z, Material.STONE_BRICK_WALL);
        column(x, 66, z, 3, Material.SPRUCE_FENCE);
        set(x, 69, z, Material.SPRUCE_SLAB);
        set(x + 1, 69, z, Material.SPRUCE_SLAB);
        set(x + 1, 68, z, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
    }

    private void market(int x, int z, Material color) {
        box(x - 2, 64, z - 2, x + 2, 64, z + 2, Material.SPRUCE_PLANKS);
        for (int dx : new int[] {-2, 2}) for (int dz : new int[] {-1, 1}) column(x + dx, 65, z + dz, 3, Material.SPRUCE_FENCE);
        for (int dx = -3; dx <= 3; dx++) box(x + dx, 68, z - 2, x + dx, 68, z + 2, dx % 2 == 0 ? color : Material.WHITE_WOOL);
        box(x - 1, 65, z, x + 1, 65, z, Material.BARREL);
        set(x, 66, z, Material.MELON);
        set(x - 1, 66, z, Material.PUMPKIN);
        set(x + 1, 66, z, Material.FLOWER_POT);
        set(x, 67, z - 1, Material.LANTERN);
    }

    private void garden(int x, int z) {
        for (int dx = -4; dx <= 4; dx++) for (int dz = -3; dz <= 3; dz++) {
            set(x + dx, 64, z + dz, Material.MOSS_BLOCK);
            set(x + dx, 65, z + dz, (dx == -4 || dx == 4 || dz == -3 || dz == 3) ? Material.OAK_FENCE : Material.PINK_TULIP);
        }
        box(x - 1, 65, z + 3, x + 1, 65, z + 3, Material.AIR);
        set(x, 65, z, Material.BEEHIVE);
    }

    private void bench(int x, int z, BlockFace face) {
        for (int dx = -1; dx <= 1; dx++) stairs(x + dx, 65, z, Material.SPRUCE_STAIRS, face);
        set(x - 2, 65, z, Material.SPRUCE_SIGN);
        set(x + 2, 65, z, Material.SPRUCE_SIGN);
    }

    private void bunting(int x1, int z1, int x2, int z2) {
        column(x1, 65, z1, 6, Material.SPRUCE_FENCE);
        column(x2, 65, z2, 6, Material.SPRUCE_FENCE);
        Material[] colors = {Material.RED_WOOL, Material.YELLOW_WOOL, Material.LIGHT_BLUE_WOOL};
        for (int x = x1 + 1; x < x2; x++) {
            set(x, 70, z1, Material.IRON_CHAIN);
            if (x % 2 == 0) set(x, 69, z1, colors[Math.floorMod(x, colors.length)]);
        }
    }

    private Location at(int x, int y, int z, float yaw) { return new Location(world, x + .5, y, z + .5, yaw, 0); }

    private void column(int x, int y, int z, int height, Material material) {
        box(x, y, z, x, y + height - 1, z, material);
    }

    private void box(int x1, int y1, int z1, int x2, int y2, int z2, Material material) {
        for (int x = x1; x <= x2; x++) for (int y = y1; y <= y2; y++) for (int z = z1; z <= z2; z++) set(x, y, z, material);
    }

    private void stairs(int x, int y, int z, Material material, BlockFace face) {
        Stairs data = (Stairs) Bukkit.createBlockData(material);
        data.setFacing(face);
        set(x, y, z, data);
    }

    private void set(int x, int y, int z, Material material) {
        checkBounds(x, y, z);
        edits.add(() -> world.getBlockAt(x, y, z).setType(material, false));
    }

    private void set(int x, int y, int z, BlockData data) {
        checkBounds(x, y, z);
        edits.add(() -> world.getBlockAt(x, y, z).setBlockData(data, false));
    }

    @SuppressWarnings("deprecation")
    private void sign(int x, int y, int z, BlockFace facing, String... lines) {
        checkBounds(x, y, z);
        edits.add(() -> {
            Block block = world.getBlockAt(x, y, z);
            block.setType(Material.SPRUCE_SIGN, false);
            if (block.getState() instanceof Sign sign) {
                org.bukkit.block.data.Rotatable data = (org.bukkit.block.data.Rotatable) block.getBlockData();
                data.setRotation(facing);
                block.setBlockData(data, false);
                sign = (Sign) block.getState();
                for (int i = 0; i < Math.min(4, lines.length); i++) sign.setLine(i, lines[i]);
                sign.setColor(org.bukkit.DyeColor.WHITE);
                sign.setGlowingText(true);
                sign.setWaxed(true);
                sign.update(true, false);
            }
        });
    }

    private void checkBounds(int x, int y, int z) {
        boolean village = Math.abs(x) <= 59 && Math.abs(z) <= 59;
        boolean adventure = Math.abs(x - 180) <= 54 && Math.abs(z) <= 54;
        if ((!village && !adventure) || y < 62 || y > 90) throw new IllegalArgumentException("World edit outside dedicated stage");
    }

    private void begin() {
        if (!Bukkit.isPrimaryThread()) throw new IllegalStateException("Build worlds on the main server thread");
        if (busy) throw new IllegalStateException("Another world build is in progress");
        edits.clear();
        busy = true;
    }

    private void run(Runnable onComplete) {
        new BukkitRunnable() {
            @Override public void run() {
                try {
                    for (int i = 0; i < BLOCKS_PER_TICK && !edits.isEmpty(); i++) edits.removeFirst().run();
                    if (edits.isEmpty()) {
                        busy = false;
                        cancel();
                        onComplete.run();
                    }
                } catch (RuntimeException failure) {
                    edits.clear();
                    busy = false;
                    cancel();
                    plugin.getLogger().severe("Everafter world build failed: " + failure.getMessage());
                    throw failure;
                }
            }
        }.runTaskTimer(plugin, 1L, 1L);
    }
}
