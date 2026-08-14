const { DEVICE_MODELS } = require("../../helpers/deviceModels");

// Popis modela uređaja — fiksan, iz koda. Portal ga koristi za dropdown "Model".
const getDeviceModelsDataController = async (req, res) => {
    res.send({
        status: 200,
        data: {
            device_models: DEVICE_MODELS
        }
    });
};

// Serijski brojevi iz zalihe. ?model=SUNMI_V2 filtrira po modelu,
// ?only_free=1 vraća samo nedodijeljene (billing_device_uuid IS NULL).
// ?include=<sn> uvijek uključi taj SN, da kod uređivanja uređaja
// već dodijeljeni broj ne nestane iz dropdowna.
const getDeviceSerialNumbersDataController = async (req, res) => {
    const { DeviceSerialNumbersModel } = req.app.locals.models;
    try {
        const where = { is_active: true };
        if (req.query.model) where.model = req.query.model;

        const all = await DeviceSerialNumbersModel.findAll({
            where,
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            order: [["serial_number", "ASC"]],
        });

        const onlyFree = req.query.only_free === '1' || req.query.only_free === 'true';
        const include = req.query.include || null;
        const rows = onlyFree
            ? all.filter((r) => !r.billing_device_uuid || r.serial_number === include)
            : all;

        res.send({
            status: 200,
            data: {
                device_serial_numbers: rows
            }
        });
    } catch (error) {
        console.log(error);
        res.send({ status: 500, data: { error } });
    }
};

module.exports = {
    getDeviceModelsDataController,
    getDeviceSerialNumbersDataController,
};
