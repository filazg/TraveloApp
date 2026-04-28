const { systemSettingsDataModel } = require("../db/models/Settings.cjs")


const getSystemSetingsDataService = async ()=>{
    const [settings] = await Promise.all([
    systemSettingsDataModel.findOne({attributes: { exclude: ["createdAt", "updatedAt"] }}),
  ]);
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