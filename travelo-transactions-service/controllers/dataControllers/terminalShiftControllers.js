const { getSequelize } = require("../../config/database");
const sequelize = getSequelize();
const { Op } = require("sequelize");

// Boat-desk je autoritet za smjene jer mora raditi offline. Backend pasivno
// upsertira shift state po shift_uuid (idempotentno) — payload sadrži cijelu
// snapshot smjene (start/end/open/agregati) plus opcionalno shift_finance po
// vrsti plaćanja kad se smjena zatvara.
const upsertTerminalShiftController = async (req, res) => {
    try {
        const { ShiftModel, ShiftFinanceModel } = req.app.locals.models;
        const data = req.body?.body || req.body || {};
        const shift = data.shift;
        if (!shift?.shift_uuid) {
            return res.send({ status: 400, data: { message: "shift.shift_uuid required" } });
        }

        await sequelize.transaction(async (t) => {
            const shiftFields = {
                shift_uuid: shift.shift_uuid,
                client_uuid: shift.client_uuid,
                client_name: shift.client_name,
                client_oib: shift.client_oib,
                business_premise_uuid: shift.business_premise_uuid,
                business_premise_name: shift.business_premise_name,
                business_premise_fiscal_mark: shift.business_premise_fiscal_mark,
                billing_device_uuid: shift.billing_device_uuid,
                billing_device_fiscal_mark: shift.billing_device_fiscal_mark,
                operater_name: shift.operater_name,
                operater_surname: shift.operater_surname,
                operater_username: shift.operater_username,
                shift_start: shift.shift_start,
                shift_end: shift.shift_end || null,
                shift_open: shift.shift_open === undefined ? true : !!shift.shift_open,
                remark: shift.remark || null,
                shift_first_invoice: shift.shift_first_invoice || null,
                shift_last_invoice: shift.shift_last_invoice || null,
                shift_amount: shift.shift_amount ?? null,
                shift_vat_base: shift.shift_vat_base ?? null,
                shift_vat: shift.shift_vat ?? null,
                shift_harbor_tax: shift.shift_harbor_tax ?? null,
            };

            const existing = await ShiftModel.findOne({ where: { shift_uuid: shift.shift_uuid }, transaction: t });
            if (existing) {
                await ShiftModel.update(shiftFields, { where: { shift_uuid: shift.shift_uuid }, transaction: t });
            } else {
                await ShiftModel.create(shiftFields, { transaction: t });
            }

            // Pri zatvaranju boat-desk šalje agregat po vrsti plaćanja. Brišemo
            // postojeće zapise (idempotentnost) i upisujemo nove.
            if (Array.isArray(data.shift_finance)) {
                await ShiftFinanceModel.destroy({ where: { shift_uuid: shift.shift_uuid }, transaction: t });
                if (data.shift_finance.length) {
                    await ShiftFinanceModel.bulkCreate(
                        data.shift_finance.map((f) => ({
                            shift_financ_uuid: f.shift_financ_uuid,
                            shift_uuid: shift.shift_uuid,
                            payment_type_uuid: f.payment_type_uuid,
                            payment_type_name: f.payment_type_name,
                            payment_amount: f.payment_amount,
                        })),
                        { transaction: t }
                    );
                }
            }
        });

        const saved = await ShiftModel.findOne({ where: { shift_uuid: shift.shift_uuid } });
        res.send({ status: 200, data: saved ? saved.toJSON() : null });
    } catch (error) {
        console.log("upsertTerminalShiftController error:", error?.message || error);
        res.send({ status: 500, data: { error: error?.message || String(error) } });
    }
};

const listShiftsController = async (req, res) => {
    try {
        const { ShiftModel, ShiftFinanceModel } = req.app.locals.models;
        const { from, to, operater_username, billing_device_uuid, shift_open } = req.query || {};
        const where = {};
        if (operater_username) where.operater_username = operater_username;
        if (billing_device_uuid) where.billing_device_uuid = billing_device_uuid;
        if (shift_open === "true") where.shift_open = true;
        if (shift_open === "false") where.shift_open = false;
        if (from || to) {
            where.shift_start = {};
            if (from) where.shift_start[Op.gte] = new Date(from);
            if (to) {
                // `to` je samo datum (YYYY-MM-DD) → interpretiraj kao kraj dana
                // (23:59:59.999) inače smjene koje su bile poslijepodne tog dana
                // ispadnu iz rangea (jer new Date(YYYY-MM-DD) → 00:00 UTC).
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                where.shift_start[Op.lte] = toDate;
            }
        }
        const shifts = await ShiftModel.findAll({
            where,
            order: [["shift_start", "DESC"]],
        });
        const uuids = shifts.map((s) => s.shift_uuid);
        const finance = uuids.length
            ? await ShiftFinanceModel.findAll({ where: { shift_uuid: { [Op.in]: uuids } } })
            : [];
        const financeByShift = new Map();
        for (const f of finance) {
            const arr = financeByShift.get(f.shift_uuid) || [];
            arr.push(f.toJSON());
            financeByShift.set(f.shift_uuid, arr);
        }
        const data = shifts.map((s) => ({ ...s.toJSON(), shift_finance: financeByShift.get(s.shift_uuid) || [] }));
        res.send({ status: 200, data });
    } catch (error) {
        console.log("listShiftsController error:", error?.message || error);
        res.send({ status: 500, data: { error: error?.message || String(error) } });
    }
};

module.exports = { upsertTerminalShiftController, listShiftsController };
