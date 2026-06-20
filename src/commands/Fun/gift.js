import { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder 
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Generates a realistic Nitro claim pop-up prank')
    .setDMPermission(false),
  category: 'Fun',

  async execute(interaction) {
    try {
      // Defer publicly so the whole channel can interact with it
      const deferSuccess = await InteractionHelper.safeDefer(interaction);
      if (!deferSuccess) {
        logger.warn('Gift command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      // Generate a mock gift URL code
      const fakeCode = Math.random().toString(36).substring(2, 17).toUpperCase();
      
      // Formatting the embed card to perfectly match the claim-nitro-gift layout
      const prankEmbed = new EmbedBuilder()
        .setTitle("You've been gifted Nitro")
        .setDescription("Once you accept you will have Nitro for **1 month**.")
        .setImage('https://i.imgur.com/3shOs2c.png') // Your exact new image asset
        .setColor(0x2f3136); // Discord dark theme background color matching the pop-up

      // Creating the "I accept" Blurple button matching the new image interface
      const acceptButton = new ButtonBuilder()
        .setCustomId('fake_nitro_accept')
        .setLabel('I accept')
        .setStyle(ButtonStyle.Primary); // Renders the button Blurple/Blue

      const row = new ActionRowBuilder().addComponents(acceptButton);

      return await InteractionHelper.safeEditReply(interaction, {
        content: `✨ I got something for ya! ✨\nhttps://discord.gift/${fakeCode}`,
        embeds: [prankEmbed],
        components: [row],
      });
    } catch (error) {
      logger.error('Gift command error:', error);
    }
  },
};
