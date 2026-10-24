package ai.everafter.client.mixin;

import ai.everafter.client.EverafterClient;
import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Latch short physical taps without consuming vanilla's queued use clicks. */
@Mixin(KeyMapping.class)
abstract class UseKeyMixin {
    @Inject(method = "set", at = @At("HEAD"))
    private static void everafterUseInput(InputConstants.Key key, boolean pressed, CallbackInfo info) {
        Minecraft client = Minecraft.getInstance();
        if (client.options != null && client.options.keyUse.saveString().equals(key.getName())) EverafterClient.observeUse(pressed);
    }
}
