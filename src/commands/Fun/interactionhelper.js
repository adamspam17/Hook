import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

// Central error handler mirroring your command architecture
async function replyUserError(interaction, message) {
  return await InteractionHelper.safeEditReply(interaction, {
    embeds: [
      createEmbed({
        title: '⚠️ Command Issue',
        description: message,
        color: 'danger', 
      }),
    ],
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('Advanced tracking for Roblox players and experiences')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('player')
        .setDescription('Deep-dive into a player\'s profile, account age, and active gameplay status')
        .addStringOption((option) =>
          option
            .setName('target')
            .setDescription('Roblox Username or numerical User ID')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('game')
        .setDescription('Fetch complete metrics including active players, like ratios, and platform configurations')
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('The Universe ID of the Roblox game')
            .setRequired(true),
        ),
    ),
  category: 'Utility',

  async execute(interaction) {
    try {
      const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      if (!deferSuccess) {
        logger.warn('Roblox advanced command defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      // ==========================================
      // SUBCOMMAND: DETAILED PLAYER SEARCH
      // ==========================================
      if (subcommand === 'player') {
        const target = interaction.options.getString('target').trim();
        let userId;

        // Step 1: Resolve Target to User ID
        if (isNaN(target)) {
          const searchRes = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(target)}&limit=1`);
          const searchData = await searchRes.json();
          
          if (!searchData.data || searchData.data.length === 0) {
            return await replyUserError(interaction, `Could not find a Roblox user named **${target}**.`);
          }
          userId = searchData.data[0].id;
        } else {
          userId = target;
        }

        // Step 2: Parallel fetch full profile details and presence status data
        const [profileRes, presenceRes] = await Promise.all([
          fetch(`https://users.roblox.com/v1/users/${userId}`),
          fetch('https://presence.roblox.com/v1/presence/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: [parseInt(userId)] }),
          })
        ]);

        if (!profileRes.ok) {
          return await replyUserError(interaction, `Could not retrieve data for Roblox ID **${userId}**.`);
        }

        const profileData = await profileRes.json();
        const presenceData = await presenceRes.json();
        const presence = presenceData.userPresences?.[0];

        // Format Timestamps
        const createdTimestamp = Math.floor(new Date(profileData.created).getTime() / 1000);
        
        // Map states
        const presenceMap = { 0: 'Offline 🔴', 1: 'Online 🟢', 2: 'In Game 🎮', 3: 'In Studio 🛠️' };
        const statusLabel = presenceMap[presence?.userPresenceType] || 'Hidden/Unknown 👤';

        const fields = [
          { name: 'Display Name', value: profileData.displayName || 'None', inline: true },
          { name: 'Username', value: `[@${profileData.name}](https://www.roblox.com/users/${userId}/profile)`, inline: true },
          { name: 'User ID', value: `\`${userId}\``, inline: true },
          { name: 'Account Created', value: `<t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`, inline: false },
          { name: 'Status Connection', value: statusLabel, inline: true },
        ];

        // Process live presence locations
        if (presence) {
          if (presence.userPresenceType === 2 && presence.rootPlaceId) {
            const gameLink = `https://www.roblox.com/games/${presence.rootPlaceId}`;
            fields.push({
              name: 'Active Session',
              value: presence.lastLocation 
                ? `Playing: **${presence.lastLocation}**\n[Join/View Experience](${gameLink})` 
                : `Playing Game ID: [${presence.rootPlaceId}](${gameLink})`,
              inline: false,
            });
          } else if (presence.userPresenceType === 3 && presence.lastLocation) {
            fields.push({ name: 'Active Working Session', value: `Editing: *${presence.lastLocation}*`, inline: false });
          }

          if (presence.lastOnline && presence.userPresenceType === 0) {
            const lastOnlineTimestamp = Math.floor(new Date(presence.lastOnline).getTime() / 1000);
            fields.push({ name: 'Last Spotted', value: `<t:${lastOnlineTimestamp}:F> (<t:${lastOnlineTimestamp}:R>)`, inline: false });
          }
        }

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: `Roblox User Intelligence Profile`,
              description: profileData.description ? `*"${profileData.description.substring(0, 240)}"*` : '*No description bio provided.*',
              fields,
              color: 'primary',
              thumbnail: { url: `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png` }
            }),
          ],
        });
      }

      // ==========================================
      // SUBCOMMAND: DETAILED GAME INTEL
      // ==========================================
      if (subcommand === 'game') {
        const gameId = interaction.options.getString('id').trim();

        if (isNaN(gameId)) {
          return await replyUserError(interaction, 'Please provide a valid numerical Universe ID.');
        }

        // Fetch deep core telemetry data + community ratings concurrently
        const [gameRes, voteRes] = await Promise.all([
          fetch(`https://games.roblox.com/v1/games?universeIds=${gameId}`),
          fetch(`https://games.roblox.com/v1/games/votes?universeIds=${gameId}`)
        ]);

        const gameData = await gameRes.json();
        const voteData = await voteRes.json();

        if (!gameData.data || gameData.data.length === 0) {
          return await replyUserError(interaction, `Could not find an experience matching Universe ID **${gameId}**. Check that this isn't a Place Asset ID instead.`);
        }

        const game = gameData.data[0];
        const voteInfo = voteData.data?.[0];

        // Compute Like/Dislike Matrix accurately
        let ratingFieldString = 'No ratings logged';
        if (voteInfo) {
          const totalVotes = voteInfo.upVotes + voteInfo.downVotes;
          const ratio = totalVotes > 0 ? ((voteInfo.upVotes / totalVotes) * 100).toFixed(1) : 0;
          ratingFieldString = `👍 ${voteInfo.upVotes.toLocaleString()} / 👎 ${voteInfo.downVotes.toLocaleString()} (\`${ratio}%\`)`;
        }

        const fields = [
          { name: 'Active Concurrent Players', value: `👤 **${game.playing.toLocaleString()}**`, inline: true },
          { name: 'Total Lifetime Traffic', value: `📈 ${game.visits.toLocaleString()} visits`, inline: true },
          { name: 'Community Favorited', value: `⭐ ${game.favoritedCount.toLocaleString()} times`, inline: true },
          { name: 'Rating Ratio', value: ratingFieldString, inline: false },
          { name: 'Developer/Studio Creator', value: `[${game.creator.name}](https://www.roblox.com/users/${game.creator.id}/profile) (\`${game.creator.type}\`)`, inline: true },
          { name: 'Max Server Bound', value: `👥 ${game.maxPlayers} slots`, inline: true },
          { name: 'Copying/Genre Safety', value: game.genre || 'Not Defined', inline: true },
        ];

        // Append historical date snapshots if structural rules give properties
        if (game.created && game.updated) {
          const createdTime = Math.floor(new Date(game.created).getTime() / 1000);
          const updatedTime = Math.floor(new Date(game.updated).getTime() / 1000);
          fields.push(
            { name: 'Original Launch', value: `<t:${createdTime}:D>`, inline: true },
            { name: 'Latest Production Patch', value: `<t:${updatedTime}:R>`, inline: true }
          );
        }

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: `🎮 Experience Diagnostics: ${game.name}`,
              description: game.description ? game.description.substring(0, 400) + '...' : '*No experience summary text standard.*',
              url: `https://www.roblox.com/games/${game.rootPlaceId}`,
              fields,
              color: 'primary',
            }),
          ],
        });
      }

    } catch (error) {
      logger.error('Roblox tracking diagnostics error:', error);
      return await replyUserError(interaction, 'Critical structural exception occurred while contacting external API dependencies.');
    }
  },
};
