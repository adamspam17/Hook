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
    .setDescription('Generates a realistic Nitro verification prank')
    .setDMPermission(false),
  category: 'Fun',

  async execute(interaction) {
    try {
      // Defer publicly so the trap is visible to everyone in the channel
      const deferSuccess = await InteractionHelper.safeDefer(interaction);
      if (!deferSuccess) {
        logger.warn('Gift command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      // Generate a mock random gift code for the initial URL text
      const fakeCode = Math.random().toString(36).substring(2, 17).toUpperCase();
      
      // Building the embed to match Screenshot 2026-06-20 144211.png but with the new banner link
      const prankEmbed = new EmbedBuilder()
        .setTitle("You've been gifted a subscription!")
        .setDescription("you Nitro for **1 year**!")
        .setImage('https://i.imgur.com/GPkHJhB.png') // Your new image swapped into the top banner slot
        .setFooter({ text: 'Expires in 5 hours' })
        .setColor(0xffffff); // Pure white color for the clean light-theme appearance

      // Creating the realistic green "Verify" button to display right below the embed card
      const verifyButton = new ButtonBuilder()
        .setCustomId('fake_nitro_accept')
        .setLabel('Verify')
        .setStyle(ButtonStyle.Success); // Vibrant green action button

      const row = new ActionRowBuilder().addComponents(verifyButton);

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
