const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  app: {
    pairingWithBackend: (data) => ipcRenderer.invoke("app:pairingWithBackend", data),
    getPairingData: () => ipcRenderer.invoke("app:getPairingDataIpc"),
    getSystemSetingsDataService: () => ipcRenderer.invoke("app:getSystemSetingsDataService"),
    setSystemSettingsDataIpc: (data) => ipcRenderer.invoke("app:setSystemSettingsDataIpc", data),
    syncBasicBackend: (data) => ipcRenderer.invoke("app:syncBasicDataBackend"),
    syncTransportBackend: (data) => ipcRenderer.invoke("app:syncTransportDataBackend"),
    getShiftsDataIpc: (operaterUsername) => ipcRenderer.invoke("app:getShiftsDataIpc", operaterUsername),
    openShiftsDataIpc: (data) => ipcRenderer.invoke("app:openShiftsDataIpc", data),
    summaryShiftsDataIpc: (data) => ipcRenderer.invoke("app:summaryShiftsDataIpc", data),
    reprintShiftIpc: (shiftUuid) => ipcRenderer.invoke("app:reprintShiftIpc", shiftUuid),
    closeShiftsDataIpc: (data) => ipcRenderer.invoke("app:closeShiftsDataIpc", data),
    getLocalBasicDataIpc: () => ipcRenderer.invoke("app:getLocalBasicDataIpc"),
    getLocalTransportDataIpc: () => ipcRenderer.invoke("app:getLocalTransportDataIpc"),
    getOnlineBookingDataIPC: (data) => ipcRenderer.invoke("app:getOnlineBookingDataIPC",data),
    getBuyersIPC: (params) => ipcRenderer.invoke("app:getBuyersIPC", params),
    cardPaymentIPC: (data) => ipcRenderer.invoke("app:cardPaymentIPC",data),
    getInvoiceIPC: (data) => ipcRenderer.invoke("app:getInvoiceIPC", data),
    getInvoicesIPC: () => ipcRenderer.invoke("app:getInvoicesIPC"),
    getInvoiceDetailsIPC: (data) => ipcRenderer.invoke("app:getInvoiceDetailsIPC",data),
    createInvoiceIPC: (data) => ipcRenderer.invoke("app:createInvoiceIPC",data),
    cancelInvoiceIPC: (data) => ipcRenderer.invoke("app:cancelInvoiceIPC",data),
    cancelTicketIPC: (data) => ipcRenderer.invoke("app:cancelTicketIPC",data),
    lookupExternalTicketIPC: (ticketCode) => ipcRenderer.invoke("app:lookupExternalTicketIPC", ticketCode),
    cancelExternalTicketIPC: (data) => ipcRenderer.invoke("app:cancelExternalTicketIPC", data),
    printInvoiceCopyIPC: (data) => ipcRenderer.invoke("app:printInvoiceCopyIPC",data),
    printAllTicketsCopyIPC: (data) => ipcRenderer.invoke("app:printAllTicketsCopyIPC",data),
    printTicketCopyIPC: (data) => ipcRenderer.invoke("app:printTicketCopyIPC",data),
    readTesseraIPC: (data) => ipcRenderer.invoke("app:readTesseraIPC", data),
    listCardReadersIPC: () => ipcRenderer.invoke("app:listCardReadersIPC"),
    getTicketsIPC: () => ipcRenderer.invoke("app:getTicketsIPC"),
    refreshF2InvoiceStatusIPC: (data) => ipcRenderer.invoke("app:refreshF2InvoiceStatusIPC", data),
    refreshPendingF2StatusesIPC: () => ipcRenderer.invoke("app:refreshPendingF2StatusesIPC"),
    getNextInvoiceNumbersIPC: () => ipcRenderer.invoke("app:getNextInvoiceNumbersIPC"),
    getOperatorSettingsIPC: (username) => ipcRenderer.invoke("app:getOperatorSettingsIPC", username),
    setOperatorSettingsIPC: (data) => ipcRenderer.invoke("app:setOperatorSettingsIPC", data),
    syncPendingInvoicesIPC: () => ipcRenderer.invoke("app:syncPendingInvoicesIPC"),
    syncPendingShiftsIPC: () => ipcRenderer.invoke("app:syncPendingShiftsIPC"),
    // Smjenu u 01:00 zatvara glavni proces, pa renderer o tome mora biti
    // obaviješten — inače bi ekran ostao na prijavljenom operateru čija smjena
    // više ne postoji.
    // Posluzitelj javlja kad se podaci promijene (otkaz ili pomak polaska), pa
    // ih glavni proces tiho povuce — renderer to mora saznati da prikaze nove.
    onDataRefreshed: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("app:dataRefreshed", handler);
      return () => ipcRenderer.removeListener("app:dataRefreshed", handler);
    },
    onShiftAutoClosed: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("app:shiftAutoClosed", handler);
      return () => ipcRenderer.removeListener("app:shiftAutoClosed", handler);
    },
  },
});
