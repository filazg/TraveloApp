const { systemSettingsDataModel } = require("../db/models/Settings.cjs")
const { sequelize } = require("../db/index.cjs")


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
        // Prije se ni truncate ni create nisu čekali: poziv se vraćao dok je
        // zapis još bio u tijeku, pa je pozivatelj odmah nakon spremanja znao
        // pročitati stare postavke. Uz to, da je create pukao nakon truncate-a,
        // instalacija bi ostala BEZ ijedne postavke — zato transakcija.
        await sequelize.transaction(async (t) => {
            await systemSettingsDataModel.destroy({ where: {}, transaction: t })
            await systemSettingsDataModel.create(data, { transaction: t })
        })
        return { ok: true }
    } catch (error) {
        console.log('setSystemSetingsDataService error:', error?.message || error)
        return { ok: false, reason: error?.message || 'error' }
    }
}

module.exports = {
    getSystemSetingsDataService,
    setSystemSetingsDataService
}