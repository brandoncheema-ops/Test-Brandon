import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import createReport from 'docx-templates';
import { getEnv } from '../../config/env';
import { getLogger } from '../../config/logger';
import { ContractType, HiringFields } from '../../shared/types';
import { AppError } from '../../shared/errors';

const execAsync = promisify(exec);
const logger = getLogger('contract-generator');

// =============================================================================
// Contract Generator - Generates contracts from DOCX templates
//
// Template Strategy:
// 1. Contract templates are DOCX files with {{placeholder}} syntax
// 2. docx-templates library populates placeholders with extracted fields
// 3. LibreOffice CLI converts DOCX to PDF for delivery
// 4. Original DOCX is kept for revision capability
// =============================================================================

/** Maps contract types to their template file names */
const TEMPLATE_MAP: Record<ContractType, string> = {
  [ContractType.MD_SHAREHOLDER]: 'md_shareholder_contract.docx',
  [ContractType.MD_NON_SHAREHOLDER]: 'md_non_shareholder_contract.docx',
  [ContractType.CRNA]: 'crna_contract.docx',
};

export interface GeneratedContract {
  docxPath: string;
  pdfPath: string;
  contractType: ContractType;
  generatedAt: Date;
}

export class ContractGeneratorService {
  private templatesDir: string;
  private outputDir: string;

  constructor() {
    const env = getEnv();
    this.templatesDir = path.resolve(env.TEMPLATES_DIR);
    this.outputDir = path.resolve(env.OUTPUT_DIR);

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generates a contract document from the appropriate template.
   */
  async generate(
    workflowId: string,
    contractType: ContractType,
    fields: HiringFields
  ): Promise<GeneratedContract> {
    const templateFile = TEMPLATE_MAP[contractType];
    if (!templateFile) {
      throw new AppError(`No template defined for contract type: ${contractType}`, 'NO_TEMPLATE', 400);
    }

    const templatePath = path.join(this.templatesDir, templateFile);
    if (!fs.existsSync(templatePath)) {
      throw new AppError(
        `Template file not found: ${templatePath}. Please create DOCX templates with {{placeholder}} syntax.`,
        'TEMPLATE_NOT_FOUND',
        500
      );
    }

    // Build template data from extracted fields
    const templateData = this.buildTemplateData(fields, contractType);

    // Generate timestamp-based filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = (fields.fullLegalName.value || 'unknown')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    const baseFileName = `contract_${safeName}_${timestamp}`;
    const docxOutputPath = path.join(this.outputDir, `${baseFileName}.docx`);
    const pdfOutputPath = path.join(this.outputDir, `${baseFileName}.pdf`);

    try {
      // Read template
      const template = fs.readFileSync(templatePath);

      // Generate DOCX with populated fields
      const buffer = await createReport({
        template,
        data: templateData,
        cmdDelimiter: ['{{', '}}'],
      });

      // Write DOCX
      fs.writeFileSync(docxOutputPath, buffer);
      logger.info({ docxOutputPath, workflowId }, 'DOCX contract generated');

      // Convert to PDF using LibreOffice
      await this.convertToPdf(docxOutputPath, this.outputDir);
      logger.info({ pdfOutputPath, workflowId }, 'PDF contract generated');

      return {
        docxPath: docxOutputPath,
        pdfPath: pdfOutputPath,
        contractType,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error({ err: error, workflowId }, 'Contract generation failed');
      throw new AppError(
        `Contract generation failed: ${(error as Error).message}`,
        'GENERATION_FAILED',
        500
      );
    }
  }

  /**
   * Converts a DOCX file to PDF using LibreOffice CLI.
   */
  private async convertToPdf(docxPath: string, outputDir: string): Promise<void> {
    const env = getEnv();
    const cmd = `${env.LIBREOFFICE_PATH} --headless --convert-to pdf --outdir "${outputDir}" "${docxPath}"`;

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 30_000 });
      if (stderr && !stderr.includes('warn')) {
        logger.warn({ stderr }, 'LibreOffice conversion warning');
      }
      logger.debug({ stdout: stdout.trim() }, 'LibreOffice conversion complete');
    } catch (error) {
      throw new AppError(
        `PDF conversion failed. Ensure LibreOffice is installed. Error: ${(error as Error).message}`,
        'PDF_CONVERSION_FAILED',
        500
      );
    }
  }

  /**
   * Builds a flat data object for template population from extracted fields.
   */
  private buildTemplateData(
    fields: HiringFields,
    contractType: ContractType
  ): Record<string, string> {
    const today = new Date();

    return {
      fullLegalName: fields.fullLegalName.value || '[FULL LEGAL NAME]',
      role: fields.role.value || '[ROLE]',
      contractType: contractType,
      startDate: fields.startDate.value || '[START DATE]',
      salary: fields.salary.value || '[SALARY]',
      baseSalaryYear1: fields.baseSalaryYear1.value || fields.salary.value || '[BASE SALARY YEAR 1]',
      baseSalaryYear2: fields.baseSalaryYear2.value || '[BASE SALARY YEAR 2]',
      vacation: fields.vacation.value || '[VACATION]',
      shareholderStatus: fields.shareholderStatus.value || 'N/A',
      compensationNotes: fields.compensationNotes.value || '',
      roleSpecificTerms: fields.roleSpecificTerms.value || '',
      generationDate: today.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };
  }

  /**
   * Returns available template types.
   */
  getAvailableTemplates(): { contractType: ContractType; fileName: string; exists: boolean }[] {
    return Object.entries(TEMPLATE_MAP).map(([type, fileName]) => ({
      contractType: type as ContractType,
      fileName,
      exists: fs.existsSync(path.join(this.templatesDir, fileName)),
    }));
  }
}
