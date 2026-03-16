import { getGraphClient } from './graphClient';
import { getEnv } from '../../config/env';
import { getLogger } from '../../config/logger';
import { IncomingEmail } from '../../shared/types';
import { ExternalServiceError } from '../../shared/errors';

const logger = getLogger('outlook-service');

// =============================================================================
// Outlook Email Service - Reads emails from the automation inbox via Graph API
// =============================================================================

interface GraphMessage {
  id: string;
  internetMessageId: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  receivedDateTime: string;
  body: {
    contentType: string;
    content: string;
  };
  bodyPreview: string;
  hasAttachments: boolean;
  conversationId: string;
  isRead: boolean;
}

export class OutlookService {
  /**
   * Fetches unread messages from the automation inbox.
   * Returns newest first, limited to a configurable batch size.
   */
  async fetchUnreadMessages(batchSize: number = 20): Promise<IncomingEmail[]> {
    const env = getEnv();
    const client = getGraphClient();
    const inbox = env.AUTOMATION_INBOX_EMAIL;

    try {
      const result = await client
        .api(`/users/${inbox}/mailFolders/inbox/messages`)
        .filter('isRead eq false')
        .select(
          'id,internetMessageId,subject,from,receivedDateTime,body,bodyPreview,hasAttachments,conversationId'
        )
        .orderby('receivedDateTime desc')
        .top(batchSize)
        .get();

      const messages: GraphMessage[] = result.value || [];
      logger.info({ count: messages.length }, 'Fetched unread messages from inbox');

      return messages.map((msg) => this.toIncomingEmail(msg));
    } catch (error) {
      throw new ExternalServiceError(
        'Outlook',
        `Failed to fetch messages: ${(error as Error).message}`
      );
    }
  }

  /**
   * Marks a message as read in the inbox.
   */
  async markAsRead(messageId: string): Promise<void> {
    const env = getEnv();
    const client = getGraphClient();

    try {
      await client
        .api(`/users/${env.AUTOMATION_INBOX_EMAIL}/messages/${messageId}`)
        .update({ isRead: true });

      logger.debug({ messageId }, 'Marked message as read');
    } catch (error) {
      logger.error({ messageId, err: error }, 'Failed to mark message as read');
      // Non-critical: don't throw, log and continue
    }
  }

  /**
   * Strips HTML tags from email body to get plain text.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toIncomingEmail(msg: GraphMessage): IncomingEmail {
    const fromAddress = msg.from?.emailAddress?.address || '';
    const domain = fromAddress.split('@')[1]?.toLowerCase() || '';

    return {
      messageId: msg.id,
      internetMessageId: msg.internetMessageId,
      subject: msg.subject || '(no subject)',
      from: fromAddress,
      fromDomain: domain,
      receivedAt: new Date(msg.receivedDateTime),
      body: this.stripHtml(msg.body?.content || ''),
      bodyPreview: msg.bodyPreview || '',
      hasAttachments: msg.hasAttachments,
      conversationId: msg.conversationId || '',
    };
  }
}
