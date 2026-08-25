const { operatorSettingsModel } = require("../db/models/OperatorSettings.cjs")

const getOperatorSettingsService = async (operaterUsername) => {
    try {
        if (!operaterUsername) return { shortcuts: {} }
        const row = await operatorSettingsModel.findOne({
            where: { operater_username: operaterUsername },
            attributes: { exclude: ["createdAt", "updatedAt"] },
        })
        return { shortcuts: row?.shortcuts || {} }
    } catch (error) {
        console.log('getOperatorSettingsService error:', error?.message || error)
        return { shortcuts: {} }
    }
}

const setOperatorSettingsService = async ({ operater_username, shortcuts }) => {
    try {
        if (!operater_username) return { ok: false, reason: 'nema operatera' }
        // Jedan redak po operateru — upsert umjesto brisanja pa pisanja, da se
        // postavke drugih operatera ne diraju.
        const postojeci = await operatorSettingsModel.findOne({ where: { operater_username } })
        if (postojeci) {
            await postojeci.update({ shortcuts: shortcuts || {} })
        } else {
            await operatorSettingsModel.create({ operater_username, shortcuts: shortcuts || {} })
        }
        return { ok: true }
    } catch (error) {
        console.log('setOperatorSettingsService error:', error?.message || error)
        return { ok: false, reason: error?.message || 'error' }
    }
}

module.exports = {
    getOperatorSettingsService,
    setOperatorSettingsService,
}
