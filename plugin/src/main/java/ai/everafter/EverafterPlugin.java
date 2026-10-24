package ai.everafter;

import com.google.gson.*;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import io.papermc.paper.event.player.AsyncChatEvent;
import org.bukkit.*;
import org.bukkit.block.Block;
import org.bukkit.boss.*;
import org.bukkit.command.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.player.*;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public final class EverafterPlugin extends JavaPlugin implements Listener {
    private static final String API = "http://127.0.0.1:8765";
    private final Gson gson = new Gson();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final Map<UUID, String> npcs = new HashMap<>();
    private final Set<UUID> guards = new HashSet<>();
    private final Set<Integer> runes = new HashSet<>();
    private final List<TextDisplay> labels = new ArrayList<>();
    private final Deque<DialogueInput> pendingInputs = new ArrayDeque<>();
    private World world;
    private WorldBuilder scenes;
    private BossBar bar;
    private UUID owner;
    private String selectedNpc = "Mara", phase = "village";
    private Decision decision = Decision.fallback();
    private boolean ready, building, built, talking, polling, kitGiven;
    private int guardTotal, ticks;
    private long lastGate;

    @Override public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        Objects.requireNonNull(getCommand("everafter")).setExecutor(this);
        Objects.requireNonNull(getCommand("talk")).setExecutor(this);
        bar = Bukkit.createBossBar("EVERAFTER • Preparing your village…", BarColor.PURPLE, BarStyle.SOLID);
        // shortcut: narrative state lives for one server run; restart creates a fresh, isolated story world.
        world = new WorldCreator("everafter_" + System.currentTimeMillis()).type(WorldType.FLAT)
                .generatorSettings("{\"layers\":[{\"block\":\"minecraft:bedrock\",\"height\":1},{\"block\":\"minecraft:dirt\",\"height\":63},{\"block\":\"minecraft:grass_block\",\"height\":1}],\"biome\":\"minecraft:plains\"}")
                .generateStructures(false).createWorld();
        if (world == null) { getLogger().severe("Could not create the dedicated story world."); Bukkit.getPluginManager().disablePlugin(this); return; }
        world.setGameRule(GameRule.DO_MOB_SPAWNING, false);
        world.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, false);
        world.setGameRule(GameRule.DO_WEATHER_CYCLE, false);
        world.setGameRule(GameRule.KEEP_INVENTORY, true);
        world.setGameRule(GameRule.MOB_GRIEFING, false);
        world.setGameRule(GameRule.DO_FIRE_TICK, false);
        world.setTime(13000); world.setStorm(false); world.setDifficulty(Difficulty.NORMAL);
        world.setSpawnLocation(0, 65, 0);
        scenes = new WorldBuilder(this, world);
        scenes.buildVillage(() -> {
            npc("Mara", scenes.maraLocation(), Villager.Profession.TOOLSMITH);
            npc("Oren", scenes.orenLocation(), Villager.Profession.LIBRARIAN);
            ready = true;
            for (Player player : Bukkit.getOnlinePlayers()) start(player);
            update();
            getLogger().info("EVERAFTER village ready. Join and talk to Mara.");
        });
        Bukkit.getScheduler().runTaskTimer(this, this::heartbeat, 20, 20);
    }

    @Override public void onDisable() {
        if (bar != null) bar.removeAll();
        if (world != null) for (Entity entity : world.getEntities()) if (!(entity instanceof Player)) entity.remove();
        if (world != null) world.removePluginChunkTickets(this);
        http.shutdownNow();
    }

    private void main(Runnable task) { if (isEnabled()) Bukkit.getScheduler().runTask(this, task); }
    private Player player() { return owner == null ? null : Bukkit.getPlayer(owner); }
    private boolean owns(Player p) { return owner != null && owner.equals(p.getUniqueId()); }
    private boolean inStory(Player p) { return p.getWorld().equals(world); }
    private void tell(Player p, String text) { p.sendMessage(Component.text("✦ ", NamedTextColor.GOLD).append(Component.text(text, NamedTextColor.AQUA))); }
    private void say(Player p, String npc, String text) {
        p.sendMessage(Component.text(npc + " › ", NamedTextColor.GOLD).append(Component.text(clean(text, 400), NamedTextColor.WHITE)));
    }
    private void title(Player p, String title, String subtitle) { p.sendTitle(ChatColor.GOLD + title, ChatColor.AQUA + subtitle, 10, 65, 20); }

    private void start(Player p) {
        if (!ready) { tell(p, "The village is being built. You will arrive in a moment."); return; }
        if (owner == null) owner = p.getUniqueId();
        if (!owns(p)) {
            p.teleport(scenes.villageSpawn()); p.setGameMode(GameMode.SPECTATOR);
            tell(p, "This story belongs to another adventurer. You can watch as a spectator."); return;
        }
        p.setGameMode(GameMode.ADVENTURE);
        p.teleport(scenes.villageSpawn());
        p.setRespawnLocation(scenes.villageSpawn(), true);
        p.setFoodLevel(20); p.setHealth(20);
        if (!kitGiven) {
            kitGiven = true;
            p.getInventory().clear();
            p.getInventory().setItem(0, named(Material.IRON_SWORD, "Village Defender"));
            p.getInventory().setItem(1, new ItemStack(Material.BREAD, 24));
            p.getInventory().setItem(2, named(Material.COMPASS, "Story Compass — follows your objective"));
            p.getInventory().setItemInOffHand(new ItemStack(Material.SHIELD));
            p.getInventory().setChestplate(new ItemStack(Material.IRON_CHESTPLATE));
            p.getInventory().setBoots(new ItemStack(Material.IRON_BOOTS));
            title(p, "EVERAFTER", "A village. A missing sister. A world that listens.");
            say(p, "Mara", "My sister Elin vanished beyond the northern crossing. Will you help bring her home?");
            tell(p, "Right-click Mara or Oren. Type in chat or use /talk. Tell them how you want to help.");
            tell(p, "Try: ‘I prefer puzzles, an eerie atmosphere, and protecting villagers.’ Then /everafter go.");
        } else tell(p, "Welcome back. /everafter status shows your next step.");
        bar.addPlayer(p);
        if (phase.equals("rescued")) home(p);
        else { update(); publish(); }
    }

    private ItemStack named(Material material, String text) {
        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta(); meta.displayName(Component.text(text, NamedTextColor.GOLD)); item.setItemMeta(meta); return item;
    }
    private Villager npc(String name, Location location, Villager.Profession profession) {
        Villager npc = world.spawn(location, Villager.class, v -> {
            v.customName(Component.text(name + "  •  right-click to speak", NamedTextColor.GOLD));
            v.setCustomNameVisible(true); v.setAI(false); v.setInvulnerable(true); v.setSilent(true);
            v.setCollidable(false); v.setRemoveWhenFarAway(false); v.setPersistent(true);
            v.setProfession(profession); v.setVillagerType(Villager.Type.TAIGA);
        });
        npcs.put(npc.getUniqueId(), name); return npc;
    }

    @Override public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player p)) { sender.sendMessage("Join Minecraft to play EVERAFTER."); return true; }
        if (command.getName().equalsIgnoreCase("talk")) {
            if (args.length == 0) tell(p, "Use /talk <your words>. Right-click Mara, Oren, or Elin to choose who hears you.");
            else talk(p, String.join(" ", args), selectedNpc);
            return true;
        }
        String action = args.length == 0 ? "help" : args[0].toLowerCase(Locale.ROOT);
        if (action.equals("start")) { start(p); return true; }
        if (!ready) { tell(p, "The village is still being built."); return true; }
        if (!owns(p)) { tell(p, "This is a single-adventurer story; other players can spectate."); return true; }
        switch (action) {
            case "go" -> go(p);
            case "home" -> home(p);
            case "status" -> { tell(p, objective()); tell(p, "Chapter: " + phase + " • route: " + decision.route + " • mood: " + decision.mood + " • challenge: " + decision.difficulty + "/3"); }
            case "reset" -> tell(p, "For a fresh story, run scripts/restart.sh. It restarts the local server and clears narrative memory safely.");
            default -> {
                tell(p, "Chat or /talk <words> speaks to the selected character. Right-click characters to select them.");
                tell(p, "/everafter go — enter the northern crossing. /everafter home — return safely.");
                tell(p, "/everafter status — your objective. Mystery: right-click all three glowing runes. Combat: defeat the guards. Then speak to Elin.");
            }
        }
        return true;
    }

    private void talk(Player p, String message, String npc) {
        if (!owns(p) || !ready) return;
        message = clean(message, 1200);
        if (message.isBlank()) return;
        if (talking) { tell(p, "Your companion is thinking. Please wait a moment before speaking again."); return; }
        if (!Set.of("Mara", "Oren", "Elin").contains(npc) || (npc.equals("Elin") && !built)) npc = "Mara";
        selectedNpc = npc; talking = true;
        String speaker = npc;
        p.sendMessage(Component.text("You → " + speaker + " › " + message, NamedTextColor.GRAY));
        p.sendActionBar(Component.text(speaker + " is listening…", NamedTextColor.GOLD));
        Map<String, Object> payload = snapshot();
        payload.put("message", message); payload.put("npc", speaker);
        payload.put("worldFacts", Map.of("ElinRescued", phase.equals("rescued") || phase.equals("complete"), "runesActivated", runes.size(), "guardsRemaining", guards.size(), "areaCommitted", built || building, "objective", objective()));
        String requestPhase = phase;
        publish();
        request("/api/director", "POST", gson.toJson(payload)).whenComplete((body, error) -> main(() -> {
            talking = false;
            if (!canDeliver(requestPhase, phase)) { publish(); return; }
            Player current = player();
            Decision answer = error == null ? Decision.parse(body, phase, decision) : Decision.fallback(phase, decision);
            if (phase.equals("village") && !built && !building) decision = answer;
            if (current != null) {
                tell(current, answer.source.equals("mubit") ? "[Mubit director]" : "[Local fallback — Mubit unavailable]");
                say(current, speaker, answer.dialogue);
                if (!built && !building) tell(current, "Next chapter: " + decision.route + " • " + decision.mood + " • " + decision.difficulty + "/3. Enter the northern crossing or /everafter go.");
            }
            update(); publish();
        }));
    }

    private CompletableFuture<String> request(String path, String method, String body) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(API + path)).timeout(Duration.ofSeconds(path.equals("/api/director") ? 22 : 3));
        if (method.equals("POST")) builder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body));
        else builder.GET();
        return http.sendAsync(builder.build(), HttpResponse.BodyHandlers.ofString()).thenApply(response -> {
            if (response.statusCode() != 200 || response.body().length() > 65536) throw new IllegalStateException("Invalid local director response");
            return response.body();
        });
    }

    private void go(Player p) {
        if (building) { tell(p, "The next chapter is forming. You will travel when it is ready."); return; }
        if (talking) { tell(p, "Wait for your companion's reply, then enter the crossing."); return; }
        if (phase.equals("complete")) { tell(p, "Elin is safe at home. Your village remembers what you did."); return; }
        if (built) { p.teleport(scenes.adventureSpawn()); update(); return; }
        building = true;
        tell(p, "The crossing opens into a " + decision.mood + " " + decision.route + " chapter…");
        title(p, "THE CROSSING", decision.route.equals("mystery") ? "Three echoes hold the way shut." : "The watch has fallen to shadow.");
        scenes.buildAdventure(decision.route, decision.mood, decision.difficulty, () -> {
            building = false; built = true; phase = "adventure";
            pinAdventure(world, this);
            npc("Elin", scenes.elinLocation(), Villager.Profession.NONE);
            if (decision.route.equals("combat")) spawnGuards();
            else for (int i = 0; i < scenes.runeLocations().size(); i++) {
                int index = i;
                labels.add(world.spawn(scenes.runeLocations().get(i).clone().add(0, 1.8, 0), TextDisplay.class, text -> {
                    text.text(Component.text("✧ Echo " + (index + 1) + " — right-click", NamedTextColor.AQUA)); text.setBillboard(Display.Billboard.CENTER); text.setSeeThrough(true);
                }));
            }
            Player current = player();
            if (current != null) { current.teleport(scenes.adventureSpawn()); tell(current, objective()); tell(current, "Your compass follows the next objective. /everafter home is always available."); }
            update(); publish();
        });
    }

    static void pinAdventure(World world, Plugin plugin) {
        // Keep tracked NPCs and live guards available when the adventurer returns home or reconnects.
        for (int x = Math.floorDiv(125, 16); x <= Math.floorDiv(235, 16); x++)
            for (int z = Math.floorDiv(-55, 16); z <= Math.floorDiv(55, 16); z++) world.addPluginChunkTicket(x, z, plugin);
    }

    private void spawnGuards() {
        List<Location> spawns = scenes.enemySpawns();
        guardTotal = 3 + decision.difficulty * 2;
        for (int i = 0; i < guardTotal; i++) {
            Location spot = spawns.isEmpty() ? scenes.adventureSpawn().clone().add(0, 0, -10) : spawns.get(i % spawns.size());
            Zombie guard = world.spawn(spot.clone().add((i / Math.max(1, spawns.size())) * .6, 0, 0), Zombie.class, z -> {
                z.customName(Component.text("Hollow Watcher", NamedTextColor.RED)); z.setCustomNameVisible(true);
                z.setBaby(false); z.setCanPickupItems(false); z.setShouldBurnInDay(false); z.setRemoveWhenFarAway(false);
                z.setHealth(10 + decision.difficulty * 3); z.setTarget(player());
                z.getEquipment().setHelmet(new ItemStack(Material.LEATHER_HELMET)); z.getEquipment().setHelmetDropChance(0);
            });
            guards.add(guard.getUniqueId());
        }
    }

    private boolean unlocked() { return built && (decision.route.equals("mystery") ? runes.size() == 3 : guards.isEmpty()); }
    private void rescue(Player p) {
        if (!phase.equals("adventure")) {
            say(p, "Elin", phase.equals("rescued") ? "The way home is open. Take the southern return arch, and I will follow you." : "You brought me home. Thank you for listening to our village."); return;
        }
        if (!unlocked()) { say(p, "Elin", decision.route.equals("mystery") ? "The three echo-stones bind this place. Touch every glowing rune, then come back." : "The Hollow Watchers still hold the ruins. Defeat them, then I can leave."); return; }
        phase = "rescued";
        say(p, "Elin", "You found me! I thought the village had forgotten. Let's go home together.");
        title(p, "ELIN IS SAFE", "Return through the southern arch, or /everafter home.");
        p.playSound(p.getLocation(), Sound.UI_TOAST_CHALLENGE_COMPLETE, 1, 1);
        update(); publish();
    }
    private void home(Player p) {
        p.teleport(scenes.villageSpawn()); p.setHealth(20); p.setFoodLevel(20);
        if (phase.equals("rescued")) {
            phase = "complete";
            for (Map.Entry<UUID, String> entry : npcs.entrySet()) if (entry.getValue().equals("Elin")) {
                Entity elin = Bukkit.getEntity(entry.getKey()); if (elin != null) elin.teleport(scenes.maraLocation().clone().add(2, 0, 1));
            }
            scenes.celebrate();
            world.setTime(1000);
            title(p, "A VILLAGE REMEMBERS", decision.route.equals("mystery") ? "Curiosity brought her home." : "Courage brought her home.");
            say(p, "Mara", "Elin! You're home. Every lantern in this village is lit for you, " + p.getName() + ".");
            tell(p, "Your choices shaped a " + decision.mood + " " + decision.route + " chapter. Talk to Mara or Oren about what happened.");
            p.playSound(p.getLocation(), Sound.UI_TOAST_CHALLENGE_COMPLETE, 1, .8f);
        } else tell(p, built ? "You are safe at home. /everafter go returns to your unfinished chapter." : "Talk to Mara or Oren, then enter the northern crossing.");
        selectedNpc = "Mara"; update(); publish();
    }

    private String objective() {
        if (building) return "The next chapter is forming…";
        return switch (phase) {
            case "complete" -> "Elin is home • Your village remembers";
            case "rescued" -> "Bring Elin home • southern return arch or /everafter home";
            case "adventure" -> unlocked() ? "Elin is free • Follow your compass and right-click her" : decision.route.equals("mystery") ? "Awaken the echo-stones • " + runes.size() + "/3 runes" : "Defeat the Hollow Watchers • " + (guardTotal - guards.size()) + "/" + guardTotal;
            default -> "Talk to Mara or Oren • northern crossing /everafter go";
        };
    }
    private void update() {
        if (bar == null) return;
        bar.setTitle("EVERAFTER • " + objective());
        double progress = switch (phase) {
            case "complete" -> 1;
            case "rescued" -> .9;
            case "adventure" -> .25 + .55 * (decision.route.equals("mystery") ? runes.size() / 3.0 : guardTotal == 0 ? 1 : (guardTotal - guards.size()) / (double) guardTotal);
            default -> .1;
        };
        bar.setProgress(Math.clamp(progress, 0, 1));
        bar.setColor(phase.equals("complete") ? BarColor.GREEN : decision.route.equals("mystery") ? BarColor.PURPLE : BarColor.RED);
        Player p = player();
        if (p == null || scenes == null || !ready) return;
        Location target = scenes.gateLocation();
        if (phase.equals("rescued")) target = scenes.returnLocation();
        else if (phase.equals("complete")) target = scenes.maraLocation();
        else if (phase.equals("adventure") && p.getLocation().getX() > 100) {
            if (unlocked()) target = scenes.elinLocation();
            else if (decision.route.equals("mystery")) { for (int i = 0; i < 3; i++) if (!runes.contains(i)) { target = scenes.runeLocations().get(i); break; } }
            else for (UUID id : guards) { Entity guard = Bukkit.getEntity(id); if (guard != null) { target = guard.getLocation(); break; } }
        }
        p.setCompassTarget(target);
    }
    private Map<String, Object> snapshot() {
        Map<String, Object> state = new LinkedHashMap<>(); Player p = player();
        state.put("playerId", owner == null ? "" : owner.toString()); state.put("playerName", p == null ? "Adventurer" : p.getName());
        state.put("phase", phase); state.put("route", decision.route); state.put("mood", decision.mood); state.put("difficulty", decision.difficulty);
        state.put("objective", objective()); state.put("questProgress", Map.of("runes", runes.size(), "runeTotal", 3, "guardsRemaining", guards.size(), "guardTotal", guardTotal));
        state.put("npc", selectedNpc); state.put("building", building); state.put("world", world == null ? "" : world.getName()); return state;
    }
    private void publish() { request("/api/game-state", "POST", gson.toJson(snapshot())).exceptionally(error -> null); }

    private void heartbeat() {
        ticks++;
        Player p = player();
        if (p == null || !ready) return;
        if (inStory(p)) {
            p.setFoodLevel(20);
            if (ticks % 4 == 0 && p.getHealth() > 0 && p.getHealth() < 20) p.setHealth(Math.min(20, p.getHealth() + 1));
            if (p.getLocation().getY() < 55 || p.getLocation().getY() > 110 || Math.abs(p.getLocation().getZ()) > 65 || p.getLocation().getX() < -65 || p.getLocation().getX() > 245 || (p.getLocation().getX() > 65 && p.getLocation().getX() < 115)) {
                p.teleport(built && phase.equals("adventure") ? scenes.adventureSpawn() : scenes.villageSpawn()); tell(p, "The story draws you back to the path.");
            }
            p.sendActionBar(Component.text(objective(), NamedTextColor.AQUA));
            long now = System.currentTimeMillis();
            if (now - lastGate > 5000 && !building && p.getLocation().distanceSquared(scenes.gateLocation()) < 7) { lastGate = now; go(p); }
            if (built && now - lastGate > 5000 && p.getLocation().distanceSquared(scenes.returnLocation()) < 5) { lastGate = now; home(p); }
            if (built && phase.equals("adventure")) {
                if (decision.route.equals("mystery")) for (int i = 0; i < 3; i++) if (!runes.contains(i)) world.spawnParticle(Particle.END_ROD, scenes.runeLocations().get(i).clone().add(0, 1, 0), 8, .25, 1, .25, .01);
                boolean changed = guards.removeIf(id -> { Entity entity = Bukkit.getEntity(id); return entity == null || entity.isDead(); });
                for (UUID id : guards) if (Bukkit.getEntity(id) instanceof Zombie z) {
                    if (z.getLocation().getY() < 62 || z.getLocation().distanceSquared(scenes.elinLocation()) > 2500) z.teleport(scenes.enemySpawns().isEmpty() ? scenes.elinLocation().clone().add(0,0,8) : scenes.enemySpawns().getFirst());
                    z.setTarget(p.getLocation().getX() > 100 ? p : null);
                }
                if (changed) { update(); publish(); }
                if (unlocked()) world.spawnParticle(Particle.HAPPY_VILLAGER, scenes.elinLocation().clone().add(0, 2, 0), 6, .4, .4, .4);
            }
            update();
        }
        drainInputs(p);
        if (!polling && !talking && pendingInputs.isEmpty()) {
            polling = true;
            request("/api/inbox?playerId=" + owner, "GET", "").whenComplete((body, error) -> main(() -> {
                polling = false;
                if (error != null) return;
                try {
                    JsonArray messages = JsonParser.parseString(body).getAsJsonObject().getAsJsonArray("messages");
                    if (messages != null && !messages.isEmpty()) {
                        JsonObject input = messages.get(0).getAsJsonObject();
                        pendingInputs.addLast(new DialogueInput(value(input, "message", ""), value(input, "npc", selectedNpc)));
                        Player current = player();
                        if (current != null) drainInputs(current);
                    }
                } catch (RuntimeException ignored) { /* Invalid local inbox messages are never executed. */ }
            }));
        }
    }

    private void drainInputs(Player p) {
        DialogueInput input = nextInput(pendingInputs, talking);
        if (input != null) talk(p, input.message, input.npc);
    }
    static record DialogueInput(String message, String npc) {}
    static DialogueInput nextInput(Deque<DialogueInput> inputs, boolean busy) { return busy ? null : inputs.pollFirst(); }
    static boolean canDeliver(String requestPhase, String currentPhase) { return requestPhase.equals(currentPhase); }

    @EventHandler public void onJoin(PlayerJoinEvent e) { Bukkit.getScheduler().runTaskLater(this, () -> start(e.getPlayer()), 20); }
    @EventHandler public void onQuit(PlayerQuitEvent e) { bar.removePlayer(e.getPlayer()); }
    @EventHandler public void onChat(AsyncChatEvent e) {
        UUID id = e.getPlayer().getUniqueId(); String message = PlainTextComponentSerializer.plainText().serialize(e.message());
        // Chat events are asynchronous; all world and quest access stays in the scheduled callback.
        e.setCancelled(true);
        main(() -> { Player p = Bukkit.getPlayer(id); if (p != null) talk(p, message, selectedNpc); });
    }
    @EventHandler public void onInteractEntity(PlayerInteractEntityEvent e) {
        String name = npcs.get(e.getRightClicked().getUniqueId());
        if (name == null) return;
        e.setCancelled(true);
        if (e.getHand() != EquipmentSlot.HAND || !owns(e.getPlayer())) return;
        Player p = e.getPlayer(); selectedNpc = name;
        if (name.equals("Elin")) rescue(p);
        else if (name.equals("Mara")) say(p, name, phase.equals("complete") ? "You kept your promise. Elin is home, and I will remember the kind of hero you chose to be." : "Elin crossed the northern arch and never came back. Tell me what matters to you—puzzles, combat, wonder, or keeping our village safe.");
        else say(p, name, phase.equals("complete") ? "I have written your journey into our village chronicle. What should the next generation remember?" : "The northern crossing follows the stories we tell. Tell me how you like to explore. For the echo-stones, seek three glowing markers and touch each one.");
        tell(p, "Speaking to " + name + ". Type in chat or /talk <your words>."); publish();
    }
    @EventHandler public void onInteract(PlayerInteractEvent e) {
        if (!owns(e.getPlayer()) || !inStory(e.getPlayer())) return;
        if (e.getAction() == Action.RIGHT_CLICK_BLOCK && built && phase.equals("adventure") && decision.route.equals("mystery") && e.getHand() == EquipmentSlot.HAND) {
            Block block = e.getClickedBlock(); if (block == null) return;
            for (int i = 0; i < 3; i++) if (block.getLocation().distanceSquared(scenes.runeLocations().get(i)) <= 4) {
                e.setCancelled(true);
                if (!runes.add(i)) { tell(e.getPlayer(), "This echo is already awake."); return; }
                world.spawnParticle(Particle.TOTEM_OF_UNDYING, scenes.runeLocations().get(i).clone().add(0, 1, 0), 60, .5, 1, .5);
                e.getPlayer().playSound(e.getPlayer().getLocation(), Sound.BLOCK_AMETHYST_BLOCK_CHIME, 1, 1 + i * .2f);
                if (i < labels.size()) labels.get(i).text(Component.text("✦ Echo awakened", NamedTextColor.GREEN));
                tell(e.getPlayer(), unlocked() ? "All three echoes sing. Follow your compass to Elin and right-click her." : "Echo awakened • " + runes.size() + "/3. Your compass points to the next one.");
                update(); publish(); return;
            }
        }
    }
    @EventHandler public void onDeath(EntityDeathEvent e) {
        if (guards.remove(e.getEntity().getUniqueId())) {
            e.getDrops().clear(); e.setDroppedExp(0); update(); publish();
            Player p = player(); if (p != null && guards.isEmpty() && phase.equals("adventure")) { tell(p, "The Hollow Watch is broken. Follow your compass to Elin and right-click her."); p.playSound(p.getLocation(), Sound.BLOCK_BEACON_ACTIVATE, 1, 1); }
        }
    }
    @EventHandler public void onDamage(EntityDamageEvent e) {
        if (npcs.containsKey(e.getEntity().getUniqueId())) e.setCancelled(true);
        if (e.getEntity() instanceof Player p && inStory(p)) {
            if (!owns(p) || !phase.equals("adventure") || p.getLocation().getX() < 100 || decision.route.equals("mystery")) e.setCancelled(true);
            else e.setDamage(Math.min(e.getDamage(), 4));
        }
    }
    @EventHandler public void onAttack(EntityDamageByEntityEvent e) {
        if (e.getEntity() instanceof Player p && inStory(p) && !guards.contains(e.getDamager().getUniqueId())) e.setCancelled(true);
        if (e.getEntity() instanceof TextDisplay && e.getEntity().getWorld().equals(world)) e.setCancelled(true);
    }
    @EventHandler public void onPlayerDeath(PlayerDeathEvent e) {
        if (!inStory(e.getEntity())) return;
        e.setKeepInventory(true); e.getDrops().clear(); e.setKeepLevel(true);
        Bukkit.getScheduler().runTaskLater(this, () -> { if (e.getEntity().isOnline() && e.getEntity().isDead()) e.getEntity().spigot().respawn(); }, 30);
    }
    @EventHandler public void onRespawn(PlayerRespawnEvent e) {
        if (owns(e.getPlayer()) && ready) { e.setRespawnLocation(built && phase.equals("adventure") ? scenes.adventureSpawn() : scenes.villageSpawn()); tell(e.getPlayer(), "The village still needs you. Your progress and equipment are safe."); }
    }
    @EventHandler public void onBreak(BlockBreakEvent e) { if (inStory(e.getPlayer())) e.setCancelled(true); }
    @EventHandler public void onPlace(BlockPlaceEvent e) { if (inStory(e.getPlayer())) e.setCancelled(true); }
    @EventHandler public void onDrop(PlayerDropItemEvent e) { if (inStory(e.getPlayer())) e.setCancelled(true); }
    @EventHandler public void onPortal(PlayerPortalEvent e) { if (inStory(e.getPlayer())) e.setCancelled(true); }
    @EventHandler public void onSpawn(CreatureSpawnEvent e) { if (e.getLocation().getWorld().equals(world) && e.getSpawnReason() != CreatureSpawnEvent.SpawnReason.CUSTOM) e.setCancelled(true); }
    @EventHandler public void onExplode(EntityExplodeEvent e) { if (e.getLocation().getWorld().equals(world)) e.setCancelled(true); }

    static String clean(String text, int limit) {
        if (text == null) return "";
        String cleaned = text.replaceAll("[\\p{Cc}§]", " ").strip();
        return cleaned.substring(0, Math.min(cleaned.length(), limit));
    }
    static String value(JsonObject object, String key, String fallback) {
        JsonElement value = object.get(key); return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString() ? value.getAsString() : fallback;
    }
    static record Decision(String dialogue, String route, String mood, int difficulty, String objective, String source) {
        static Decision fallback() { return new Decision("Elin is held beyond the crossing. Follow the three glowing echo-stones, wake each with a touch, then bring her home. Tell me what kind of adventure you would prefer.", "mystery", "eerie", 1, "Awaken three echo-stones and rescue Elin.", "fallback"); }
        static Decision fallback(String phase, Decision current) {
            String dialogue = switch (phase) {
                case "complete" -> "Elin is safely home. The village remembers the journey you chose and the promise you kept.";
                case "rescued" -> "Elin is free. Take the southern return arch or /everafter home to reunite her with Mara.";
                case "adventure" -> current.route.equals("combat") ? "Defeat the remaining Hollow Watchers, then speak to Elin. If they are already defeated, follow your compass to her." : "Awaken all three glowing echo-stones, then speak to Elin. If the echoes are awake, follow your compass to her.";
                default -> current.route.equals("combat") ? "Elin is held beyond the crossing. Face the Hollow Watchers and bring her home. Enter the northern arch when ready." : "Elin is held beyond the crossing. Awaken three glowing echo-stones and bring her home. Enter the northern arch when ready.";
            };
            String objective = switch (phase) {
                case "complete" -> "Elin is home. Speak to Mara or Oren.";
                case "rescued" -> "Return home with Elin.";
                default -> current.route.equals("combat") ? "Defeat the Hollow Watchers and rescue Elin." : "Awaken three echo-stones and rescue Elin.";
            };
            return new Decision(dialogue, current.route, current.mood, current.difficulty, objective, "fallback");
        }
        static Decision parse(String json) { return parse(json, "village", fallback()); }
        static Decision parse(String json, String phase, Decision current) {
            try {
                JsonObject object = JsonParser.parseString(json).getAsJsonObject();
                String route = value(object, "route", ""), mood = value(object, "mood", "");
                if (!Set.of("mystery", "combat").contains(route) || !Set.of("eerie", "wonder").contains(mood)) return fallback(phase, current);
                JsonElement challenge = object.get("difficulty");
                if (challenge == null || !challenge.isJsonPrimitive() || !challenge.getAsJsonPrimitive().isNumber()) return fallback(phase, current);
                double numeric = challenge.getAsDouble();
                if (!Double.isFinite(numeric) || numeric != Math.rint(numeric)) return fallback(phase, current);
                int difficulty = (int) Math.clamp(numeric, 1, 3);
                String dialogue = clean(value(object, "dialogue", ""), 320);
                if (dialogue.isBlank()) return fallback(phase, current);
                return new Decision(dialogue, route, mood, Math.clamp(difficulty, 1, 3), clean(value(object, "objective", "Rescue Elin."), 160), value(object, "source", "fallback").equals("mubit") ? "mubit" : "fallback");
            } catch (RuntimeException error) { return fallback(phase, current); }
        }
    }
}
