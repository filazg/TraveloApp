const { systemSettingsDataModel } = require("../db/models/Settings.cjs")


const getSystemSetingsDataService = async ()=>{
  // Na svježoj instalaciji zapisa još nema, pa bi se postavke otvorile prazne.
  // Zato se prvi put stvori redak s predefiniranim vrijednostima iz modela —
  // blagajnik onda mijenja samo ono što se stvarno razlikuje.
  let settings = await systemSettingsDataModel.findOne({attributes: { exclude: ["createdAt", "updatedAt"] }});
  if (!settings) {
    await systemSettingsDataModel.create({});
    settings = await systemSettingsDataModel.findOne({attributes: { exclude: ["createdAt", "updatedAt"] }});
  }
  return {
    system_settings: settings ? settings.toJSON() : {},
    meta: { fetchedAt: new Date().toISOString() },
  };
}

const setSystemSetingsDataService = async (data) =>{
    try {
        console.log('SYSTEM DATA SET', data)
        systemSettingsDataModel.truncate()
        systemSettingsDataModel.create(data)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getSystemSetingsDataService,
    setSystemSetingsDataService
}