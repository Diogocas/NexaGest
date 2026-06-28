const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nexagest', {
  saveBackup: (data) => ipcRenderer.invoke('save-backup', data),
  loadBackup: () => ipcRenderer.invoke('load-backup'),
  exportHtml: (payload) => ipcRenderer.invoke('export-html', payload),
  print: () => window.print(),
  autoBackup: (data) => ipcRenderer.invoke('auto-backup', data),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  loadDatabase: () => ipcRenderer.invoke('db-load'),
  saveDatabase: (data) => ipcRenderer.invoke('db-save', data),
  databaseInfo: () => ipcRenderer.invoke('db-info'),
  listCompanies: () => ipcRenderer.invoke('companies-list'),
  switchCompany: (companyId) => ipcRenderer.invoke('company-switch', companyId),
  createCompany: (payload, baseData) => ipcRenderer.invoke('company-create', payload, baseData),
  updateCompany: (payload) => ipcRenderer.invoke('company-update', payload),
  deleteCompany: (companyId) => ipcRenderer.invoke('company-delete', companyId),
  startNetworkServer: (payload) => ipcRenderer.invoke('network-start-server', payload),
  stopNetworkServer: () => ipcRenderer.invoke('network-stop-server'),
  networkRequest: (base, action, payload) => ipcRenderer.invoke('network-request', base, action, payload),
  networkStatus: () => ipcRenderer.invoke('network-status'),
  networkSelfTest: (payload) => ipcRenderer.invoke('network-self-test', payload),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  pickCloudFolder: () => ipcRenderer.invoke('cloud-pick-folder'),
  cloudBackup: (payload) => ipcRenderer.invoke('cloud-backup', payload),
  cloudListBackups: (payload) => ipcRenderer.invoke('cloud-list-backups', payload),
  cloudRestoreBackup: (payload) => ipcRenderer.invoke('cloud-restore-backup', payload),
  generateQrCode: (text) => ipcRenderer.invoke('generate-qr-code', text),
  commercialCheckUpdate: (payload) => ipcRenderer.invoke('commercial-check-update', payload),
  commercialDownloadUpdate: (manifest) => ipcRenderer.invoke('commercial-download-update', manifest),
  commercialInstallUpdate: () => ipcRenderer.invoke('commercial-install-update'),
  commercialUpdateStatus: () => ipcRenderer.invoke('commercial-update-status'),
  licenseDeviceInfo: () => ipcRenderer.invoke('license-device-info'),
  licenseOnlineActivate: (payload) => ipcRenderer.invoke('license-online-activate', payload),
  licenseOnlineValidate: (payload) => ipcRenderer.invoke('license-online-validate', payload),
  onUpdaterEvent: (callback) => {
    const listener = (_event, payload) => { if (typeof callback === 'function') callback(payload); };
    ipcRenderer.on('nexagest-updater-event', listener);
    return () => ipcRenderer.removeListener('nexagest-updater-event', listener);
  },
  commercialOpenDocs: () => ipcRenderer.invoke('commercial-open-docs'),
  commercialOpenDownloads: () => ipcRenderer.invoke('commercial-open-downloads')
});
