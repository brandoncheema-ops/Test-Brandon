import { IncomingEmail } from '../../src/shared/types';

// =============================================================================
// Sample Email Fixtures for Testing
// These represent realistic freeform hiring emails.
// =============================================================================

export const sampleEmails: Record<string, IncomingEmail> = {
  /**
   * Clean MD shareholder track request with most fields present.
   */
  mdShareholderComplete: {
    messageId: 'AAMkAGIxMjY2ZjEz-001',
    internetMessageId: '<msg-001@balcpa.com>',
    subject: 'FW: New Physician Hire - Dr. Sarah Chen',
    from: 'hiring.manager@balcpa.com',
    fromDomain: 'balcpa.com',
    receivedAt: new Date('2026-03-15T10:30:00Z'),
    body: `Hi team,

We've finalized details with Dr. Sarah Chen. Please prepare the employment contract with the following terms:

Name: Dr. Sarah Elizabeth Chen
Position: Physician (Anesthesiologist)
Track: Shareholder/Partner track
Start Date: July 1, 2026

Compensation:
- Year 1 base salary: $420,000
- Year 2 base salary: $450,000
- Production bonus: 25% of collections above $600K threshold
- Signing bonus: $25,000

Vacation: 5 weeks PTO plus CME time

She'll be doing primarily cardiac cases at Memorial and St. Joseph's.

Let me know if you need anything else to get the contract drawn up.

Thanks,
Dr. Michael Roberts
Chief of Anesthesiology`,
    bodyPreview: "Hi team, We've finalized details with Dr. Sarah Chen...",
    hasAttachments: false,
    conversationId: 'conv-001',
  },

  /**
   * Messy freeform email with incomplete information.
   */
  crnaIncomplete: {
    messageId: 'AAMkAGIxMjY2ZjEz-002',
    internetMessageId: '<msg-002@balcpa.com>',
    subject: 'new crna starting soon',
    from: 'dr.jones@balcpa.com',
    fromDomain: 'balcpa.com',
    receivedAt: new Date('2026-03-14T15:45:00Z'),
    body: `hey can you guys draw up a contract for a new CRNA we're bringing on?

His name is James Rodriguez. He's great, worked with him at my last place.

We talked about around 200k for salary but need to finalize. He wants to start sometime in August.

thanks
Dr. Jones`,
    bodyPreview: 'hey can you guys draw up a contract for a new CRNA...',
    hasAttachments: false,
    conversationId: 'conv-002',
  },

  /**
   * MD non-shareholder track with typical details.
   */
  mdNonShareholder: {
    messageId: 'AAMkAGIxMjY2ZjEz-003',
    internetMessageId: '<msg-003@balcpa.com>',
    subject: 'RE: Employment Agreement - Dr. Patel',
    from: 'admin@balcpa.com',
    fromDomain: 'balcpa.com',
    receivedAt: new Date('2026-03-13T09:15:00Z'),
    body: `Following up on our conversation about Dr. Amir Patel's contract.

He will be joining as a staff anesthesiologist (non-partner track) starting September 15, 2026.

Salary: $380,000 annual
Vacation: 4 weeks
No shareholder/partnership eligibility at this time.

He'll need malpractice tail coverage from his previous employer.

Please prepare the non-shareholder physician agreement.

Best,
Lisa Thompson
Practice Administrator`,
    bodyPreview: "Following up on our conversation about Dr. Patel's contract...",
    hasAttachments: false,
    conversationId: 'conv-003',
  },

  /**
   * Not a hiring email - should be classified as non-hire.
   */
  notAHireEmail: {
    messageId: 'AAMkAGIxMjY2ZjEz-004',
    internetMessageId: '<msg-004@balcpa.com>',
    subject: 'RE: Staff Meeting Next Tuesday',
    from: 'admin@balcpa.com',
    fromDomain: 'balcpa.com',
    receivedAt: new Date('2026-03-12T14:00:00Z'),
    body: `Hi everyone,

Just a reminder that we have our monthly staff meeting next Tuesday at 2 PM in the main conference room.

Agenda:
1. Q1 Revenue review
2. New scheduling software demo
3. Holiday coverage assignments

Please confirm your attendance.

Thanks,
Lisa`,
    bodyPreview: 'Hi everyone, Just a reminder that we have our monthly staff meeting...',
    hasAttachments: false,
    conversationId: 'conv-004',
  },

  /**
   * Email from outside beta domain - should be rejected in beta mode.
   */
  outsideBetaDomain: {
    messageId: 'AAMkAGIxMjY2ZjEz-005',
    internetMessageId: '<msg-005@external.com>',
    subject: 'Interested in Position',
    from: 'applicant@gmail.com',
    fromDomain: 'gmail.com',
    receivedAt: new Date('2026-03-11T11:30:00Z'),
    body: 'I saw your job posting and would like to apply...',
    bodyPreview: 'I saw your job posting...',
    hasAttachments: true,
    conversationId: 'conv-005',
  },
};
