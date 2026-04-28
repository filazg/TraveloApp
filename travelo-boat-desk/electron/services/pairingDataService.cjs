const { pairingDataModel } = require("../db/models/Pairing.cjs");

async function getPairingDataService() {
  const [pairing] = await Promise.all([
    pairingDataModel.findOne({
      attributes: { exclude: ["createdAt", "updatedAt"] },
    }),
  ]);

  return {
    pairing: pairing ? pairing.toJSON() : null,
  };
}

async function getPairingDataService2() {
  const pairing = await pairingDataModel.findOne({
    attributes: { exclude: ["createdAt", "updatedAt"] },
  });
  return (pairing)
}

module.exports = { getPairingDataService };