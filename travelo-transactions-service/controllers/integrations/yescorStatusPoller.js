// Polling YesCor document statusa — za sve invoice rows koji su submitted ali
// fiskalizacija nije završena. Pokreće se periodički (cron 30s).
const { Op } = require('sequelize');
const { getDocumentStatus } = require('./yescorClient');

const STATUS_MAP = {
    1: 'new',
    2: 'sending',
    3: 'sent',
    4: 'error',
    5: 'received',
    6: 'not_for_sending',
};
const FISC_STATUS_MAP = {
    1: 'not_required',
    2: 'pending',
    3: 'successful',
    4: 'error',
};
const TERMINAL_STATUS = new Set(['sent', 'error', 'not_for_sending']);
const TERMINAL_FISC_STATUS = new Set(['not_required', 'successful', 'error']);

const isTerminal = (s, fs) =>
    TERMINAL_STATUS.has(s) && TERMINAL_FISC_STATUS.has(fs);

const pollPendingInvoices = async (models) => {
    const { InvoiceModel } = models;
    // Dohvati kandidatate: imaju document_id, nisu terminalno završeni, i zadnji
    // sync je stariji od 20s (ne bombardiraj API za tek poslano).
    const pending = await InvoiceModel.findAll({
        where: {
            yescor_document_id: { [Op.ne]: null },
            [Op.or]: [
                { yescor_fiscalization_status: null },
                { yescor_fiscalization_status: { [Op.notIn]: ['not_required', 'successful', 'error'] } },
            ],
        },
        limit: 50,
        order: [['yescor_last_sync_at', 'ASC']],
    });
    if (!pending.length) return { checked: 0, updated: 0 };

    let updated = 0;
    for (const inv of pending) {
        try {
            const r = await getDocumentStatus(inv.yescor_document_id);
            if (r.status !== 200) {
                await inv.update({ yescor_last_sync_at: new Date() });
                continue;
            }
            const dto = r.data?.data || {};
            const status = STATUS_MAP[dto.status] || String(dto.status || '');
            const fiscStatus = FISC_STATUS_MAP[dto.fiscalizationStatus] || String(dto.fiscalizationStatus || '');
            const errorMsg = dto.errorMessage || dto.fiscalizationErrorMessage || null;
            await inv.update({
                yescor_status: status,
                yescor_fiscalization_status: fiscStatus,
                yescor_error_message: errorMsg,
                yescor_last_sync_at: new Date(),
            });
            updated += 1;
            if (isTerminal(status, fiscStatus)) {
                console.log(`[yescor-poller] invoice ${inv.invoice_no} DONE status=${status} fisc=${fiscStatus}`);
            }
        } catch (e) {
            console.log(`[yescor-poller] invoice ${inv.invoice_no} poll error:`, e?.message || e);
            try { await inv.update({ yescor_last_sync_at: new Date() }); } catch (_) {}
        }
    }
    return { checked: pending.length, updated };
};

module.exports = { pollPendingInvoices };
