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
    private final List<Location> runes = new ArrayList<>();
    private boolean busy;
    private boolean adventureBuilt;
    private boolean celebrated;
    private boolean combat;

    public WorldBuilder(JavaPlugin plugin, World world) {
        this.plugin = plugin;
        this.world = world;
    }

    public boolean isBusy() { return busy; }
    public Location villageSpawn() { return at(0, 65, 0, 180); }
    public Location maraLocation() { return at(0, 65, -10, 0); }
    public Location orenLocation() { return at(-12, 65, 0, -90); }
    public Location gateLocation() { return at(0, 65, -38, 180); }
    public Location adventureSpawn() { return at(180, 65, 29, 180); }
    public Location returnLocation() { return at(180, 65, 34, 0); }
    public Location elinLocation() { return at(180, 65, combat ? -19 : -23, 0); }
    public List<Location> enemySpawns() { return enemies.stream().map(Location::clone).toList(); }
    public List<Location> runeLocations() { return runes.stream().map(Location::clone).toList(); }

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
        if (!List.of("mystery", "combat").contains(route) || !List.of("eerie", "wonder").contains(mood)
                || difficulty < 1 || difficulty > 3) throw new IllegalArgumentException("Invalid adventure choices");
        if (adventureBuilt) throw new IllegalStateException("Adventure has already been built");
        begin();
        combat = route.equals("combat");
        boolean eerie = mood.equals("eerie");
        terrain(180, 0, 48, eerie);
        for (int i = 0; i < 22; i++) {
            double a = i * Math.PI * 2 / 22;
            int x = 180 + (int) Math.round(Math.cos(a) * 39);
            int z = (int) Math.round(Math.sin(a) * 39);
            if (Math.abs(x - 180) < 9 && z > 0) continue;
            tree(x, 65, z, eerie ? Material.SPRUCE_LEAVES : Material.CHERRY_LEAVES, 7 + i % 4);
        }
        path(180, 35, 180, -27, 2, eerie);
        arch(180, 35, eerie, true);
        sign(184, 65, 31, BlockFace.SOUTH, "WAY HOME", "Return to Everafter", "/everafter home", "Bring Elin back");
        if (combat) buildTower(eerie, difficulty); else buildGarden(eerie);
        for (int z : new int[] {23, 13, 2, -9}) {
            lamp(176, z, eerie);
            lamp(184, z, eerie);
        }
        validateAdventure();
        adventureBuilt = true;
        run(onComplete);
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

    private void buildGarden(boolean eerie) {
        pond(204, -16, 7, eerie);
        path(180, 16, 165, 8, 1, eerie);
        path(165, 8, 176, -10, 1, eerie);
        path(180, 12, 196, 3, 1, eerie);
        path(196, 3, 187, -13, 1, eerie);
        plaza(180, -23, 7, eerie ? Material.DEEPSLATE_BRICKS : Material.MOSSY_STONE_BRICKS);
        rune(165, 8, "I - REMEMBRANCE", eerie);
        rune(196, 3, "II - PROMISE", eerie);
        rune(176, -10, "III - HOMECOMING", eerie);
        for (int x : new int[] {173, 187}) {
            column(x, 65, -26, 8, eerie ? Material.DEEPSLATE_BRICKS : Material.MOSSY_STONE_BRICKS);
            set(x, 73, -26, Material.CHISELED_STONE_BRICKS);
            set(x, 74, -26, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
        }
        box(173, 72, -26, 187, 73, -26, eerie ? Material.POLISHED_DEEPSLATE : Material.STONE_BRICKS);
        box(176, 74, -26, 184, 74, -26, Material.CHISELED_STONE_BRICKS);
        set(180, 75, -26, Material.SEA_LANTERN);
        set(180, 76, -26, Material.AMETHYST_BLOCK);
        set(180, 77, -26, Material.LIGHTNING_ROD);
        // Elin stands on the floor inside the open arch, with a full-width approach.
        for (int x : new int[] {171, 189}) for (int z : new int[] {-18, -29}) ruin(x, z, eerie, 3 + Math.abs(z % 4));
        tree(160, 65, -23, eerie ? Material.SPRUCE_LEAVES : Material.CHERRY_LEAVES, 10);
        tree(198, 65, -29, eerie ? Material.SPRUCE_LEAVES : Material.CHERRY_LEAVES, 9);
        sign(184, 65, 22, BlockFace.SOUTH, eerie ? "THE HUSHED GARDEN" : "THE STARLIT GARDEN", "Awaken three runes", "Right-click each marker", "Then speak to Elin");
        sign(184, 65, -20, BlockFace.SOUTH, "ELIN'S REFUGE", "Three lights guide her", "back to the living", "Right-click to rescue");
    }

    private void buildTower(boolean eerie, int difficulty) {
        Material wall = eerie ? Material.DEEPSLATE_BRICKS : Material.STONE_BRICKS;
        Material accent = eerie ? Material.POLISHED_BLACKSTONE_BRICKS : Material.MOSSY_STONE_BRICKS;
        plaza(180, -4, 12, accent);
        // The courtyard and tower are on one level, so combat and rescue cannot be gated by a jump.
        box(170, 64, -28, 190, 64, -13, wall);
        for (int y = 65; y <= 78; y++) {
            for (int x = 173; x <= 187; x++) for (int z = -28; z <= -14; z++) {
                if (x == 173 || x == 187 || z == -28 || z == -14) set(x, y, z, wall);
            }
        }
        box(178, 65, -14, 182, 69, -14, Material.AIR);
        box(177, 70, -14, 183, 70, -14, accent);
        box(172, 78, -29, 188, 78, -13, accent);
        for (int x = 172; x <= 188; x += 2) for (int z : new int[] {-29, -13}) column(x, 79, z, 2, wall);
        for (int z = -27; z <= -15; z += 2) for (int x : new int[] {172, 188}) column(x, 79, z, 2, wall);
        for (int x : new int[] {173, 187}) for (int z : new int[] {-28, -14}) {
            column(x, 65, z, 15, accent);
            set(x, 80, z, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
        }
        for (int y : new int[] {70, 74}) {
            for (int x : new int[] {173, 187}) box(x, y, -23, x, y + 2, -21, Material.ORANGE_STAINED_GLASS);
            for (int x : new int[] {176, 184}) box(x, y, -14, x, y + 1, -14, Material.ORANGE_STAINED_GLASS);
        }
        box(174, 64, -27, 186, 64, -15, Material.POLISHED_ANDESITE);
        for (int x : new int[] {176, 184}) {
            column(x, 65, -24, 4, Material.IRON_CHAIN);
            set(x, 69, -24, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
        }
        for (int x : new int[] {166, 194}) {
            ruin(x, -8, eerie, 5);
            ruin(x, -21, eerie, 6);
        }
        for (int z : new int[] {-9, 8}) for (int x : new int[] {168, 192}) {
            set(x, 65, z, Material.CHISELED_STONE_BRICKS);
            set(x, 66, z, eerie ? Material.SOUL_CAMPFIRE : Material.CAMPFIRE);
        }
        enemies.add(at(174, 65, 0, 0));
        enemies.add(at(186, 65, -5, 0));
        if (difficulty >= 2) enemies.add(at(180, 65, -10, 0));
        if (difficulty >= 3) enemies.add(at(180, 65, -23, 0));
        sign(184, 65, 22, BlockFace.SOUTH, eerie ? "THE ASHEN WATCH" : "THE AMBER WATCH", "Defeat the guards", "Enter the open tower", "Then speak to Elin");
        sign(184, 65, -17, BlockFace.SOUTH, "ELIN", "The way is open", "when the guards fall", "Right-click to rescue");
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

    private void rune(int x, int z, String name, boolean eerie) {
        plaza(x, z, 3, eerie ? Material.POLISHED_DEEPSLATE : Material.MOSSY_STONE_BRICKS);
        set(x, 65, z, eerie ? Material.CRYING_OBSIDIAN : Material.AMETHYST_BLOCK);
        for (int dx : new int[] {-2, 2}) {
            set(x + dx, 65, z, Material.CHISELED_STONE_BRICKS);
            set(x + dx, 66, z, eerie ? Material.SOUL_LANTERN : Material.LANTERN);
        }
        sign(x, 65, z + 2, BlockFace.SOUTH, name, "RIGHT-CLICK THE", "GLOWING RUNE", "A memory waits");
        runes.add(at(x, 65, z, 0));
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

    private void validateAdventure() {
        if ((!combat && runes.size() != 3) || (combat && enemies.isEmpty())) throw new IllegalStateException("Adventure has no completion targets");
        if (edits.size() > 250000) throw new IllegalStateException("World plan exceeds safe edit budget");
        for (Location location : runes) if (location.distanceSquared(elinLocation()) < 9) throw new IllegalStateException("Rune blocks rescue area");
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
