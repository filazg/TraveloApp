// Fiksni popis modela mobilnih blagajni. Model se bira samo kad je tip uređaja
// "mobile". has_serial_numbers = true znači da se uz model bira i serijski broj
// iz zalihe (tablica device_serial_numbers).
const DEVICE_MODELS = [
    { code: "SUNMI_V2", name: "Sunmi V2s", has_serial_numbers: true },
    { code: "SUNMI_P2", name: "Sunmi P2", has_serial_numbers: false },
    { code: "GENERIC_ANDROID", name: "Android uređaj", has_serial_numbers: false },
];

const modelByCode = (code) => DEVICE_MODELS.find((m) => m.code === code) || null;
const modelRequiresSerial = (code) => !!modelByCode(code)?.has_serial_numbers;

module.exports = { DEVICE_MODELS, modelByCode, modelRequiresSerial };
