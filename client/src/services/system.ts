/**
 * System Service
 * Handles API calls for system-level operations like backup and restore.
 */
import { fetchApi } from '../utils/fetch-api';

export const systemService = {
  async createBackup(): Promise<Blob> {
    const response = await fetchApi('/api/system/backup', {
      method: 'POST',
    }, true); // Pass true to get the raw response
    return response.blob();
  },

  async restoreFromBackup(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('backupFile', file);

    const response = await fetchApi('/api/system/restore', {
      method: 'POST',
      body: formData,
      // Content-Type is set automatically by the browser for FormData
    });
    return response;
  },

  async getBackupHistory(): Promise<any[]> {
    const response = await fetchApi('/api/system/backup/history');
    return response.data;
  },
};
