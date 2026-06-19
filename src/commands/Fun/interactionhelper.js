import { SlashCommandBuilder, MessageFlags, EmbedBuilder } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

// Helper function to handle error replies using your style
async function replyUserError(interaction, message) {
  return await InteractionHelper.safeEditReply(interaction, {
    embeds: [
      createEmbed({
        title: 'Error',
        description: message,
        color: 'danger', // maps to your error color config
      }),
    ],
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('Track Roblox players and game statuses')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('player')
        .setDescription('View a player\'s online status and what they are playing')
        .addStringOption((option) =>
          option
            .setName('target')
            .setDescription('The Roblox Username or User ID')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('game')
        .setDescription('View live stats for a specific Roblox game (Universe ID)')
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('The Roblox Game/Universe ID')
            .setRequired(true),
        ),
    ),
  category: 'Utility',

  async execute(interaction) {
    try {
      const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      if (!deferSuccess) {
        logger.warn('Roblox command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      // ==========================================
      // SUBCOMMAND: PLAYER STATUS
      // ==========================================
      if (subcommand === 'player') {
        const target = interaction.options.getString('target');
        let userId = target;
        let username = target;

        // 1. If input is not purely a number, search for the User ID via Username
        if (isNaN(target)) {
          const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(target)}&limit=1`);
          const searchData = await searchRes.json();
          
          if (!searchData.data || searchData.data.length === 0) {
            return await replyUserError(interaction, `Could not find a Roblox user named **${target}**.`);
          }
          userId = searchData.data[0].id;
          username = searchData.data[0].name;
        } else {
          // If it's a number, verify the user exists and grab their real username
          const userRes = await fetch(`https://users.roblox.com/v1/users/${target}`);
          if (!userRes.ok) {
            return await replyUserError(interaction, `Could not find a Roblox user with ID **${target}**.`);
          }
          const userData = await userRes.json();
          username = userData.name;
        }

        // 2. Fetch User Presence (Online Status & Current Game)
        const presenceRes = await fetch('https://presence.roblox.com/v1/presence/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: [parseInt(userId)] }),
        });
        const presenceData = await presenceRes.json();
        const presence = presenceData.userPresences?.[0];

        if (!presence) {
          return await replyUserError(interaction, 'Failed to retrieve presence details for this user.');
        }

        // Presence Types: 0 = Offline, 1 = Online, 2 = InGame, 3 = InStudio
        const presenceMap = { 0: 'Offline 🔴', 1: 'Online 🟢', 2: 'In Game 🎮', 3: 'In Studio 🛠️' };
        const statusLabel = presenceMap[presence.userPresenceType] || 'Unknown';
        
        const fields = [
          { name: 'Username', value: `[${username}](https://www.roblox.com/users/${userId}/profile)`, inline: true },
          { name: 'User ID', value: `${userId}`, inline: true },
          { name: 'Current Status', value: statusLabel, inline: true },
        ];

        // If the user is actively in a game, extract game details
        if (presence.userPresenceType === 2 && presence.rootPlaceId) {
          fields.push({
            name: 'Currently Playing',
            value: presence.lastLocation || `Place ID: [${presence.rootPlaceId}](https://www.roblox.com/games/${presence.rootPlaceId})`,
            inline: false,
          });
        }

        if (presence.lastOnline) {
          const timestamp = Math.floor(new Date(presence.lastOnline).getTime() / 1000);
          fields.push({ name: 'Last Seen Online', value: `<t:${timestamp}:F> (<t:${timestamp}:R>)`, inline: false });
        }

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: `Roblox Profile: ${username}`,
              fields,
              color: 'primary',
              thumbnail: { url: `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png` }
            }),
          ],
        });
      }

      // ==========================================
      // SUBCOMMAND: GAME STATUS
      // ==========================================
      if (subcommand === 'game') {
        const gameId = interaction.options.getString('id');

        if (isNaN(gameId)) {
          return await replyUserError(interaction, 'Please provide a valid numerical Universe ID or Place ID.');
        }

        // Fetch details from the Roblox games API (Requires Universe ID)
        const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${gameId}`);
        const gameData = await gameRes.json();

        if (!gameData.data || gameData.data.length === 0) {
          return await replyUserError(interaction, `Could not find game data for ID **${gameId}**. Ensure you are using the **Universe ID** (not always the URL asset ID).`);
        }

        const game = gameData.data[0];
        
        const fields = [
          { name: 'Active Players', value: `${game.playing.toLocaleString()}`, inline: true },
          { name: 'Total Visits', value: `${game.visits.toLocaleString()}`, inline: true },
          { name: 'Favorites', value: `${game.favoritedCount.toLocaleString()}`, inline: true },
          { name: 'Creator', value: `[${game.creator.name}](https://www.roblox.com/users/${game.creator.id}/profile) (${game.creator.type})`, inline: true },
          { name: 'Max Players', value: `${game.maxPlayers}`, inline: true },
          { name: 'Allowed Gear', value: game.allowedGearCategories?.length > 0 ? game.allowedGearCategories.join(', ') : 'None', inline: true },
        ];

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: game.name,
              description: game.description ? game.description.substring(0, 300) + '...' : 'No description provided.',
              url: `https://www.roblox.com/games/${game.rootPlaceId}`,
              fields,
              color: 'primary',
            }),
          ],
        });
      }

      return await replyUserError(interaction, 'Please choose a valid Roblox action.');
    } catch (error) {
      logger.error('Roblox command error:', error);
      return await replyUserError(interaction, 'Something went wrong while communicating with the Roblox API.');
    }
  },
};