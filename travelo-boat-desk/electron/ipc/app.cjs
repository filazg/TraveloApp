const { ipcMain } = require("electron");
const { getInitialDataService } = require("../services/initialDataService.cjs");
const { getPairingDataService } = require("../services/pairingDataService.cjs");
const { pairingWithBackendService, syncBasicDataService, syncTransportDataService } = require("../services/backendDataService.cjs");
const { getLocalBasicDataService, getLocalTransportDataService } = require("../services/localDataService.cjs");
const { getBookingDataService } = require("../services/bookingDataService.cjs");
const { getShiftsDataService, openNewShiftService, closeShiftService, shiftSummaryService, reprintShiftService, syncPendingShiftsService } = require("../services/shiftsDataService.cjs");
const { createInvoiceService, getInvoicesDataService, cancelInvoiceService, getInvoicesDetailsDataService, printInvoiceCopyService, printAllTicketsCopyService, getTicketsDataService, printTicketCopyService, getInvoiceDataService, cancelTicketService, refreshInvoiceF2StatusService, refreshPendingF2InvoicesService, getNextInvoiceNumbersService, syncPendingInvoicesService, lookupExternalTicketService, cancelExternalTicketService } = require("../services/invoiceDataService.cjs");
const { getBuyersDataService } = require("../services/buyersDataService.cjs");
const { otpPaymentHandler } = require("../helpers/paymentHelpers/otpPaymentHelper.cjs");
const { setSystemSetingsDataService, getSystemSetingsDataService } = require("../services/systemSettingsDataService.cjs");
const { runTesseraCli } = require("../helpers/cardReaderHelpers/subsidisedCardReader.cjs");
const { getOperatorSettingsService, setOperatorSettingsService } = require("../services/operatorSettingsDataService.cjs");

function ok(data) {
  return { ok: true, data };
}
function fail(message, details) {
  return { ok: false, error: { message, details } };
}
function registerAppIpc() {
 ipcMain.handle("app:pairingWithBackend", async (_event, pairingValues) => {
  try {
    const data = await pairingWithBackendService(pairingValues);
    return ok(data);
  } catch (e) {
    return fail("Pairing failed", e?.stack || String(e));
  }
});
  ipcMain.handle("app:getPairingDataIpc", async () => {
    try {
      const data = await getPairingDataService();
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getSystemSettingsDataIpc", async () => {
    try {
      const data = await getSystemSetingsDataService();
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:setSystemSettingsDataIpc", async (_event, in_data) => {
    try {
      const data = await setSystemSetingsDataService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:syncBasicDataBackend", async () => {
    try {
      const data = await syncBasicDataService();
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:syncTransportDataBackend", async () => {
    try {
      const data = await syncTransportDataService();
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getShiftsDataIpc", async (_event, operaterUsername) => {
    try {
      const data = await getShiftsDataService(operaterUsername);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:openShiftsDataIpc", async (_event, in_data) => {
    try {
      const data = await openNewShiftService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:closeShiftsDataIpc", async (_event, in_data) => {
    try {
      const data = await closeShiftService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:summaryShiftsDataIpc", async (_event, in_data) => {
    try {
      const data = await shiftSummaryService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:reprintShiftIpc", async (_event, shiftUuid) => {
    try {
      const data = await reprintShiftService(shiftUuid);
      return ok(data);
    } catch (e) {
      return fail("Failed to reprint shift report", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getLocalBasicDataIpc", async () => {
    try {
      const data = await getLocalBasicDataService();
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getLocalTransportDataIpc", async () => {
    try {
      const data = await getLocalTransportDataService();
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getOnlineBookingDataIPC", async (_event, bookingData) => {
    try {
      const data = await getBookingDataService(bookingData);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:cardPaymentIPC", async (_event, in_data) => {
    try {
      const data = await otpPaymentHandler(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getInvoicesIPC", async () => {
    try {
      const data = await getInvoicesDataService();
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getInvoiceIPC", async (_event, in_data) => {
    try {
      const data = await getInvoiceDataService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getInvoiceDetailsIPC", async (_event, in_data) => {
    try {
      const data = await getInvoicesDetailsDataService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:printInvoiceCopyIPC", async (_event, in_data) => {
    try {
      const data = await printInvoiceCopyService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:printAllTicketsCopyIPC", async (_event, in_data) => {
    try {
      const data = await printAllTicketsCopyService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:printTicketCopyIPC", async (_event, in_data) => {
    try {
      const data = await printTicketCopyService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getBuyersIPC", async (_event, params) => {
    try {
      const data = await getBuyersDataService(params || {});
      return ok(data);
    } catch (e) {
      return fail("Failed to load buyers", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:createInvoiceIPC", async (_event, in_data) => {
    try {
      const data = await createInvoiceService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:cancelInvoiceIPC", async (_event, in_data) => {
    try {
      const data = await cancelInvoiceService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:cancelTicketIPC", async (_event, in_data) => {
    try {
      const data = await cancelTicketService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  // Karta prodana na drugom prodajnom mjestu: prvo traženje po oznaci, pa
  // storno. Odvojeni su jer blagajnik prvo mora vidjeti što je našao.
  ipcMain.handle("app:lookupExternalTicketIPC", async (_event, ticketCode) => {
    try {
      const data = await lookupExternalTicketService(ticketCode);
      return ok(data);
    } catch (e) {
      return fail("Traženje karte nije uspjelo", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:cancelExternalTicketIPC", async (_event, in_data) => {
    try {
      const data = await cancelExternalTicketService(in_data);
      return ok(data);
    } catch (e) {
      return fail("Storno nije izvršen", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getTicketsIPC", async () => {
    try {
      const data = await getTicketsDataService();
      return ok(data);
    } catch (e) {
      return fail("Failed to load initial data", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:refreshF2InvoiceStatusIPC", async (_event, invoiceUuid) => {
    try {
      const data = await refreshInvoiceF2StatusService(invoiceUuid);
      return ok(data);
    } catch (e) {
      return fail("Failed to refresh F2 status", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getOperatorSettingsIPC", async (_event, operaterUsername) => {
    try {
      const data = await getOperatorSettingsService(operaterUsername);
      return ok(data);
    } catch (e) {
      return fail("Failed to load operator settings", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:setOperatorSettingsIPC", async (_event, in_data) => {
    try {
      const data = await setOperatorSettingsService(in_data || {});
      return ok(data);
    } catch (e) {
      return fail("Failed to save operator settings", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:getNextInvoiceNumbersIPC", async () => {
    try {
      const data = await getNextInvoiceNumbersService();
      return ok(data);
    } catch (e) {
      return fail("Failed to read next invoice numbers", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:refreshPendingF2StatusesIPC", async () => {
    try {
      const data = await refreshPendingF2InvoicesService();
      return ok(data);
    } catch (e) {
      return fail("Failed to refresh pending F2 statuses", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:syncPendingShiftsIPC", async () => {
    try {
      const data = await syncPendingShiftsService();
      return ok(data);
    } catch (e) {
      return fail("Failed to sync pending shifts", e?.stack || String(e));
    }
  });
  ipcMain.handle("app:syncPendingInvoicesIPC", async () => {
    try {
      const data = await syncPendingInvoicesService();
      return ok(data);
    } catch (e) {
      return fail("Failed to sync pending invoices", e?.stack || String(e));
    }
  });
  // Popis PC/SC citaca spojenih na racunalo. Naziv citaca se dosad upisivao
  // rukom, tocno onako kako ga vidi sustav — jedno slovo krivo i citanje kartice
  // tiho ne radi.
  ipcMain.handle("app:listCardReadersIPC", async () => {
    try {
      const data = await runTesseraCli(["list-readers"], 8000);
      return { ok: true, readers: Array.isArray(data?.readers) ? data.readers : [] };
    } catch (e) {
      return { ok: false, readers: [], error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle("app:readTesseraIPC", async (_event, in_data) => {
  try {
    const args = ["read", "--reader", in_data];
    const data = await runTesseraCli(args);
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      stage: "TesseraCLI",
      error: e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : JSON.stringify(e)
    };
  }
});
}

module.exports = { registerAppIpc };