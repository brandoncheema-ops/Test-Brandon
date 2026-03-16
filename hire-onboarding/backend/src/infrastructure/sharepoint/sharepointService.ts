import { getGraphClient } from '../email/graphClient';
import { getEnv } from '../../config/env';
import { getLogger } from '../../config/logger';
import { ExternalServiceError } from '../../shared/errors';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('sharepoint-service');

// =============================================================================
// SharePoint Service - Upload files and manage folders via Graph API
// =============================================================================

export class SharePointService {
  /**
   * Ensures an employee folder exists in SharePoint.
   * Creates it if it doesn't exist.
   * Returns the folder's driveItem ID.
   */
  async ensureEmployeeFolder(employeeName: string): Promise<{ folderId: string; folderPath: string }> {
    const env = getEnv();
    const client = getGraphClient();
    const basePath = env.SHAREPOINT_CONTRACTS_FOLDER;

    // Sanitize employee name for folder name
    const safeName = employeeName
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const folderPath = `${basePath}/${safeName}`;

    try {
      // Try to get the folder first
      const existing = await client
        .api(`/sites/${env.SHAREPOINT_SITE_ID}/drives/${env.SHAREPOINT_DRIVE_ID}/root:/${folderPath}`)
        .get();

      logger.info({ folderPath }, 'Employee folder already exists');
      return { folderId: existing.id, folderPath };
    } catch {
      // Folder doesn't exist, create it
      logger.info({ folderPath }, 'Creating employee folder');
    }

    try {
      const parentPath = basePath;
      const result = await client
        .api(
          `/sites/${env.SHAREPOINT_SITE_ID}/drives/${env.SHAREPOINT_DRIVE_ID}/root:/${parentPath}:/children`
        )
        .post({
          name: safeName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        });

      logger.info({ folderId: result.id, folderPath }, 'Employee folder created');
      return { folderId: result.id, folderPath };
    } catch (error) {
      throw new ExternalServiceError(
        'SharePoint',
        `Failed to create employee folder: ${(error as Error).message}`
      );
    }
  }

  /**
   * Uploads a file to a specific folder in SharePoint.
   * For files under 4MB, uses simple upload. For larger files, would use
   * upload session (not implemented in Phase 1 since contracts are small).
   */
  async uploadFile(
    folderPath: string,
    fileName: string,
    filePath: string
  ): Promise<{ fileUrl: string; driveItemId: string }> {
    const env = getEnv();
    const client = getGraphClient();

    const fileBuffer = fs.readFileSync(filePath);
    const uploadPath = `${folderPath}/${fileName}`;

    try {
      const result = await client
        .api(
          `/sites/${env.SHAREPOINT_SITE_ID}/drives/${env.SHAREPOINT_DRIVE_ID}/root:/${uploadPath}:/content`
        )
        .putStream(fileBuffer);

      const fileUrl = result.webUrl || '';
      logger.info({ uploadPath, fileUrl }, 'File uploaded to SharePoint');

      return { fileUrl, driveItemId: result.id };
    } catch (error) {
      throw new ExternalServiceError(
        'SharePoint',
        `Failed to upload file: ${(error as Error).message}`
      );
    }
  }

  /**
   * Uploads a generated contract to the employee's SharePoint folder.
   */
  async fileContract(
    employeeName: string,
    contractFilePath: string,
    contractFileName?: string
  ): Promise<{ fileUrl: string; folderPath: string }> {
    const { folderPath } = await this.ensureEmployeeFolder(employeeName);

    const fileName =
      contractFileName || `Contract_${employeeName.replace(/\s+/g, '_')}_${Date.now()}${path.extname(contractFilePath)}`;

    const { fileUrl } = await this.uploadFile(folderPath, fileName, contractFilePath);

    return { fileUrl, folderPath };
  }
}
