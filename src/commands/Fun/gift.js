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
    .setDescription('Generates a realistic self-gift Nitro card prank')
    .setDMPermission(false),
  category: 'Fun',

  async execute(interaction) {
    try {
      // Defer publicly so everyone in the channel can view and interact with the bait
      const deferSuccess = await InteractionHelper.safeDefer(interaction);
      if (!deferSuccess) {
        logger.warn('Gift command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      // Generate a mock random string to look like a genuine Discord gift code
      const fakeCode = Math.random().toString(36).substring(2, 17).toUpperCase();
      
      // Formatting the embed card to perfectly replicate the image_7a5936.png template
      const prankEmbed = new EmbedBuilder()
        .setTitle("You gifted a subscription!")
        .setDescription("If you want to claim this gift for yourself, go right ahead. We won't judge :)")
        .setImage('https://i.imgur.com/AVwuXoN.png') // The exact image asset matching your link
        .setFooter({ text: 'Expires in -5 hours' })
        .setColor(0x282b30); // Dark theme blending color

      // Creating the actual interactive "Accept" button below the image
      const acceptButton = new ButtonBuilder()
        .setCustomId('fake_nitro_accept')
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success); // Renders the button a vibrant green

      const row = new ActionRowBuilder().addComponents(acceptButton);

      return await InteractionHelper.safeEditReply(interaction, {
        content: `https://discord.gift/${fakeCode}`,
        embeds: [prankEmbed],
        components: [row],
      });
    } catch (error) {
      logger.error('Gift command error:', error);
    }
  },
};
