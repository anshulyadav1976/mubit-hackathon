package ai.everafter;

import com.google.gson.*;
import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.*;
import org.bukkit.attribute.Attribute;
import org.bukkit.boss.*;
import org.bukkit.command.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.player.*;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.*;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.util.Vector;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public final class EverafterPlugin extends JavaPlugin implements Listener {
    private static final String API = "http://127.0.0.1:8765", OPEN = "everafter:open", SAY = "everafter:say", REPLY = "everafter:reply", SCENE = "everafter:scene";
    private static final List<String> NPCS = List.of("Mara", "Oren", "Elin", "Ivo", "Sentinel", "Warden");
    private final Gson gson = new Gson();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final Map<String, Mob> actors = new LinkedHashMap<>();
    private final Map<String, Location> homes = new HashMap<>();
    private final Map<String, Long> pauses = new HashMap<>(), greetings = new HashMap<>();
    private final Map<String, Bubble> bubbles = new HashMap<>();
    private final Set<UUID> guards = new HashSet<>(), adds = new HashSet<>();
    private final Deque<DialogueInput> pendingInputs = new ArrayDeque<>();
    private World world;
    private WorldBuilder scenes;
    private NamespacedKey npcKey, artifactKey;
    private BossBar bar, encounter;
    private UUID owner, activeNpcEntity, lastClickedNpc;
    private String selectedNpc = "Mara", phase = "village";
    private Decision decision = Decision.fallback();
    private Quest quest = new Quest(decision.chapter);
    private boolean ready, building, built, talking, polling, kitGiven, escortHome, bossEnraged;
    private int ticks, guardTotal;
    private long lastGate, lastNpcClick, nextMechanic;

    @Override public void onEnable() {
        npcKey = new NamespacedKey(this, "npc"); artifactKey = new NamespacedKey(this, "witness_relic");
        getServer().getPluginManager().registerEvents(this, this);
        for (String channel : List.of(OPEN, REPLY, SCENE)) getServer().getMessenger().registerOutgoingPluginChannel(this, channel);
        getServer().getMessenger().registerIncomingPluginChannel(this, SAY, (channel, player, bytes) -> {
            try { ClientMessage input = ClientMessage.parse(decodePayload(bytes)); main(() -> receiveDialogue(player, input)); }
            catch (RuntimeException invalid) { main(() -> reply(player, selectedNpc, "Invalid message. Right-click the character and try again.", "fallback", "", true)); }
        });
        Objects.requireNonNull(getCommand("everafter")).setExecutor(this);
        Objects.requireNonNull(getCommand("talk")).setExecutor(this);
        bar = Bukkit.createBossBar("EVERAFTER • The village is taking shape…", BarColor.PURPLE, BarStyle.SOLID);
        encounter = Bukkit.createBossBar("", BarColor.RED, BarStyle.SEGMENTED_10); encounter.setVisible(false);
        // shortcut: quests last one server run; each restart makes a fresh isolated world.
        world = new WorldCreator("everafter_" + System.currentTimeMillis()).type(WorldType.FLAT)
                .generatorSettings("{\"layers\":[{\"block\":\"minecraft:bedrock\",\"height\":1},{\"block\":\"minecraft:dirt\",\"height\":63},{\"block\":\"minecraft:grass_block\",\"height\":1}],\"biome\":\"minecraft:plains\"}")
                .generateStructures(false).createWorld();
        if (world == null) { getLogger().severe("Could not create the story world."); Bukkit.getPluginManager().disablePlugin(this); return; }
        world.setGameRule(GameRule.DO_MOB_SPAWNING, false); world.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, false);
        world.setGameRule(GameRule.DO_WEATHER_CYCLE, false); world.setGameRule(GameRule.KEEP_INVENTORY, true);
        world.setGameRule(GameRule.MOB_GRIEFING, false); world.setGameRule(GameRule.DO_FIRE_TICK, false);
        world.setTime(13000); world.setStorm(false); world.setDifficulty(Difficulty.NORMAL); world.setSpawnLocation(0, 65, 0);
        scenes = new WorldBuilder(this, world);
        scenes.buildVillage(() -> {
            pinVillage(world, this);
            friendly("Mara", scenes.maraLocation(), Villager.Profession.TOOLSMITH);
            friendly("Oren", scenes.orenLocation(), Villager.Profession.LIBRARIAN);
            ready = true; for (Player p : Bukkit.getOnlinePlayers()) start(p); update();
            getLogger().info("EVERAFTER story village ready.");
        });
        Bukkit.getScheduler().runTaskTimer(this, this::heartbeat, 5, 5);
    }
    @Override public void onDisable() {
        if (bar != null) bar.removeAll(); if (encounter != null) encounter.removeAll();
        if (world != null) { for (Entity entity : world.getEntities()) if (!(entity instanceof Player)) entity.remove(); world.removePluginChunkTickets(this); }
        http.shutdownNow();
    }
    private void main(Runnable task) { if (isEnabled()) Bukkit.getScheduler().runTask(this, task); }
    private Player player() { return owner == null ? null : Bukkit.getPlayer(owner); }
    private boolean owns(Player p) { return owner != null && owner.equals(p.getUniqueId()); }
    private boolean inStory(Player p) { return p.getWorld().equals(world); }
    private boolean inReach(Player p, Entity entity) { return entity != null && inStory(p) && entity.getWorld().equals(world) && p.getLocation().distanceSquared(entity.getLocation()) <= 36; }
    private Mob actor(String name) {
        Mob loaded = loadedActor(actors.get(name), Bukkit::getEntity);
        if (loaded != null) actors.put(name, loaded);
        return loaded;
    }
    static Mob loadedActor(Mob stored, java.util.function.Function<UUID, Entity> lookup) {
        if (stored == null) return null;
        Entity loaded = lookup.apply(stored.getUniqueId());
        return loaded instanceof Mob mob && mob.isValid() && !mob.isDead() ? mob : null;
    }
    private void tell(Player p, String text) { p.sendMessage(Component.text("✦ ", NamedTextColor.GOLD).append(Component.text(clean(text, 600), NamedTextColor.AQUA))); }
    private void title(Player p, String text, String subtitle) { p.sendTitle(ChatColor.GOLD + text, ChatColor.AQUA + subtitle, 10, 65, 20); }
    private void say(Player p, String name, String text) { speak(p, name, text, "scripted", true); }
    private void speak(Player p, String name, String text, String source, boolean scene) {
        text = clean(text, 320);
        p.sendMessage(Component.text(name + " › ", NamedTextColor.GOLD).append(Component.text(text, NamedTextColor.WHITE)));
        Mob mob = actor(name); if (mob == null) return;
        Bubble previous = bubbles.remove(name); if (previous != null) previous.display.remove();
        String line = text;
        TextDisplay bubble = world.spawn(mob.getLocation().add(0, mob.getHeight() + .6, 0), TextDisplay.class, display -> {
            display.text(Component.text(line, NamedTextColor.WHITE)); display.setLineWidth(220);
            var transform = display.getTransformation(); transform.getScale().set(.55f); display.setTransformation(transform);
            display.setBillboard(Display.Billboard.CENTER); display.setBackgroundColor(Color.fromARGB(190, 14, 22, 31));
            display.setSeeThrough(false); display.setShadowed(true);
        });
        bubbles.put(name, new Bubble(bubble, System.currentTimeMillis() + 11000));
        if (scene && inReach(p, mob)) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("version", 1); payload.put("npc", name); payload.put("entityId", mob.getEntityId()); payload.put("playerId", p.getUniqueId().toString());
            payload.put("backendToken", backendToken()); payload.put("dialogue", text); payload.put("source", source);
            p.sendPluginMessage(this, SCENE, encodePayload(gson.toJson(payload)));
        }
    }
    private record Bubble(TextDisplay display, long expires) {}

    private void start(Player p) {
        if (!ready) { tell(p, "The village is being built; you will arrive shortly."); return; }
        if (owner == null) owner = p.getUniqueId();
        if (!owns(p)) { p.teleport(scenes.villageSpawn()); p.setGameMode(GameMode.SPECTATOR); tell(p, "This is one adventurer's story. You can spectate."); return; }
        p.setGameMode(GameMode.ADVENTURE); p.teleport(scenes.villageSpawn()); p.setRespawnLocation(scenes.villageSpawn(), true);
        p.setFoodLevel(20); p.setHealth(20); bar.addPlayer(p); encounter.addPlayer(p);
        if (!kitGiven) {
            kitGiven = true; p.getInventory().clear();
            p.getInventory().setItem(0, named(Material.IRON_SWORD, "Mara's village blade"));
            p.getInventory().setItem(1, new ItemStack(Material.BREAD, 24));
            p.getInventory().setItem(2, named(Material.COMPASS, "The burning compass • follows your objective"));
            p.getInventory().setItemInOffHand(new ItemStack(Material.SHIELD));
            p.getInventory().setChestplate(new ItemStack(Material.IRON_CHESTPLATE)); p.getInventory().setBoots(new ItemStack(Material.IRON_BOOTS));
            title(p, "EVERAFTER", "Follow a lead. Keep a promise. Bring her home.");
            tell(p, "Mara's compass burned when her sister vanished. Find Mara or Oren, approach and right-click to speak.");
            tell(p, "You can also type /talk Mara <your words>. Your choices select a realm, its trial, and the truth behind Elin's disappearance.");
        } else tell(p, "Your chapter is intact. /ea status shows your next step.");
        if (phase.equals("rescued")) home(p); else { update(); publish(); }
    }
    private ItemStack named(Material material, String text) {
        ItemStack item = new ItemStack(material); ItemMeta meta = item.getItemMeta(); meta.displayName(Component.text(text, NamedTextColor.GOLD)); item.setItemMeta(meta); return item;
    }
    private void configure(Mob mob, String name, Location home) {
        mob.customName(Component.text(name, name.equals("Warden") ? NamedTextColor.RED : NamedTextColor.GOLD));
        mob.setCustomNameVisible(true); mob.setPersistent(true); mob.setRemoveWhenFarAway(false); mob.setSilent(true);
        mob.setCollidable(false); mob.getPersistentDataContainer().set(npcKey, PersistentDataType.STRING, name);
        actors.put(name, mob); homes.put(name, home.clone());
    }
    private Villager friendly(String name, Location location, Villager.Profession profession) {
        Villager villager = world.spawn(location, Villager.class);
        configure(villager, name, location); villager.setInvulnerable(true); villager.setAI(true);
        villager.setProfession(profession); villager.setVillagerType(Villager.Type.TAIGA); return villager;
    }
    private void spawnBoss(String name, Location location) {
        Mob mob = name.equals("Sentinel") ? world.spawn(location, Husk.class) : world.spawn(location, Ravager.class);
        configure(mob, name, location); mob.setAI(false); mob.setInvulnerable(true);
        double health = name.equals("Sentinel") ? 36 + decision.difficulty * 8 : 76 + decision.difficulty * 16;
        Objects.requireNonNull(mob.getAttribute(Attribute.MAX_HEALTH)).setBaseValue(health); mob.setHealth(health);
        Objects.requireNonNull(mob.getAttribute(Attribute.ATTACK_DAMAGE)).setBaseValue(name.equals("Sentinel") ? 4 : 6);
        if (mob instanceof Husk husk) {
            husk.setBaby(false); husk.setShouldBurnInDay(false); husk.setCanPickupItems(false);
            husk.getEquipment().setHelmet(new ItemStack(Material.IRON_HELMET)); husk.getEquipment().setHelmetDropChance(0);
        }
    }

    @Override public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player p)) { sender.sendMessage("Join Minecraft to play EVERAFTER."); return true; }
        if (command.getName().equalsIgnoreCase("talk")) {
            if (args.length == 0) tell(p, "Use /talk <your words> or /talk Ivo <your words>. Right-click a character to select them.");
            else {
                String explicit = canonicalNpc(args[0]);
                if (explicit == null) talk(p, String.join(" ", args), selectedNpc);
                else if (!owns(p) || !ready) tell(p, "Join your story first.");
                else if (actor(explicit) == null) tell(p, explicit + " is beyond the crossing. Follow the village lead first.");
                else if (args.length == 1) { selectedNpc = explicit; tell(p, "Speaking to " + explicit + ". /talk <your words> or type in chat."); publish(); }
                else talk(p, String.join(" ", Arrays.copyOfRange(args, 1, args.length)), explicit);
            }
            return true;
        }
        String action = args.length == 0 ? "help" : args[0].toLowerCase(Locale.ROOT);
        if (action.equals("start")) { start(p); return true; }
        if (!ready) { tell(p, "The village is still being built."); return true; }
        if (!owns(p)) { tell(p, "This is a single-adventurer story."); return true; }
        switch (action) {
            case "go" -> go(p);
            case "home" -> home(p);
            case "status" -> { tell(p, objective()); tell(p, "Chapter: " + decision.chapter.title + " • " + decision.chapter.trial + " • " + decision.route + " • " + decision.difficulty + "/3"); }
            case "reset" -> tell(p, "A fully fresh story uses scripts/restart.sh; it preserves previous world directories.");
            default -> {
                tell(p, "Approach and right-click Mara/Oren for a lead. /talk <words> speaks to your selected character.");
                tell(p, "/ea go enters the committed chapter; /ea home returns safely; /ea status shows your objective.");
                tell(p, "Read the witness pedestal, solve the trial, face or negotiate with Sentinel and Warden, then escort Elin to Mara.");
            }
        }
        return true;
    }
    private void talk(Player p, String message, String npc) { talk(p, message, npc, ""); }
    private void talk(Player p, String message, String npc, String requestId) {
        if (!owns(p) || !ready) return;
        message = clean(message, 1200); if (message.isBlank()) return;
        if (talking) { tell(p, "Your companion is thinking. Please wait for the reply."); reply(p, npc, "Please wait for the current reply, then try again.", "fallback", requestId, true); return; }
        if (canonicalNpc(npc) == null || actor(npc) == null) { tell(p, "That character is not here yet."); reply(p, npc, "Follow the story lead to find me first.", "fallback", requestId, true); return; }
        selectedNpc = npc; talking = true; pauses.put(npc, System.currentTimeMillis() + 55000);
        p.sendMessage(Component.text("You → " + npc + " › " + message, NamedTextColor.GRAY));
        applyAction(p, npc, message, "none", "");
        Map<String, Object> payload = snapshot(); payload.put("message", message); payload.put("npc", npc); payload.put("worldFacts", facts());
        String speaker = npc, utterance = message, requestPhase = phase, requestStage = quest.stage;
        publish();
        request("/api/director", "POST", gson.toJson(payload)).whenComplete((body, error) -> main(() -> {
            talking = false; pauses.put(speaker, System.currentTimeMillis() + 1500);
            Player current = player();
            if (!canDeliver(requestPhase, phase) || !requestStage.equals(quest.stage)) {
                if (current != null) reply(current, speaker, "The story moved forward while we spoke. Follow the current objective.", "fallback", requestId, true);
                publish(); return;
            }
            Decision answer = error == null ? Decision.parse(body, phase, decision) : Decision.fallback(phase, decision);
            if (phase.equals("village") && !built && !building) decision = answer;
            if (current != null) {
                applyAction(current, speaker, utterance, answer.intent, answer.answer);
                if (answer.source.equals("fallback")) tell(current, "[Local fallback — no model response]");
                speak(current, speaker, answer.source.equals("fallback") && built ? hint(speaker) : answer.dialogue, answer.source, requestId.isEmpty());
                if (!requestId.isEmpty()) reply(current, speaker, answer.source.equals("fallback") && built ? hint(speaker) : answer.dialogue, answer.source, requestId, false);
                if (!built && !building) tell(current, "Lead: " + decision.chapter.title + " • " + decision.chapter.trial + ". Enter the northern crossing or /ea go.");
            }
            update(); publish();
        }));
    }
    private CompletableFuture<String> request(String path, String method, String body) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(API + path)).timeout(Duration.ofSeconds(path.equals("/api/director") ? 50 : 3));
        if (method.equals("POST")) builder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)); else builder.GET();
        return http.sendAsync(builder.build(), HttpResponse.BodyHandlers.ofString()).thenApply(response -> {
            if (response.statusCode() != 200 || response.body().length() > 65536) throw new IllegalStateException("Invalid local director response"); return response.body();
        });
    }

    private void go(Player p) {
        if (building) { tell(p, "The chapter is forming. You will travel when it is ready."); return; }
        if (talking) { tell(p, "Wait for your companion's answer before committing the crossing."); return; }
        if (phase.equals("complete")) { tell(p, "Elin is home. Your chronicle records the choices you actually made."); return; }
        if (built) { p.teleport(scenes.adventureSpawn()); lastGate = System.currentTimeMillis(); update(); return; }
        building = true; quest = new Quest(decision.chapter);
        title(p, decision.chapter.title, decision.chapter.hook); tell(p, "The compass commits this lead. The realm will now remain fixed."); publish();
        scenes.buildChapter(decision.chapter.realm, decision.chapter.trial, decision.mood, decision.difficulty, () -> {
            pinAdventure(world, this); building = false; built = true; phase = "adventure";
            friendly("Ivo", scenes.guideLocation(), Villager.Profession.CARTOGRAPHER);
            friendly("Elin", scenes.elinLocation(), Villager.Profession.NONE);
            spawnBoss("Sentinel", scenes.sentinelLocation()); spawnBoss("Warden", scenes.bossLocation());
            Player current = player(); if (current != null) { current.teleport(scenes.adventureSpawn()); lastGate = System.currentTimeMillis(); tell(current, objective()); }
            update(); publish();
        });
    }
    static void pinVillage(World world, Plugin plugin) {
        for (int x = Math.floorDiv(-60, 16); x <= Math.floorDiv(60, 16); x++)
            for (int z = Math.floorDiv(-60, 16); z <= Math.floorDiv(60, 16); z++) world.addPluginChunkTicket(x, z, plugin);
    }
    static void pinAdventure(World world, Plugin plugin) {
        for (int x = Math.floorDiv(125, 16); x <= Math.floorDiv(235, 16); x++)
            for (int z = Math.floorDiv(-55, 16); z <= Math.floorDiv(55, 16); z++) world.addPluginChunkTicket(x, z, plugin);
    }
    private void meetGuide(Player p) {
        if (quest.meetGuide()) { say(p, "Ivo", "You followed the compass into " + scenes.realmName() + ". A witness left proof at the marked pedestal. Read it before judging our guardians."); update(); publish(); }
    }
    private void applyAction(Player p, String npc, String message, String intent, String proposedAnswer) {
        if (!built || !phase.equals("adventure")) return;
        Mob target = actor(npc); if (target == null) return;
        if (!inReach(p, target)) {
            boolean currentEncounter = npc.equals("Ivo") && quest.stage.equals("trial") || quest.expectedBoss(npc);
            boolean proposedAction = requestsAction(message, intent, "bargain") || requestsAction(message, intent, "challenge") || npc.equals("Ivo") && containsAnswer(message, scenes.solution());
            if (currentEncounter && proposedAction) {
                double distance = p.getWorld().equals(target.getWorld()) ? p.getLocation().distance(target.getLocation()) : Double.POSITIVE_INFINITY;
                tell(p, "To act with " + npc + ", move within 6 blocks. " + (Double.isFinite(distance) ? "You are " + String.format(Locale.ROOT, "%.1f", distance) + " blocks away. " : "Return to the chapter first. ") + "Conversation can continue from here.");
            }
            return;
        }
        if (npc.equals("Ivo")) {
            meetGuide(p);
            if (!quest.stage.equals("trial")) return;
            if (decision.chapter.trial.equals("riddle") && containsAnswer(message, scenes.solution())) {
                if (quest.resolveTrial("riddle", true, guards.size())) finishTrial(p);
                else say(p, "Ivo", "That may be the answer, but we still need the real witness mark. Read the glowing pedestal first.");
            } else if (decision.chapter.trial.equals("gauntlet") && requestsAction(message, intent, "challenge")) startGuards(p);
            else if (decision.chapter.trial.equals("parley") && requestsAction(message, intent, "bargain")) {
                if (quest.resolveTrial("parley", false, guards.size())) finishTrial(p);
                else say(p, "Ivo", "A promise needs evidence. Read the witness pedestal, then offer its proof to the oath-keepers.");
            }
        } else if (npc.equals("Sentinel") || npc.equals("Warden")) {
            if (requestsAction(message, intent, "bargain")) {
                if (quest.spareBoss(npc, hasArtifact(p))) resolveBoss(p, npc, true);
                else say(p, npc, npc.equals("Warden") ? "Only the witness relic and a living Sentinel's oath can end this binding without a fight." : "Bring the witness relic from the completed trial. A claim alone will not open this gate.");
            } else if (requestsAction(message, intent, "challenge")) startBoss(p, npc);
        }
    }
    private void readClue(Player p) {
        if (!phase.equals("adventure") || !Set.of("arrival", "trial").contains(quest.stage)) return;
        quest.meetGuide(); boolean first = !quest.clueDiscovered; quest.clueDiscovered = true;
        tell(p, "Witness evidence: " + scenes.clueText()); tell(p, "Inscription: " + scenes.riddle());
        if (first) { p.playSound(p.getLocation(), Sound.BLOCK_AMETHYST_BLOCK_CHIME, 1, 1); world.spawnParticle(Particle.ENCHANT, scenes.clueLocation().clone().add(0, 1, 0), 35, .5, .8, .5); }
        if (decision.chapter.trial.equals("gauntlet") && quest.resolveTrial("gauntlet", false, guards.size())) finishTrial(p);
        update(); publish();
    }
    private void startGuards(Player p) {
        if (!quest.stage.equals("trial") || !decision.chapter.trial.equals("gauntlet") || quest.waveStarted) return;
        quest.waveStarted = true; guardTotal = 2 + decision.difficulty;
        List<Location> spots = scenes.enemySpawns();
        for (int i = 0; i < guardTotal; i++) {
            Location spot = spots.isEmpty() ? scenes.trialLocation().clone().add(i - 2, 0, 2) : spots.get(i % spots.size());
            Zombie guard = world.spawn(spot, Zombie.class, z -> { z.customName(Component.text("Oathbound Echo", NamedTextColor.RED)); z.setCustomNameVisible(true); z.setBaby(false); z.setCanPickupItems(false); z.setShouldBurnInDay(false); z.setRemoveWhenFarAway(false); z.setHealth(10 + decision.difficulty * 2); z.setTarget(p); });
            guards.add(guard.getUniqueId());
        }
        say(p, "Ivo", "The echoes are awake. Defeat this bounded watch, then recover the witness proof. I will keep the way behind you safe."); update(); publish();
    }
    private void finishTrial(Player p) {
        scenes.unlockStage(1);
        ItemStack relic = named(Material.ECHO_SHARD, "Witness Relic • " + scenes.realmName()); ItemMeta meta = relic.getItemMeta();
        meta.getPersistentDataContainer().set(artifactKey, PersistentDataType.BYTE, (byte) 1); meta.lore(List.of(Component.text("Real proof recovered from the trial.", NamedTextColor.GRAY))); relic.setItemMeta(meta);
        p.getInventory().setItem(8, relic);
        say(p, "Ivo", "The first seal yields. Take this witness relic to the Sentinel. Challenge the guardian, or show the proof and ask for peace.");
        title(p, "THE WITNESS RELIC", "The Sentinel's gate opens."); update(); publish();
    }
    private boolean hasArtifact(Player p) {
        for (ItemStack item : p.getInventory().getContents()) if (item != null && item.hasItemMeta() && item.getItemMeta().getPersistentDataContainer().has(artifactKey, PersistentDataType.BYTE)) return true;
        return false;
    }
    private void startBoss(Player p, String name) {
        if (!quest.startBoss(name)) { tell(p, "The current seal must be resolved first. " + objective()); return; }
        Mob boss = actor(name); if (boss == null) { spawnBoss(name, name.equals("Sentinel") ? scenes.sentinelLocation() : scenes.bossLocation()); boss = actor(name); }
        bossEnraged = false; nextMechanic = System.currentTimeMillis() + 5000; pauses.put(name, 0L);
        boss.setInvulnerable(false); boss.setAI(true); boss.setTarget(p);
        say(p, name, name.equals("Sentinel") ? "Then meet my shield. When I brace, step outside the marked ring; strike after the blow." : "The final oath stands before you. My stomp grows fiercer when this binding weakens.");
        update(); publish();
    }
    private void resolveBoss(Player p, String name, boolean spared) {
        int gate = name.equals("Sentinel") ? 2 : 3; scenes.unlockStage(gate);
        Mob mob = actors.get(name);
        if (spared && mob != null) {
            mob.setTarget(null); mob.setAI(false); mob.setInvulnerable(true);
            mob.teleport((name.equals("Sentinel") ? scenes.sentinelLocation() : scenes.bossLocation()).clone().add(4, 0, 0));
        }
        for (UUID id : adds) { Entity e = Bukkit.getEntity(id); if (e != null) e.remove(); } adds.clear(); encounter.setVisible(false);
        if (spared) say(p, name, name.equals("Sentinel") ? "The relic is genuine. I release my seal and lend my living oath to your plea before the Warden." : "A witness, a relic, and an unbroken oath. I release Elin, and you may carry our promise home.");
        else if (p != null) tell(p, name + " defeated. The next physical seal is open.");
        if (name.equals("Warden") && spared) {
            quest.artifactReturned = true;
            for (int i = 0; i < p.getInventory().getSize(); i++) { ItemStack item = p.getInventory().getItem(i); if (item != null && item.hasItemMeta() && item.getItemMeta().getPersistentDataContainer().has(artifactKey, PersistentDataType.BYTE)) p.getInventory().setItem(i, null); }
        }
        update(); publish();
    }
    private void rescue(Player p) {
        if (!quest.rescueClick("Elin", phase)) return;
        phase = "rescued"; escortHome = false;
        Mob elin = actor("Elin"); if (elin != null) { elin.setAI(true); homes.put("Elin", p.getLocation().clone()); }
        say(p, "Elin", decision.chapter.twist.equals("willing_guardian") ? "I stayed to keep the breach closed. You found a safe way out. Walk with me to the return arch; then take me to Mara." : "You came all this way. I heard every broken oath beyond those gates. Walk with me to the return arch, then let us find Mara together.");
        title(p, "ELIN IS FREE", "She follows you. Return together, then walk to Mara."); update(); publish();
    }
    private void home(Player p) {
        p.teleport(scenes.villageSpawn()); lastGate = System.currentTimeMillis(); p.setHealth(20); p.setFoodLevel(20);
        if (phase.equals("rescued")) {
            escortHome = true; Mob elin = actor("Elin"); if (elin != null) elin.teleport(scenes.villageSpawn().clone().add(1, 0, 0));
            tell(p, "Elin came through beside you. Walk with her to Mara; the reunion completes the story.");
        } else tell(p, built ? "Your progress is safe. /ea go returns to the chapter." : "Approach Mara or Oren and follow a lead.");
        selectedNpc = "Mara"; update(); publish();
    }
    private void complete(Player p) {
        if (!phase.equals("rescued") || !escortHome) return;
        phase = "complete"; quest.complete = true; Mob elin = actor("Elin"), mara = actor("Mara");
        if (mara != null && elin != null) { elin.teleport(mara.getLocation().clone().add(1.5, 0, 0)); homes.put("Elin", elin.getLocation()); }
        scenes.celebrate(); world.setTime(1000); encounter.setVisible(false);
        title(p, "A VILLAGE REMEMBERS", quest.sentinelSpared && quest.wardenSpared ? "You brought her home without breaking an oath." : "You kept your promise. Your choices remain.");
        say(p, "Mara", "Elin! You're here. " + p.getName() + ", you followed the " + scenes.realmName() + " lead and brought my sister home. These lanterns are for you.");
        Bukkit.getScheduler().runTaskLater(this, () -> { Player current = player(); if (current != null && phase.equals("complete")) say(current, "Elin", quest.wardenSpared ? "The guardians still live, and their oath is ours to keep. Thank you for bringing me back with a story worth remembering." : "The final binding is broken. I will remember what you faced, and the road we walked home together."); }, 300);
        ItemStack chronicle = new ItemStack(Material.WRITTEN_BOOK); BookMeta book = (BookMeta) chronicle.getItemMeta();
        book.setTitle("The Everafter Chronicle"); book.setAuthor("Archivist Oren");
        book.addPage("EVERAFTER\n" + decision.chapter.title + "\n\nTraveler: " + p.getName() + "\nRealm: " + scenes.realmName() + "\nTrial: " + decision.chapter.trial + "\nWitness proof: discovered\nRelic: " + (quest.artifactReturned ? "returned in peace" : "recovered"));
        book.addPage("Choices witnessed\n\nSentinel: " + (quest.sentinelSpared ? "spared by proof" : "defeated in battle") + "\nWarden: " + (quest.wardenSpared ? "released the oath" : "defeated in battle") + "\n\nElin: escorted to Mara\nVillage: reunited\n\n" + switch (decision.chapter.twist) { case "false_trail" -> "The false trail could not survive the witness's evidence."; case "willing_guardian" -> "Elin had stayed to guard the breach. A safe passage let her return."; default -> "A broken oath was answered with a promise kept."; });
        chronicle.setItemMeta(book); p.getInventory().setItem(6, chronicle); p.getInventory().setItem(7, named(Material.NETHER_STAR, "Mara's Oathkeeper Star"));
        tell(p, "Oren's factual chronicle and Mara's Oathkeeper Star are in your hotbar. The village remembers your actual choices.");
        p.playSound(p.getLocation(), Sound.UI_TOAST_CHALLENGE_COMPLETE, 1, .8f); update(); publish();
    }

    private String objective() {
        if (building) return "The chosen chapter is forming…";
        if (phase.equals("complete")) return "Elin reunited • Read Oren's chronicle and speak with your village";
        if (phase.equals("rescued")) return escortHome ? "Walk with Elin to Mara • the reunion is ahead" : "Escort Elin to the return arch • /ea home brings you through together";
        if (!built) return "Mara's compass burns • ask Mara or Oren which lead to follow";
        return switch (quest.stage) {
            case "arrival" -> "Find Ivo near the arrival arch • follow the compass";
            case "trial" -> !quest.clueDiscovered ? "Read the glowing witness pedestal • right-click its block" : switch (decision.chapter.trial) {
                case "gauntlet" -> quest.waveStarted ? "Trial echoes defeated • " + quest.guardsDefeated + "/" + guardTotal : "Tell Ivo you are ready to face the trial echoes";
                case "parley" -> "Show Ivo the witness proof and offer a peaceful oath";
                default -> "Answer the inscription aloud to Ivo • " + clean(scenes.riddle(), 90);
            };
            case "sentinel" -> quest.activeBoss.isEmpty() ? "Sentinel • challenge the guardian, or show the witness relic for peace" : "Sentinel • watch the marked ring; strike after its shield falls";
            case "warden" -> quest.activeBoss.isEmpty() ? "Warden • face the final guardian, or offer relic and a spared Sentinel's oath" : "Warden • dodge the stomp; beware the second-phase echoes";
            default -> "Elin's refuge is open • approach and right-click Elin";
        };
    }
    private String hint(String name) {
        if (phase.equals("complete")) return openingGreeting(name, phase, decision.route);
        if (phase.equals("rescued")) return name.equals("Elin") ? "I am following you. Take the return arch, then walk with me to Mara. We are not home until we reach her together." : "Elin is free. Return with her and walk to Mara for the reunion.";
        if (!built) return openingGreeting(name, phase, decision.route);
        if (name.equals("Ivo")) return switch (quest.stage) {
            case "arrival" -> "You reached " + scenes.realmName() + ". Read the glowing witness pedestal. It holds evidence, an inscription, and the reason these guardians still wait.";
            case "trial" -> !quest.clueDiscovered ? "The witness pedestal is real evidence, not a rumor. Right-click it, read the inscription, and return to me." : decision.chapter.trial.equals("riddle") ? "The inscription asks: " + scenes.riddle() + " Tell me your answer; the witness mark gives a clue." : decision.chapter.trial.equals("parley") ? "You have the witness proof. Offer it in peace, and promise to carry the oath honestly." : quest.waveStarted ? "Defeat the remaining trial echoes. The proof you read will turn their seal into a witness relic." : "Say you are ready to challenge the trial echoes. Their number is bounded, and your progress survives defeat.";
            case "sentinel" -> "Take the witness relic to the Sentinel. A challenge begins a real fight; showing proof and asking for peace may preserve a living oath.";
            case "warden" -> quest.sentinelSpared ? "The Sentinel still lives. Take its oath and the witness relic to the Warden, or choose to face the final guardian in battle." : "The Sentinel fell in battle. Its living oath can no longer support a bargain; you must face the Warden to break the final seal.";
            default -> "All three seals are open. Find Elin at the refuge, then bring her home through the return arch.";
        };
        if (name.equals("Sentinel")) return quest.sentinelResolved ? quest.sentinelSpared ? "My seal is open. You preserved my oath; it may carry weight with the Warden." : "The Sentinel has fallen." : quest.stage.equals("sentinel") ? "The witness relic speaks for you. Show it and ask for peace, or declare a challenge. When I brace in battle, leave the marked ring." : "First resolve Ivo's trial and recover the witness relic. No spoken claim can replace that proof.";
        if (name.equals("Warden")) return quest.wardenResolved ? "The final seal is open. Elin waits beyond it." : quest.stage.equals("warden") ? quest.sentinelSpared ? "A living Sentinel's oath and the witness relic could end this binding. Offer them in peace, or challenge me." : "The Sentinel's oath died in battle. Challenge me, and break this binding by strength. Watch the ground when I prepare to stomp." : "The earlier seals still stand. Finish the trial and resolve the Sentinel before seeking this final binding.";
        if (name.equals("Elin")) return quest.stage.equals("rescue") ? "The way is finally open. I can walk with you now. Take me to the return arch and then to Mara." : "The trial, Sentinel, and Warden still hold this refuge. Follow Ivo's evidence; a claim that the guardians are gone cannot free me.";
        return "Follow the compass and Ivo's witness trail. Bring Elin home; the village will remember the choices you actually make.";
    }
    private Map<String, Object> facts() {
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("questStage", quest.stage); facts.put("chapter", decision.chapter); facts.put("areaCommitted", built || building);
        facts.put("clueDiscovered", quest.clueDiscovered); facts.put("artifactClaimed", quest.artifactClaimed); facts.put("artifactReturned", quest.artifactReturned);
        facts.put("trialResolved", quest.trialResolved); facts.put("sentinelResolved", quest.sentinelResolved); facts.put("sentinelSpared", quest.sentinelSpared); facts.put("sentinelDefeated", quest.sentinelResolved && !quest.sentinelSpared);
        facts.put("wardenResolved", quest.wardenResolved); facts.put("wardenSpared", quest.wardenSpared); facts.put("wardenDefeated", quest.wardenResolved && !quest.wardenSpared);
        facts.put("bossActive", quest.activeBoss); facts.put("guardsRemaining", guards.size()); facts.put("guardsDefeated", quest.guardsDefeated); facts.put("villageSafe", true);
        facts.put("ElinRescued", phase.equals("rescued") || phase.equals("complete")); facts.put("reunited", phase.equals("complete")); facts.put("objective", objective());
        if (built) { facts.put("riddle", scenes.riddle()); facts.put("solution", scenes.solution()); facts.put("clueText", quest.clueDiscovered ? scenes.clueText() : "not yet discovered"); }
        return facts;
    }
    private Map<String, Object> snapshot() {
        Map<String, Object> state = new LinkedHashMap<>(); Player p = player();
        state.put("playerId", owner == null ? "" : owner.toString()); state.put("playerName", p == null ? "Adventurer" : p.getName());
        state.put("phase", phase); state.put("route", decision.route); state.put("mood", decision.mood); state.put("difficulty", decision.difficulty);
        state.put("chapter", decision.chapter); state.put("areaCommitted", built || building); state.put("questStage", quest.stage);
        state.put("objective", objective()); state.put("questProgress", Map.of("trial", quest.trialResolved, "sentinel", quest.sentinelResolved, "warden", quest.wardenResolved, "guardsRemaining", guards.size(), "guardsDefeated", quest.guardsDefeated));
        state.put("worldFacts", facts()); state.put("npc", selectedNpc); state.put("building", building); return state;
    }
    private void publish() { if (owner != null) request("/api/game-state", "POST", gson.toJson(snapshot())).exceptionally(error -> null); }
    private void update() {
        if (bar == null) return;
        bar.setTitle("EVERAFTER • " + objective());
        double progress = phase.equals("complete") ? 1 : phase.equals("rescued") ? .9 : !built ? .08 : switch (quest.stage) { case "arrival" -> .15; case "trial" -> .25; case "sentinel" -> .45; case "warden" -> .65; default -> .82; };
        bar.setProgress(progress); bar.setColor(phase.equals("complete") ? BarColor.GREEN : BarColor.PURPLE);
        String bossName = quest.activeBoss; Mob boss = actor(bossName);
        encounter.setVisible(boss != null && phase.equals("adventure"));
        if (boss != null) {
            boolean windup = pauses.getOrDefault("bossWindup", 0L) > System.currentTimeMillis();
            encounter.setTitle(bossName + (windup ? " • STEP OUT OF THE MARKED RING" : bossEnraged ? " • Oath unbound" : " • " + Math.ceil(boss.getHealth()) + " health"));
            encounter.setProgress(Math.clamp(boss.getHealth() / Objects.requireNonNull(boss.getAttribute(Attribute.MAX_HEALTH)).getValue(), 0, 1));
            encounter.setColor(bossName.equals("Sentinel") ? BarColor.YELLOW : BarColor.RED);
        }
        Player p = player(); if (p == null || !ready) return;
        Location target = scenes.maraLocation();
        if (phase.equals("village")) target = scenes.gateLocation();
        else if (phase.equals("rescued")) target = escortHome ? actor("Mara") == null ? scenes.maraLocation() : actor("Mara").getLocation() : scenes.returnLocation();
        else if (built && p.getLocation().getX() > 100) target = switch (quest.stage) {
            case "arrival" -> scenes.guideLocation();
            case "trial" -> !quest.clueDiscovered ? scenes.clueLocation() : quest.waveStarted && !guards.isEmpty() ? guardLocation() : actor("Ivo") == null ? scenes.guideLocation() : actor("Ivo").getLocation();
            case "sentinel" -> scenes.sentinelLocation(); case "warden" -> scenes.bossLocation(); default -> scenes.elinLocation();
        };
        else if (built && phase.equals("adventure")) target = scenes.gateLocation();
        p.setCompassTarget(target);
    }
    private Location guardLocation() { for (UUID id : guards) { Entity guard = Bukkit.getEntity(id); if (guard != null) return guard.getLocation(); } return scenes.trialLocation(); }

    private void heartbeat() {
        ticks += 5; Player p = player(); if (p == null || !ready) return;
        long now = System.currentTimeMillis();
        if (inStory(p)) {
            p.setFoodLevel(20); if (ticks % 80 == 0 && p.getHealth() > 0 && p.getHealth() < 20) p.setHealth(Math.min(20, p.getHealth() + 1));
            Location at = p.getLocation();
            if (at.getY() < 55 || at.getY() > 110 || Math.abs(at.getZ()) > 65 || at.getX() < -65 || at.getX() > 245 || (at.getX() > 65 && at.getX() < 115)) {
                p.teleport(built && !escortHome && !phase.equals("complete") ? scenes.adventureSpawn() : scenes.villageSpawn()); tell(p, "The story draws you back to the safe path.");
            }
            if (built && phase.equals("adventure") && at.getX() > 100) {
                double barrier = switch (quest.stage) { case "arrival", "trial" -> 3; case "sentinel" -> -14; case "warden" -> -35; default -> -60; };
                if (at.getZ() < barrier) { p.teleport(new Location(world, 180.5, 65, barrier + 3, 180, 0)); tell(p, "The next seal still holds. " + objective()); }
            }
            if (now - lastGate > 5000 && !building && p.getLocation().distanceSquared(scenes.gateLocation()) < 7) { lastGate = now; go(p); }
            if (built && now - lastGate > 5000 && p.getLocation().distanceSquared(scenes.returnLocation()) < 5) { lastGate = now; home(p); }
            if (built && phase.equals("adventure") && quest.stage.equals("arrival") && inReach(p, actor("Ivo"))) meetGuide(p);
            moveCharacters(p, now); updateBubbles(now);
            if (built && phase.equals("adventure")) { maintainEnemies(p, now); bossMechanics(p, now); }
            if (phase.equals("rescued") && escortHome && actor("Mara") != null && actor("Elin") != null && p.getLocation().distanceSquared(actor("Mara").getLocation()) <= 16 && actor("Elin").getLocation().distanceSquared(actor("Mara").getLocation()) <= 25) complete(p);
            if (ticks % 20 == 0) p.sendActionBar(Component.text(clean(objective(), 160), NamedTextColor.AQUA));
            update();
        }
        drainInputs(p);
        if (ticks % 20 == 0 && !polling && !talking && pendingInputs.isEmpty()) {
            polling = true;
            request("/api/inbox?playerId=" + owner, "GET", "").whenComplete((body, error) -> main(() -> {
                polling = false; if (error != null) return;
                try {
                    JsonArray messages = JsonParser.parseString(body).getAsJsonObject().getAsJsonArray("messages");
                    if (messages != null && !messages.isEmpty()) { JsonObject input = messages.get(0).getAsJsonObject(); pendingInputs.addLast(new DialogueInput(value(input, "message", ""), value(input, "npc", selectedNpc))); Player current = player(); if (current != null) drainInputs(current); }
                } catch (RuntimeException ignored) { /* Malformed local input is never executed. */ }
            }));
        }
    }
    private void moveCharacters(Player p, long now) {
        for (var entry : actors.entrySet()) {
            String name = entry.getKey(); Mob mob = actor(name); if (!(mob instanceof Villager villager)) continue;
            Location home = homes.get(name);
            boolean conversationPaused = pauses.getOrDefault(name, 0L) > now;
            if (name.equals("Elin") && phase.equals("rescued")) {
                double distance = mob.getLocation().distanceSquared(p.getLocation());
                if (conversationPaused || distance <= 5) holdFriendly(villager, p, distance <= 36);
                else if (distance > 144) { holdFriendly(villager, p, false); villager.teleport(safeBeside(p)); }
                else { villager.setAI(true); villager.getPathfinder().moveTo(p.getLocation(), .85); }
                continue;
            }
            if (name.equals("Ivo") && phase.equals("adventure") && Set.of("arrival", "trial").contains(quest.stage) && p.getLocation().getX() > 100) {
                double distance = mob.getLocation().distanceSquared(p.getLocation());
                if (conversationPaused || distance <= 12) holdFriendly(villager, p, distance <= 36);
                else if (distance > 144) { holdFriendly(villager, p, false); villager.teleport(safeBeside(p)); }
                else { villager.setAI(true); villager.getPathfinder().moveTo(p.getLocation(), .65); }
                continue;
            }
            boolean near = inReach(p, mob);
            boolean paused = conversationPaused || (near && mob.getLocation().distanceSquared(p.getLocation()) < 8);
            if (paused) holdFriendly(villager, p, near);
            else if (mob.getLocation().distanceSquared(home) > 100) { holdFriendly(villager, p, false); villager.teleport(home); }
            else if (ticks % 60 == 0) {
                Location waypoint = home.clone().add(Math.sin(ticks * .015 + name.hashCode()) * 2, 0, Math.cos(ticks * .015 + name.hashCode()) * 2);
                if (waypoint.getBlock().isPassable() && waypoint.clone().add(0, 1, 0).getBlock().isPassable()) { villager.setAI(true); villager.getPathfinder().moveTo(waypoint, .5); }
            } else if (!villager.getPathfinder().hasPath()) villager.setAI(false);
            if (near && !talking && pauses.getOrDefault(name, 0L) < now && now - greetings.getOrDefault(name, 0L) > 65000 && !name.equals("Elin")) {
                greetings.put(name, now); say(p, name, hint(name));
            }
        }
        if (built && phase.equals("adventure") && quest.activeBoss.isEmpty()) {
            String role = quest.stage.equals("sentinel") ? "Sentinel" : quest.stage.equals("warden") ? "Warden" : "";
            Mob mob = actor(role);
            if (mob != null && inReach(p, mob) && now - greetings.getOrDefault(role, 0L) > 65000 && pauses.getOrDefault(role, 0L) < now) { greetings.put(role, now); mob.lookAt(p, 40, 30); say(p, role, hint(role)); }
        }
    }
    static void holdFriendly(Villager villager, Player player, boolean look) {
        villager.setAI(false); villager.getPathfinder().stopPathfinding();
        if (look) villager.lookAt(player, 35, 35);
    }
    private Location safeBeside(Player p) {
        Location candidate = p.getLocation().clone().add(1, 0, 0);
        return candidate.getBlock().isPassable() && candidate.clone().add(0, 1, 0).getBlock().isPassable() ? candidate : p.getLocation();
    }
    private void updateBubbles(long now) {
        Iterator<Map.Entry<String, Bubble>> iterator = bubbles.entrySet().iterator();
        while (iterator.hasNext()) { var entry = iterator.next(); Mob mob = actor(entry.getKey()); Bubble bubble = entry.getValue();
            if (now > bubble.expires || mob == null || !bubble.display.isValid()) { bubble.display.remove(); iterator.remove(); }
            else bubble.display.teleport(mob.getLocation().add(0, mob.getHeight() + .6, 0));
        }
    }
    private void maintainEnemies(Player p, long now) {
        for (UUID id : new ArrayList<>(guards)) {
            Entity entity = Bukkit.getEntity(id);
            if (entity instanceof Zombie mob) {
                if (mob.getLocation().distanceSquared(scenes.trialLocation()) > 225 || mob.getLocation().getY() < 62) mob.teleport(scenes.trialLocation().clone().add(2, 0, 2));
                mob.setAI(p.getLocation().getX() > 100); mob.setTarget(p.getLocation().getX() > 100 ? p : null);
            } else { // Missing entities are replaced, never credited as player kills.
                guards.remove(id); Zombie replacement = world.spawn(scenes.trialLocation().clone().add(2, 0, 2), Zombie.class); replacement.setShouldBurnInDay(false); replacement.setRemoveWhenFarAway(false); replacement.setTarget(p); guards.add(replacement.getUniqueId());
            }
        }
        String role = quest.activeBoss; if (role.isEmpty()) return;
        Mob boss = actor(role);
        if (boss == null) { spawnBoss(role, role.equals("Sentinel") ? scenes.sentinelLocation() : scenes.bossLocation()); boss = actor(role); }
        Location home = homes.get(role);
        if (boss.getLocation().distanceSquared(home) > 225 || boss.getLocation().getY() < 62) boss.teleport(home);
        boolean paused = pauses.getOrDefault(role, 0L) > now || p.getLocation().getX() < 100;
        boss.setAI(!paused); boss.setInvulnerable(paused); boss.setTarget(paused ? null : p);
        for (UUID id : adds) if (Bukkit.getEntity(id) instanceof Mob add) { add.setAI(!paused); add.setTarget(paused ? null : p); }
    }
    private void bossMechanics(Player p, long now) {
        String name = quest.activeBoss; Mob boss = actor(name);
        if (boss == null || p.getLocation().getX() < 100 || pauses.getOrDefault(name, 0L) > now) return;
        if (name.equals("Warden") && !bossEnraged && boss.getHealth() < Objects.requireNonNull(boss.getAttribute(Attribute.MAX_HEALTH)).getValue() / 2) {
            bossEnraged = true;
            for (int side : new int[]{-1, 1}) { Zombie echo = world.spawn(scenes.bossLocation().clone().add(side * 3, 0, 3), Zombie.class); echo.customName(Component.text("Unbound Echo", NamedTextColor.RED)); echo.setCustomNameVisible(true); echo.setShouldBurnInDay(false); echo.setRemoveWhenFarAway(false); echo.setCanPickupItems(false); echo.setHealth(8); echo.setTarget(p); adds.add(echo.getUniqueId()); }
            tell(p, "The Warden's binding cracks. Two echoes join the fight; the stomp grows faster.");
        }
        if (now < nextMechanic) return;
        nextMechanic = now + (name.equals("Sentinel") ? 8500 : bossEnraged ? 6500 : 9500);
        pauses.put("bossWindup", now + 2000); if (name.equals("Sentinel")) pauses.put("shield", now + 2000);
        Location center = boss.getLocation().clone(); double radius = name.equals("Sentinel") ? 4 : 5.5;
        for (int i = 0; i < 30; i++) { double angle = i * Math.PI * 2 / 30; world.spawnParticle(name.equals("Sentinel") ? Particle.CRIT : Particle.FLAME, center.clone().add(Math.cos(angle) * radius, .2, Math.sin(angle) * radius), 2, .05, .05, .05, 0); }
        tell(p, name + (name.equals("Sentinel") ? " braces behind a shield. Leave the marked ring, then strike." : " stamps the earth. Move outside the marked ring!"));
        UUID bossId = boss.getUniqueId();
        Bukkit.getScheduler().runTaskLater(this, () -> {
            Player current = player(); Entity source = Bukkit.getEntity(bossId);
            if (current == null || source == null || !quest.activeBoss.equals(name) || !phase.equals("adventure") || !inStory(current) || pauses.getOrDefault(name, 0L) > System.currentTimeMillis()) return;
            world.spawnParticle(Particle.CLOUD, center.clone().add(0, .2, 0), 70, radius / 2, .15, radius / 2, .03); world.playSound(center, Sound.ENTITY_RAVAGER_STUNNED, .8f, name.equals("Sentinel") ? 1.4f : .7f);
            if (current.getLocation().distanceSquared(center) < radius * radius) {
                current.damage(name.equals("Sentinel") ? 3 : 5, source);
                Vector away = current.getLocation().toVector().subtract(center.toVector()); if (away.lengthSquared() < .01) away = new Vector(1, 0, 0);
                current.setVelocity(away.normalize().multiply(.8).setY(.4));
            }
        }, 40);
    }

    @EventHandler public void onJoin(PlayerJoinEvent e) { Bukkit.getScheduler().runTaskLater(this, () -> { if (e.getPlayer().isOnline()) start(e.getPlayer()); }, 20); }
    @EventHandler public void onQuit(PlayerQuitEvent e) {
        if (bar != null) bar.removePlayer(e.getPlayer()); if (encounter != null) encounter.removePlayer(e.getPlayer());
        if (owns(e.getPlayer())) for (Mob actor : actors.values()) if (!(actor instanceof Villager)) { actor.setTarget(null); actor.setAI(false); actor.setInvulnerable(true); }
    }
    @EventHandler public void onChat(AsyncChatEvent e) {
        UUID id = e.getPlayer().getUniqueId(); String message = PlainTextComponentSerializer.plainText().serialize(e.message()); e.setCancelled(true);
        main(() -> { Player p = Bukkit.getPlayer(id); if (p != null) talk(p, message, selectedNpc); });
    }
    @EventHandler public void onInteractEntity(PlayerInteractEntityEvent e) { handleNpcClick(e); }
    @EventHandler public void onInteractAtEntity(PlayerInteractAtEntityEvent e) { handleNpcClick(e); }
    private void handleNpcClick(PlayerInteractEntityEvent e) {
        String name = storyNpc(e.getRightClicked(), world, npcKey); if (name == null) return;
        e.setCancelled(true); Player p = e.getPlayer(); if (!owns(p) || !ready || !inReach(p, e.getRightClicked())) return;
        long now = System.currentTimeMillis(); UUID target = e.getRightClicked().getUniqueId();
        if (target.equals(lastClickedNpc) && now - lastNpcClick < 350) return;
        lastClickedNpc = target; lastNpcClick = now; selectedNpc = name; activeNpcEntity = target; pauses.put(name, now + 22000); greetings.put(name, now);
        if (name.equals("Ivo")) meetGuide(p);
        if (quest.rescueClick(name, phase)) {
            rescue(p); tell(p, "Elin is following you. Listen to her, then right-click again if you want to talk."); return;
        }
        String greeting = hint(name);
        Map<String, Object> open = new LinkedHashMap<>();
        open.put("version", 1); open.put("npc", name); open.put("entityId", e.getRightClicked().getEntityId()); open.put("phase", phase);
        open.put("playerId", p.getUniqueId().toString()); open.put("backendUrl", API); open.put("backendToken", backendToken());
        sendOpening(p, this, encodePayload(gson.toJson(open)), scenePayload(p, name, greeting, "scripted"));
        speak(p, name, greeting, "scripted", false); tell(p, "Speaking to " + name + ". Typed chat and /talk remain available."); publish();
    }
    static void sendOpening(Player player, Plugin plugin, byte[] open, byte[] greeting) {
        player.sendPluginMessage(plugin, OPEN, open); player.sendPluginMessage(plugin, SCENE, greeting);
    }
    static String openingGreeting(String npc, String phase, String route) {
        if (npc.equals("Mara")) return phase.equals("complete") ? "Elin is home. You kept your promise, and the village remembers how you did it." : "My compass burned toward Ember Keep when Elin vanished. Oren found drowned pages, a wind-borne bell, and living thorns. Which lead sounds true to you? We can follow proof, face the guardians, or try to keep their oaths.";
        if (npc.equals("Oren")) return phase.equals("complete") ? "Your chronicle records the witness proof, the guardians you spared or defeated, and Elin's real homecoming." : "A drowned archive remembers her name. A sky monastery rang without wind. The thornwood opened overnight. Mara's ember gate is a fourth lead. Which should we investigate, and would you seek answers, confront danger, or negotiate?";
        if (npc.equals("Elin")) return phase.equals("complete") ? "You brought me home. Thank you for walking the road with me." : phase.equals("rescued") ? "I will follow you home. Take the return arch, then walk with me to Mara." : "The trial, Sentinel and Warden still guard this refuge. Open each seal; then we can leave together.";
        return "Read the witness proof, resolve the trial, and bring the relic to the guardians. Your actions open the physical seals.";
    }
    private byte[] scenePayload(Player p, String name, String dialogue, String source) {
        Mob mob = actor(name); if (mob == null) throw new IllegalStateException("Speaker is not in the story");
        return encodePayload(gson.toJson(Map.of("version", 1, "npc", name, "entityId", mob.getEntityId(), "playerId", p.getUniqueId().toString(), "backendToken", backendToken(), "dialogue", clean(dialogue, 320), "source", source)));
    }
    static String canonicalNpc(String text) { if (text != null) for (String name : NPCS) if (name.equalsIgnoreCase(text)) return name; return null; }
    static String storyNpc(Entity entity, World storyWorld, NamespacedKey key) {
        if (!(entity instanceof LivingEntity) || !entity.getWorld().equals(storyWorld)) return null;
        String name = canonicalNpc(entity.getPersistentDataContainer().get(key, PersistentDataType.STRING)); if (name == null) return null;
        if (name.equals("Sentinel")) return entity instanceof Husk ? name : null;
        if (name.equals("Warden")) return entity instanceof Ravager ? name : null;
        return entity instanceof Villager ? name : null;
    }
    private void receiveDialogue(Player p, ClientMessage input) {
        Entity target = activeNpcEntity == null ? null : Bukkit.getEntity(activeNpcEntity); String name = target == null ? null : storyNpc(target, world, npcKey);
        if (!owns(p) || !ready || name == null || target.getEntityId() != input.entityId || !inReach(p, target)) { reply(p, selectedNpc, "Move closer and right-click the character again.", "fallback", input.requestId, true); return; }
        talk(p, input.message, name, input.requestId);
    }
    private void reply(Player p, String npc, String text, String source, String requestId, boolean error) {
        if (!p.isOnline() || requestId.isEmpty()) return;
        p.sendPluginMessage(this, REPLY, encodePayload(gson.toJson(Map.of("version", 1, "npc", npc, "dialogue", clean(text, 320), "source", source, "phase", phase, "requestId", requestId, "error", error))));
    }
    private String backendToken() {
        try { Path path = Path.of(System.getenv().getOrDefault("EVERAFTER_CLIENT_TOKEN_FILE", "../../director/runtime/client-token")); if (Files.size(path) > 128) return ""; String token = Files.readString(path).strip(); return token.matches("[a-fA-F0-9]{64}") ? token : ""; }
        catch (Exception unavailable) { return ""; }
    }
    @EventHandler public void onInteract(PlayerInteractEvent e) {
        if (!owns(e.getPlayer()) || !inStory(e.getPlayer()) || !built || e.getHand() != EquipmentSlot.HAND || e.getAction() != Action.RIGHT_CLICK_BLOCK || e.getClickedBlock() == null) return;
        if (e.getClickedBlock().getLocation().distanceSquared(scenes.clueLocation()) <= 5) { e.setCancelled(true); readClue(e.getPlayer()); }
    }
    @EventHandler public void onDeath(EntityDeathEvent e) {
        Player p = player();
        if (guards.remove(e.getEntity().getUniqueId())) {
            quest.guardsDefeated++; e.getDrops().clear(); e.setDroppedExp(0);
            if (quest.resolveTrial("gauntlet", false, guards.size()) && p != null) finishTrial(p);
            else if (guards.isEmpty() && p != null) tell(p, "The trial echoes are defeated. Read the witness pedestal if you have not yet recovered its proof.");
            update(); publish();
        }
        adds.remove(e.getEntity().getUniqueId());
        String role = storyNpc(e.getEntity(), world, npcKey);
        if (role != null && quest.defeatBoss(role, true)) { e.getDrops().clear(); e.setDroppedExp(0); resolveBoss(p, role, false); }
    }
    @EventHandler public void onDamage(EntityDamageEvent e) {
        String role = storyNpc(e.getEntity(), world, npcKey);
        if (role != null) {
            if (!role.equals(quest.activeBoss)) e.setCancelled(true);
            else if (e.getCause() != EntityDamageEvent.DamageCause.ENTITY_ATTACK && e.getCause() != EntityDamageEvent.DamageCause.ENTITY_SWEEP_ATTACK && e.getCause() != EntityDamageEvent.DamageCause.PROJECTILE) e.setCancelled(true);
            else if (role.equals("Sentinel") && pauses.getOrDefault("shield", 0L) > System.currentTimeMillis()) e.setDamage(e.getDamage() * .25);
        }
        if (e.getEntity() instanceof Player p && inStory(p)) {
            if (!owns(p) || (!phase.equals("adventure") && !phase.equals("rescued")) || p.getLocation().getX() < 100) e.setCancelled(true);
            else e.setDamage(Math.min(e.getDamage(), 5));
        }
        if (e.getEntity() instanceof TextDisplay && e.getEntity().getWorld().equals(world)) e.setCancelled(true);
    }
    @EventHandler public void onAttack(EntityDamageByEntityEvent e) {
        String role = storyNpc(e.getEntity(), world, npcKey);
        if (role != null && (!(e.getDamager() instanceof Player p) || !owns(p) || !role.equals(quest.activeBoss))) e.setCancelled(true);
        if (e.getEntity() instanceof Player p && inStory(p)) {
            boolean hostile = guards.contains(e.getDamager().getUniqueId()) || adds.contains(e.getDamager().getUniqueId());
            if (!quest.activeBoss.isEmpty() && actor(quest.activeBoss) != null) hostile |= actor(quest.activeBoss).getUniqueId().equals(e.getDamager().getUniqueId());
            if (!hostile) e.setCancelled(true);
        }
    }
    @EventHandler public void onPlayerDeath(PlayerDeathEvent e) {
        if (!inStory(e.getEntity())) return;
        e.setKeepInventory(true); e.getDrops().clear(); e.setKeepLevel(true);
        Bukkit.getScheduler().runTaskLater(this, () -> { if (e.getEntity().isOnline() && e.getEntity().isDead()) e.getEntity().spigot().respawn(); }, 30);
    }
    @EventHandler public void onRespawn(PlayerRespawnEvent e) {
        if (owns(e.getPlayer()) && ready) { e.setRespawnLocation(built && !escortHome && !phase.equals("complete") ? scenes.adventureSpawn() : scenes.villageSpawn()); tell(e.getPlayer(), "Your equipment, evidence, and opened seals are safe. The chapter still needs you."); }
    }
    @EventHandler public void onBreak(BlockBreakEvent e) { if (inStory(e.getPlayer())) e.setCancelled(true); }
    @EventHandler public void onPlace(BlockPlaceEvent e) { if (inStory(e.getPlayer())) e.setCancelled(true); }
    @EventHandler public void onDrop(PlayerDropItemEvent e) { if (inStory(e.getPlayer())) e.setCancelled(true); }
    @EventHandler public void onPortal(PlayerPortalEvent e) { if (inStory(e.getPlayer())) e.setCancelled(true); }
    @EventHandler public void onSpawn(CreatureSpawnEvent e) { if (e.getLocation().getWorld().equals(world) && e.getSpawnReason() != CreatureSpawnEvent.SpawnReason.CUSTOM) e.setCancelled(true); }
    @EventHandler public void onExplode(EntityExplodeEvent e) { if (e.getLocation().getWorld().equals(world)) e.setCancelled(true); }
    private void drainInputs(Player p) { DialogueInput input = nextInput(pendingInputs, talking); if (input != null) talk(p, input.message, input.npc); }
    static record DialogueInput(String message, String npc) {}
    static DialogueInput nextInput(Deque<DialogueInput> inputs, boolean busy) { return busy ? null : inputs.pollFirst(); }
    static boolean canDeliver(String before, String current) { return before.equals(current); }
    static String clean(String text, int limit) { if (text == null) return ""; String cleaned = text.replaceAll("[\\p{Cc}§]", " ").strip(); return cleaned.substring(0, Math.min(cleaned.length(), limit)); }
    static String value(JsonObject object, String key, String fallback) { JsonElement value = object.get(key); return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString() ? value.getAsString() : fallback; }
    static boolean requestsAction(String message, String intent, String action) {
        String text = message.toLowerCase(Locale.ROOT).replace('’', '\'');
        String words = action.equals("challenge") ? "fight|challenge|battle|attack|begin|start|ready" : "bargain|peace|spare|oath|negotiate|parley|proof|promise";
        if (text.matches("(?s).*\\b(?:not|don't|do not|avoid|no|won't)\\b.{0,28}\\b(?:" + words + ")\\b.*")) return false;
        return intent.equals(action) || text.matches("(?s).*\\b(?:" + words + ")\\b.*");
    }
    static boolean containsAnswer(String message, String solution) {
        String answer = solution.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 ]", "").strip();
        if (answer.isEmpty()) return false;
        String text = message.toLowerCase(Locale.ROOT).replace('’', '\'');
        if (text.matches("(?s).*\\b(?:not|isn't|is not|don't mean|do not mean)\\s+(?:the\\s+)?" + java.util.regex.Pattern.quote(answer) + "\\b.*")) return false;
        return java.util.regex.Pattern.compile("(?i)(?<![a-z0-9])" + java.util.regex.Pattern.quote(answer) + "(?![a-z0-9])").matcher(text).find();
    }
    static byte[] encodePayload(String text) {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8); if (bytes.length > 8192) throw new IllegalArgumentException("Dialogue payload too large");
        ByteArrayOutputStream output = new ByteArrayOutputStream(); int length = bytes.length;
        do { int part = length & 127; length >>>= 7; output.write(length == 0 ? part : part | 128); } while (length != 0);
        output.writeBytes(bytes); return output.toByteArray();
    }
    static String decodePayload(byte[] payload) {
        int length = 0, offset = 0;
        for (int shift = 0; shift < 21; shift += 7) { if (offset >= payload.length) throw new IllegalArgumentException("Missing payload length"); int part = payload[offset++] & 255; length |= (part & 127) << shift;
            if ((part & 128) == 0) { if (length > 8192 || payload.length - offset != length) throw new IllegalArgumentException("Invalid payload length"); return new String(payload, offset, length, StandardCharsets.UTF_8); }
        }
        throw new IllegalArgumentException("Invalid payload length");
    }
    static record ClientMessage(int entityId, String message, String requestId) {
        static ClientMessage parse(String json) {
            JsonObject object = JsonParser.parseString(json).getAsJsonObject(); JsonElement version = object.get("version"), entity = object.get("entityId");
            if (version == null || !version.isJsonPrimitive() || !version.getAsJsonPrimitive().isNumber() || version.getAsDouble() != 1) throw new IllegalArgumentException("Protocol version");
            String message = value(object, "message", ""), requestId = value(object, "requestId", "");
            if (message.length() > 1200 || !requestId.matches("[a-zA-Z0-9_-]{1,80}")) throw new IllegalArgumentException("Invalid dialogue");
            message = clean(message, 1200); if (message.isBlank()) throw new IllegalArgumentException("Empty dialogue");
            if (entity == null || !entity.isJsonPrimitive() || !entity.getAsJsonPrimitive().isNumber() || entity.getAsDouble() != Math.rint(entity.getAsDouble()) || entity.getAsDouble() < 0 || entity.getAsDouble() > Integer.MAX_VALUE) throw new IllegalArgumentException("Invalid entity");
            return new ClientMessage(entity.getAsInt(), message, requestId);
        }
    }

    static final class Quest {
        final Chapter chapter;
        String stage = "arrival", activeBoss = "";
        boolean clueDiscovered, artifactClaimed, artifactReturned, trialResolved, waveStarted, sentinelResolved, sentinelSpared, wardenResolved, wardenSpared, complete;
        int guardsDefeated;
        Quest(Chapter chapter) { this.chapter = chapter; }
        boolean rescueClick(String npc, String phase) { return npc.equals("Elin") && phase.equals("adventure") && stage.equals("rescue"); }
        boolean meetGuide() { if (!stage.equals("arrival")) return false; stage = "trial"; return true; }
        boolean resolveTrial(String approach, boolean answerCorrect, int guardsRemaining) {
            if (!stage.equals("trial") || trialResolved || !clueDiscovered || !chapter.trial.equals(approach)) return false;
            boolean valid = switch (approach) { case "riddle" -> answerCorrect; case "parley" -> true; case "gauntlet" -> waveStarted && guardsRemaining == 0; default -> false; };
            if (!valid) return false; trialResolved = true; artifactClaimed = true; stage = "sentinel"; return true;
        }
        boolean startBoss(String role) { if (!activeBoss.isEmpty() || !expectedBoss(role)) return false; activeBoss = role; return true; }
        boolean expectedBoss(String role) { return role.equals("Sentinel") && stage.equals("sentinel") && !sentinelResolved || role.equals("Warden") && stage.equals("warden") && !wardenResolved; }
        boolean spareBoss(String role, boolean actualArtifactPresent) {
            if (!expectedBoss(role) || !clueDiscovered || !artifactClaimed || !actualArtifactPresent || role.equals("Warden") && !sentinelSpared) return false;
            advanceBoss(role, true); return true;
        }
        boolean defeatBoss(String role, boolean actualEntityDeath) {
            if (!actualEntityDeath || !expectedBoss(role) || !activeBoss.equals(role)) return false;
            advanceBoss(role, false); return true;
        }
        private void advanceBoss(String role, boolean spared) {
            activeBoss = "";
            if (role.equals("Sentinel")) { sentinelResolved = true; sentinelSpared = spared; stage = "warden"; }
            else { wardenResolved = true; wardenSpared = spared; stage = "rescue"; }
        }
    }
    static record Chapter(String realm, String trial, String twist, String title, String hook) {
        static Chapter fallback() { return new Chapter("ember_keep", "riddle", "broken_oath", "The Ember Oath", "A burning compass points to a guardian's broken promise."); }
        static Chapter parse(JsonElement element) {
            if (element == null || element.isJsonNull()) return fallback();
            JsonObject object = element.getAsJsonObject();
            String realm = value(object, "realm", ""), trial = value(object, "trial", ""), twist = value(object, "twist", ""), title = value(object, "title", ""), hook = value(object, "hook", "");
            if (!Set.of("ember_keep", "sunken_archive", "sky_monastery", "thornwild").contains(realm) || !Set.of("riddle", "gauntlet", "parley").contains(trial) || !Set.of("broken_oath", "false_trail", "willing_guardian").contains(twist) || title.isBlank() || title.length() > 64 || hook.isBlank() || hook.length() > 160) throw new IllegalArgumentException("Invalid chapter");
            return new Chapter(realm, trial, twist, clean(title, 64), clean(hook, 160));
        }
    }
    static record Decision(String dialogue, String route, String mood, int difficulty, String objective, String source, Chapter chapter, String intent, String answer) {
        Decision(String dialogue, String route, String mood, int difficulty, String objective, String source) { this(dialogue, route, mood, difficulty, objective, source, Chapter.fallback(), "none", ""); }
        static Decision fallback() { return new Decision(openingGreeting("Mara", "village", "mystery"), "mystery", "eerie", 1, "Follow a village lead and find Elin.", "fallback"); }
        static Decision fallback(String phase, Decision current) {
            String text = phase.equals("complete") ? "Elin is safely home. The village remembers your actual choices." : phase.equals("rescued") ? "Elin is free and follows you. Return home, then walk with her to Mara." : phase.equals("adventure") ? "Read the witness proof, resolve the trial, then face or negotiate with Sentinel and Warden. Follow your compass." : openingGreeting("Mara", phase, current.route);
            return new Decision(text, current.route, current.mood, current.difficulty, phase.equals("complete") ? "Elin is home." : phase.equals("rescued") ? "Return home with Elin and walk to Mara." : "Follow the witness trail and rescue Elin.", "fallback", current.chapter, "none", "");
        }
        static Decision parse(String json) { return parse(json, "village", fallback()); }
        static Decision parse(String json, String phase, Decision current) {
            try {
                JsonObject object = JsonParser.parseString(json).getAsJsonObject(); String route = value(object, "route", ""), mood = value(object, "mood", ""), dialogue = clean(value(object, "dialogue", ""), 320);
                if (!Set.of("mystery", "combat", "hybrid").contains(route) || !Set.of("eerie", "wonder").contains(mood) || dialogue.isBlank()) return fallback(phase, current);
                JsonElement difficulty = object.get("difficulty"); if (difficulty == null || !difficulty.isJsonPrimitive() || !difficulty.getAsJsonPrimitive().isNumber()) return fallback(phase, current);
                double number = difficulty.getAsDouble(); if (!Double.isFinite(number) || number != Math.rint(number)) return fallback(phase, current);
                String source = value(object, "source", "fallback"), intent = value(object, "intent", "none"), answer = value(object, "answer", "");
                if (!Set.of("none", "answer", "challenge", "bargain").contains(intent) || answer.length() > 40) return fallback(phase, current);
                if (!Set.of("mubit", "openrouter", "fallback").contains(source)) source = "fallback";
                Chapter chapter = Chapter.parse(object.get("chapter"));
                if (!phase.equals("village")) return new Decision(dialogue, current.route, current.mood, current.difficulty, clean(value(object, "objective", current.objective), 160), source, current.chapter, intent, clean(answer, 40));
                return new Decision(dialogue, route, mood, (int) Math.clamp(number, 1, 3), clean(value(object, "objective", "Find Elin."), 160), source, chapter, intent, clean(answer, 40));
            } catch (RuntimeException invalid) { return fallback(phase, current); }
        }
    }
}
