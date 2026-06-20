import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, infoEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { getUserLastActiveTimestamp } from '../../services/userService.js'; // Placeholder for your database service

export default {
  data: new SlashCommandBuilder()
    .setName('lastactive')
    .setDescription('Checks the exact day and time a user was last active or online')
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user or User ID to look up')
        .setRequired(true)
    ),
  category: 'Utility',

  async execute(interaction) {
    try {
      const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      if (!deferSuccess) {
        logger.warn('Lastactive command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      const targetUser = interaction.options.getUser('user');
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [infoEmbed('User Not Found', 'That user does not appear to be a member of this server.')],
        });
      }

      // 1. Check current live Gateway Presence data
      const presence = member.presence;
      let statusLabel = 'Offline';
      let currentActivity = 'None';

      if (presence) {
        const statusMap = {
          online: '🟢 Online',
          idle: '🌙 Idle',
          dnd: '🔴 Do Not Disturb',
          offline: '⚫ Offline',
        };
        statusLabel = statusMap[presence.status] || 'Unknown';

        if (presence.activities.length > 0) {
          const act = presence.activities[0];
          currentActivity = `${act.type === 0 ? 'Playing' : act.type === 2 ? 'Listening to' : 'Watching'} **${act.name}**`;
        }
      }

      // 2. Fetch the last recorded database timestamp of bot interaction
      // This returns a standard Date object or null from your DB tracking layer
      const lastBotInteraction = await getUserLastActiveTimestamp(interaction.client, interaction.guildId, targetUser.id);
      
      let dbStatusString = 'No recent bot interactions recorded.';
      if (lastBotInteraction) {
        // Utilizing Discord's native markdown timestamp formats:
        // <t:TIMESTAMP:F> = Full Date/Time (e.g., June 20, 2026 3:38 PM)
        // <t:TIMESTAMP:R> = Relative Time (e.g., 5 minutes ago)
        const unixTime = Math.floor(lastBotInteraction.getTime() / 1000);
        dbStatusString = `<t:${unixTime}:F> (<t:${unixTime}:R>)`;
      }

      const fields = [
        { name: 'Current Status', value: statusLabel, inline: true },
        { name: 'Current Activity', value: currentActivity, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Last Bot Interaction', value: dbStatusString, inline: false },
      ];

      return await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          createEmbed({
            title: `Activity Profile: ${targetUser.username}`,
            description: `Tracking analysis for <@${targetUser.id}>.`,
            fields,
            color: 'primary',
          }),
        ],
      });
    } catch (error) {
      logger.error('Lastactive command error:', error);
      return await InteractionHelper.safeEditReply(interaction, { content: 'Something went wrong while retrieving activity logs.' });
    }
  },
};