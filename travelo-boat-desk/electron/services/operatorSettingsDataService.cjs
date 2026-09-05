const { operatorSettingsModel } = require("../db/models/OperatorSettings.cjs")

const getOperatorSettingsService = async (operaterUsername) => {
    try {
        if (!operaterUsername) return { shortcuts: {}, home_harbor_code: null }
        const row = await operatorSettingsModel.findOne({
            where: { operater_username: operaterUsername },
            attributes: { exclude: ["createdAt", "updatedAt"] },
        })
        return { shortcuts: row?.shortcuts || {}, home_harbor_code: row?.home_harbor_code || null }
    } catch (error) {
        console.log('getOperatorSettingsService error:', error?.message || error)
        return { shortcuts: {}, home_harbor_code: null }
    }
}

const setOperatorSettingsService = async ({ operater_username, shortcuts, home_harbor_code }) => {
    try {
        if (!operater_username) return { ok: false, reason: 'nema operatera' }
        // Jedan redak po operateru — upsert umjesto brisanja pa pisanja, da se
        // postavke drugih operatera ne diraju.
        // Polja koja pozivatelj nije poslao se ne diraju — modal može spremiti
        // samo prečace ili samo polaznu luku, a da drugo ostane kakvo je bilo.
        const izmjene = {}
        if (shortcuts !== undefined) izmjene.shortcuts = shortcuts || {}
        if (home_harbor_code !== undefined) izmjene.home_harbor_code = home_harbor_code || null

        const postojeci = await operatorSettingsModel.findOne({ where: { operater_username } })
        if (postojeci) {
            await postojeci.update(izmjene)
        } else {
            await operatorSettingsModel.create({ operater_username, shortcuts: {}, home_harbor_code: null, ...izmjene })
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
