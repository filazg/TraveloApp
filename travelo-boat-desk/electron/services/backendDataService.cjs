const axios = require("axios");
const { pairingDataModel } = require("../db/models/Pairing.cjs");
const { usersModel, companyModel, paymentMethodsModel, stornoPercentagesModel } = require("../db/models/BasicData.cjs");
const { salesRoutesDataModel, salesRoutePricesDataModel, linesDataModel, harborsDataModel } = require("../db/models/TransportData.cjs");
const { systemSettingsDataModel } = require("../db/models/Settings.cjs");
const https = require("https");

async function pairingWithBackendService(data) {
  try {
    const settingsData = await systemSettingsDataModel.findOne();
    const backendUrl = settingsData?.backend_url;
    if (!backendUrl) {
      throw new Error('backend_url nije postavljen u Settings — otvori System Settings i unesi gateway URL.');
    }
    console.log('Pairing URL:', backendUrl + "/terminal_auth/login/terminalLogin");
    const response = await axios.post(backendUrl + "/terminal_auth/login/terminalLogin", data, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
  let dataToSend = {};
  console.log('RESPONSE JE ',response)
  if (response.data.token) {
    const pairingData = {
      isPaired: true,
      tid: data.tid,
      otp: data.otp,
      token: response.data.token,
    };
    dataToSend = pairingData;
    console.log(pairingData);
    await pairingDataModel.truncate();
    await pairingDataModel.create(pairingData);
  } else {
    console.log("else je");
  }
  return dataToSend;
   } catch (error) {
    console.log('ERROR ', error)
    const backendMsg = error?.response?.data?.msg || error?.response?.data?.message;
    const status = error?.response?.status;
    if (backendMsg) {
      throw new Error(backendMsg);
    }
    if (status) {
      throw new Error('Pairing greška (HTTP ' + status + ')');
    }
    throw new Error(error?.message || 'Pairing greška — provjeri backend_url i mrežu.');
  }
}


async function syncBasicDataService() {
  try {
    const pairingDAta = await pairingDataModel.findOne();
    const settingsData = await systemSettingsDataModel.findOne()
    const token = pairingDAta.token;
    console.log('B DATA token', token)
    const basicData = await axios.get(settingsData.backend_url +"/terminals/terminal/basic_data",{
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {
        authorization: "Bearer " + token,
      },
    });
    console.log('BASIC DATAAAAAAAAAAA',basicData.data.users)
    if (basicData) {     
      await usersModel.truncate();
      await usersModel.bulkCreate(basicData.data.users);
      await companyModel.truncate();
      await companyModel.create(basicData.data.basic_data);
      await paymentMethodsModel.truncate();
      await paymentMethodsModel.bulkCreate(basicData.data.payment_method);
      // Šifarnik postotaka storniranja. Ako ga backend ne pošalje (stariji
      // servis), zadrži zadnje sinkronizirane umjesto da ostane prazno — bez
      // njih blagajnik ne bi mogao stornirati.
      if (Array.isArray(basicData.data.storno_percentages)) {
        await stornoPercentagesModel.truncate();
        await stornoPercentagesModel.bulkCreate(basicData.data.storno_percentages);
      }
      const dataToSend = basicData.data;
      return { users: dataToSend.users };
    }
  } catch (error) {
    console.log(error);
    if (error.response?.status) {
      const pairingData = await pairingDataModel.findOne();
      console.log(pairingData);
      const dataToPairing = {
        tid: pairingData.tid,
        otp: pairingData.otp,
        client_acr: "t4b",
      };
      const getPair = await pairingWithBackendService(dataToPairing);
      console.log("pairing status: ");
      console.log(getPair);
    }
  }
}

async function syncTransportDataService() {
  try {
    //console.log("SYNC TRANSPORT DATA SERVICE");
    const settingsData = await systemSettingsDataModel.findOne()
    const pairingDAta = await pairingDataModel.findOne();
    const token = pairingDAta.token;
    console.log('TR DATA token', token)
    const transportData = await axios.get(settingsData.backend_url + "/terminals/terminal/transport_data",{
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {
        authorization: "Bearer " + token,
      },
    });
    console.log("SYNC TRANSPORT DATA SERVICE", transportData.data.lines);
    if (transportData) {
      const salesRoutesData = transportData.data.sales_routes;
      const priceData = transportData.data.trips_prices;
      const harborsData = transportData.data.harbors;
      const linesData = transportData.data.lines;

      // Nepotpun odgovor se ne sprema. Bez ove provjere bi truncate ispraznio
      // vozni red, a bulkCreate(undefined) puknuo — blagajna bi ostala bez
      // ijednog polaska do sljedeceg uspjesnog syncа.
      if (!Array.isArray(salesRoutesData) || !Array.isArray(linesData) ||
          !Array.isArray(priceData) || !Array.isArray(harborsData)) {
        console.log("SYNC TRANSPORT DATA SERVICE: nepotpun odgovor, vozni red ostaje nepromijenjen");
        return;
      }

      await salesRoutesDataModel.truncate();
      await salesRoutesDataModel.bulkCreate(salesRoutesData);
      await salesRoutePricesDataModel.truncate();
      await salesRoutePricesDataModel.bulkCreate(priceData);
      await linesDataModel.truncate();
      await linesDataModel.bulkCreate(linesData);
      await harborsDataModel.truncate();
      await harborsDataModel.bulkCreate(harborsData);

      return transportData.data.data;
    }
  } catch (error) {
    console.log(error);
    if (error) {
      console.log(error)
    }
  }
}

module.exports = { 
    pairingWithBackendService,
    syncBasicDataService,
    syncTransportDataService
};