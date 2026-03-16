import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '../../config/env';
import { getLogger } from '../../config/logger';
import {
  HiringFields,
  ExtractedField,
  ConfidenceLevel,
  ContractType,
  ClassificationResult,
} from '../../shared/types';
import { emptyHiringFields } from '../../domain/models/HiringWorkflow';
import { ExternalServiceError } from '../../shared/errors';

const logger = getLogger('llm-service');

// =============================================================================
// LLM Service - Uses Claude for email classification and field extraction
// Interface is designed to be swappable with deterministic parsing later.
// =============================================================================

export interface IExtractionService {
  classifyEmail(subject: string, body: string): Promise<ClassificationResult>;
  extractHiringFields(subject: string, body: string): Promise<HiringFields>;
}

export class LlmExtractionService implements IExtractionService {
  private client: Anthropic;

  constructor() {
    const env = getEnv();
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  /**
   * Classifies whether an email is a new hire request.
   */
  async classifyEmail(subject: string, body: string): Promise<ClassificationResult> {
    const env = getEnv();

    const prompt = `You are an email classifier for a medical practice. Your job is to determine whether an email is a request to create a new hire employment contract.

Indicators of a new hire request:
- Mentions hiring, new employee, new doctor, new CRNA, new physician
- Contains terms like "offer letter", "employment agreement", "contract", "start date"
- Discusses salary, compensation, benefits for a specific person
- A hiring manager forwarding details about a prospective employee

NOT a new hire request:
- General HR inquiries
- Existing employee matters (raises, terminations, complaints)
- Meeting requests, newsletters, spam
- Contract renewals or amendments for existing staff

Analyze this email and respond with ONLY valid JSON:

Subject: ${subject}

Body:
${body.substring(0, 3000)}

Respond with this exact JSON structure:
{
  "isHireRequest": true/false,
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.client.messages.create({
        model: env.LLM_MODEL,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        logger.warn({ text }, 'LLM classification returned non-JSON');
        return { isHireRequest: false, confidence: 0, reasoning: 'Failed to parse LLM response' };
      }

      const result = JSON.parse(jsonMatch[0]) as ClassificationResult;
      logger.info({ result }, 'Email classified');
      return result;
    } catch (error) {
      throw new ExternalServiceError('LLM', `Classification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extracts structured hiring fields from an unstructured email.
   */
  async extractHiringFields(subject: string, body: string): Promise<HiringFields> {
    const env = getEnv();

    const prompt = `You are a data extraction system for a medical practice's HR department. Extract hiring information from the following email.

The practice hires three types of roles:
1. MD - Shareholder Track (physician who will become a shareholder/partner)
2. MD - Non-Shareholder Track (physician, non-partner track)
3. CRNA (Certified Registered Nurse Anesthetist)

Extract the following fields. For each field, provide a confidence level: "HIGH" if clearly stated, "MEDIUM" if implied or partially stated, "LOW" if guessed or unclear.

Fields to extract:
- fullLegalName: The full legal name of the person being hired
- role: The job role/position (e.g., "Physician", "CRNA", "Anesthesiologist")
- contractType: One of "MD_SHAREHOLDER", "MD_NON_SHAREHOLDER", or "CRNA"
- startDate: The intended start date
- salary: The annual salary or compensation amount
- baseSalaryYear1: Base salary for year 1 if specified separately
- baseSalaryYear2: Base salary for year 2 if specified separately
- vacation: Vacation days/weeks/policy
- shareholderStatus: For MDs, whether they are on shareholder/partner track
- compensationNotes: Any bonus terms, incentives, or compensation notes
- roleSpecificTerms: Any other role-specific contract terms mentioned

Subject: ${subject}

Email Body:
${body.substring(0, 4000)}

Respond with ONLY this exact JSON structure (use null for fields not found):
{
  "fullLegalName": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote from email"},
  "role": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"},
  "contractType": {"value": "MD_SHAREHOLDER/MD_NON_SHAREHOLDER/CRNA or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"},
  "startDate": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"},
  "salary": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"},
  "baseSalaryYear1": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"},
  "baseSalaryYear2": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"},
  "vacation": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"},
  "shareholderStatus": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"},
  "compensationNotes": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"},
  "roleSpecificTerms": {"value": "string or null", "confidence": "HIGH/MEDIUM/LOW", "rawExcerpt": "relevant quote"}
}`;

    try {
      const response = await this.client.messages.create({
        model: env.LLM_MODEL,
        max_tokens: env.LLM_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        logger.warn({ text }, 'LLM extraction returned non-JSON');
        return emptyHiringFields();
      }

      const raw = JSON.parse(jsonMatch[0]);
      return this.normalizeExtractedFields(raw);
    } catch (error) {
      throw new ExternalServiceError('LLM', `Extraction failed: ${(error as Error).message}`);
    }
  }

  /**
   * Normalizes the raw LLM output into typed HiringFields.
   */
  private normalizeExtractedFields(raw: Record<string, unknown>): HiringFields {
    const fields = emptyHiringFields();

    const mapField = <T = string>(
      rawField: unknown,
      defaultValue: ExtractedField<T>
    ): ExtractedField<T> => {
      if (!rawField || typeof rawField !== 'object') return defaultValue;

      const f = rawField as Record<string, unknown>;
      return {
        value: (f.value as T) ?? null,
        confidence: this.parseConfidence(f.confidence as string),
        source: 'llm' as const,
        rawExcerpt: (f.rawExcerpt as string) || undefined,
      };
    };

    fields.fullLegalName = mapField(raw.fullLegalName, fields.fullLegalName);
    fields.role = mapField(raw.role, fields.role);
    fields.contractType = mapField<ContractType>(raw.contractType, fields.contractType);
    fields.startDate = mapField(raw.startDate, fields.startDate);
    fields.salary = mapField(raw.salary, fields.salary);
    fields.baseSalaryYear1 = mapField(raw.baseSalaryYear1, fields.baseSalaryYear1);
    fields.baseSalaryYear2 = mapField(raw.baseSalaryYear2, fields.baseSalaryYear2);
    fields.vacation = mapField(raw.vacation, fields.vacation);
    fields.shareholderStatus = mapField(raw.shareholderStatus, fields.shareholderStatus);
    fields.compensationNotes = mapField(raw.compensationNotes, fields.compensationNotes);
    fields.roleSpecificTerms = mapField(raw.roleSpecificTerms, fields.roleSpecificTerms);

    return fields;
  }

  private parseConfidence(value: string | undefined): ConfidenceLevel {
    if (!value) return ConfidenceLevel.LOW;
    const upper = value.toUpperCase();
    if (upper === 'HIGH') return ConfidenceLevel.HIGH;
    if (upper === 'MEDIUM') return ConfidenceLevel.MEDIUM;
    return ConfidenceLevel.LOW;
  }
}
