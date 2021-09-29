import {
  CommandInteraction,
  ContextMenuInteraction,
  Interaction,
  InteractionButtonOptions,
  InteractionReplyOptions,
  Message,
  MessageActionRow,
  MessageButton,
  MessageComponentInteraction,
  MessageEmbed,
} from 'discord.js';

export interface PageButtonOptions {
  /**
   * The style of the button.
   */
  style?: InteractionButtonOptions['style'];

  /**
   * The text to be displayed on the next button (Defaults to 'Next').
   */
  nextLabel?: string;

  /**
   * The text to be displayed on the previous button. (Defaults to 'Previous').
   */
  previousLabel?: string;

  /**
   * The message to be alongside the paginated embeds.
   */
  content?: string;

  /**
   * Whether or not to show the current page in the footer of each embed (Defaults to being shown).
   */
  showPagePosition?: boolean;

  /**
   * How long the paginator should run for in ms. (Default is 30min)
   */
  time?: number;

  /**
   * The label that displays in the page position footer.
   */
  pageLabel?: string;
}

// Default to half an hour.
const defaultTime = 1800000;

/**
 * Sends a paginated message from the given embeds.
 * @param interaction The interaction to reply to.
 * @param embeds The array of embeds to use.
 */
export async function sendPaginatedEmbeds(
  interaction:
    | Message
    | CommandInteraction
    | MessageComponentInteraction
    | ContextMenuInteraction,
  embeds: MessageEmbed[],
  options?: PageButtonOptions
): Promise<void> {
  let currentPage = 0;

  // Precheck
  if (interaction instanceof Interaction && interaction.replied) {
    throw new Error('Cannot paginate when interaction is already replied to.');
  }

  const generateOptionsForPage = (page: number): InteractionReplyOptions => {
    const beginning = page === 0;
    const end = page === embeds.length - 1;
    const currentEmbed = embeds[page];

    const buttonStyle = options?.style ?? 'PRIMARY';

    if (!currentEmbed) {
      throw new Error('Embed page number out of bounds');
    }

    const nextButton = new MessageButton()
      .setCustomId('nextButton')
      .setLabel(options?.nextLabel ?? 'Next')
      .setStyle(buttonStyle);

    if (end) {
      nextButton.disabled = true;
    }

    const previousButton = new MessageButton()
      .setCustomId('previousButton')
      .setLabel(options?.previousLabel ?? 'Previous')
      .setStyle(buttonStyle);

    if (beginning) {
      previousButton.disabled = true;
    }

    const row = new MessageActionRow().addComponents([
      previousButton,
      nextButton,
    ]);

    if ((options?.showPagePosition ?? true) === true) {
      currentEmbed.setFooter(
        `${options?.pageLabel ?? 'Page'} ${currentPage + 1} of ${embeds.length}`
      );
    }

    return {
      embeds: [currentEmbed],
      components: [row],
    };
  };

  const messageOptions = generateOptionsForPage(0);

  let message: Message;

  if (interaction instanceof Interaction) {
    message = interaction.deferred
      ? ((await interaction.followUp({
          ...messageOptions,
          fetchReply: true,
          content: options?.content,
        })) as Message)
      : ((await interaction.reply({
          ...messageOptions,
          fetchReply: true,
          content: options?.content,
        })) as Message);
  } else {
    message = await interaction.reply({
      ...messageOptions,
      content: options?.content,
    });
  }

  const collector = message.createMessageComponentCollector({
    componentType: 'BUTTON',
    time: options?.time ?? defaultTime,
  });

  collector.on('collect', async (collectInteraction) => {
    await collectInteraction.deferUpdate();
    if (!collectInteraction.isButton()) {
      return;
    }

    if (collectInteraction.customId === 'nextButton') {
      currentPage++;
    } else {
      currentPage--;
    }

    const replyOptions = generateOptionsForPage(currentPage);
    await collectInteraction.editReply(replyOptions);
  });

  collector.on('end', async () => {
    if (!message.editable) {
      return;
    }
    // remove footer if enabled
    if (
      options?.showPagePosition === undefined ||
      options?.showPagePosition === true
    ) {
      const [embed] = message.embeds;

      if (embed) {
        embed.footer = null;
        await message.edit({ components: [], embeds: [embed] });
        return;
      }
    }

    await message.edit({ components: [] });
  });
}
