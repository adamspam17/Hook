import { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  MessageFlags, 
  EmbedBuilder 
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Generates a realistic Nitro gift card prank')
    .setDMPermission(false),
  category: 'Fun',

  async execute(interaction) {
    try {
      // Defer publicly so the whole channel sees the bait message
      const deferSuccess = await InteractionHelper.safeDefer(interaction);
      if (!deferSuccess) {
        logger.warn('Gift command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      // Generate a random mock code for the fake URL string
      const fakeCode = Math.random().toString(36).substring(2, 17).toUpperCase();
      
      // Formatting the embed to match the second image template layout
      const prankEmbed = new EmbedBuilder()
        .setTitle("You've been gifted a subscription!")
        .setDescription(`**${interaction.user.username}** has gifted you Nitro for **1 month**!`)
        // Setting the wide Nitro banner directly as the main image
        .setImage('https://i.imgur.com/w9reU93.png') 
        .setFooter({ text: 'Expires in 47 hours' })
        .setColor(0x282b30); // Dark background blending color

      // Setting up the Success style button to render it Green
      const acceptButton = new ButtonBuilder()
        .setCustomId('fake_nitro_accept')
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success); // Green button matching image_844ddf.png

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