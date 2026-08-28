const { getCompanyController, getBusinessPremisesController, getBillingDevicesController, getUsersController, getPaymentMethodsController, getStornoPercentagesController } = require("../controllers/coreServiceControllers/backofficeServiceControllers")
const { getIntegrationsConfigData } = require("../controllers/configServices/configSyncController")

const getTerminalBasicDataHandler = async(data)=>{
    try {
        const companyData = await getCompanyController()
        const businessPremisesData = await getBusinessPremisesController()
        const billingDevicesData = await getBillingDevicesController()
        const usersData = await getUsersController()
        const paymentsData = await getPaymentMethodsController()
        const stornoPercentagesData = await getStornoPercentagesController()
        const terminaData = billingDevicesData.data.billing_devices.find((terminal)=> terminal.uuid === data.header.data.t && terminal.is_active)
        if(terminaData){
            let usersForTerminal = []
            let paymentsForTerminal = []
            for(const user of terminaData.permissions){
                const userData = usersData.data.users.find((us)=>us.uuid === user.uuid)
                const newUser = {
                    id:userData.id,
                    user_uuid:userData.uuid,
                    user_name:userData.name,
                    user_surname:userData.surname,
                    user_username:userData.username,
                    user_password:userData.password,
                    user_code:userData.code,
                    user_mark:userData.mark,
                    user_legal_id:userData.legal_id, // OIB operatera za F2
                }

                usersForTerminal = [...usersForTerminal, newUser]
            }
            for(const payment of terminaData.payment){
                const paymentData = paymentsData.data.payment_methods.find((pay)=>pay.uuid === payment.uuid)
                paymentsForTerminal = [...paymentsForTerminal,paymentData]
            }
            const businessPremiseDataForTerminal =  businessPremisesData.data.business_premises.find((bp)=>bp.uuid === terminaData.business_premise_uuid)
            const basicData = {
                basic_data_uuid:data.header.data.t,
                client_name:companyData.data.company.name || '',
                client_address:companyData.data.company.address || '',
                client_postal_code:companyData.data.company.postal_code || '',
                client_town:companyData.data.company.town || '',
                client_country:'Hrvatska',
                client_legal_id:companyData.data.company.legal_id || '',
                client_vat_id:companyData.data.company.vat_id || '',
                client_email:'',
                business_premise_uuid:businessPremiseDataForTerminal.uuid || '',
                business_premise_name:businessPremiseDataForTerminal.name || '',
                business_premise_fiscal_mark:businessPremiseDataForTerminal.fiskal_mark || '',
                business_premise_address:businessPremiseDataForTerminal.address || '',
                business_premise_town:businessPremiseDataForTerminal.town || '',
                business_premise_country:businessPremiseDataForTerminal.country || '',
                business_premise_description:businessPremiseDataForTerminal.description || '',
                business_premise_working_time:businessPremiseDataForTerminal.working_time || '',
                billing_device_uuid:terminaData.uuid || '',
                billing_device_fiscal_mark:terminaData.fiscal_mark || '',
                billing_device_name:terminaData.name || '',
                billing_device_description:terminaData.description || '',
                billing_device_header:terminaData.header || '',
                // Napomene s naplatnog uređaja — ispisuju se na dnu računa
                // odnosno karte na blagajni i mobilnoj.
                billing_device_footer:terminaData.footer || '',
                billing_device_ticket_footer:terminaData.ticket_footer || '',
                billing_device_auto_validate:terminaData.auto_validate || '',
                // Smije li se na uredaju prodavati za buduce datume. Bez toga
                // mobilna ne bi znala smije li ponuditi odabir dana polaska.
                billing_device_future_sale:!!terminaData.future_sale
            }
            // 7pay (kartično placanje na mobilnom terminalu) — kredencijali dolaze
            // iz control-servisa, terminal ih ne drzi trajno. Salju se samo ako su
            // popunjeni, da uredaj ne dobije poluprazan config.
            const sevenPayConfig = getIntegrationsConfigData()?.sevenpay
            // Bez ovoga se ne vidi zasto uredaj javlja "nedostaje 7pay konfiguracija":
            // razlika je izmedu praznog integrations configa (terminals se digao
            // prije control-servisa) i nepopunjenih kredencijala.
            console.log('[7pay] integrations config ucitan:', !!getIntegrationsConfigData(),
                '| sevenpay sekcija:', !!sevenPayConfig,
                '| api_key postavljen:', !!sevenPayConfig?.api_key)
            const payment7pay = sevenPayConfig?.api_key ? {
                package_name: sevenPayConfig.package_name || 'com.sevenpay.tnp_test',
                api_key: sevenPayConfig.api_key,
                email: sevenPayConfig.email,
                password: sevenPayConfig.password,
                partner_id: sevenPayConfig.partner_id,
                sender_app_id: sevenPayConfig.sender_app_id,
                version: sevenPayConfig.version || '2.1',
                ecr_id: sevenPayConfig.ecr_id || 1234,
            } : null

            dataToSend = {
                basic_data:basicData,
                users:usersForTerminal,
                payment_method:paymentsForTerminal,
                payment_7pay:payment7pay,
                // Sifarnik postotaka storniranja — terminal ih nudi kao izbor
                // umjesto slobodnog upisa. Ako backoffice ne odgovori, ide prazna
                // lista pa uredaj zadrzi zadnje sinkronizirane.
                storno_percentages: stornoPercentagesData?.data?.storno_percentages || []
            }
            return(dataToSend)
            }
    } catch (error) {
        console.log(error)
        return
    }
}

module.exports = {
    getTerminalBasicDataHandler
}