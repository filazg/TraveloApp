const axios = require('axios');
const { getChannalServiceConfigData, getMainServiceConfigData, getCoreServiceConfigData } = require('./configSyncController');

const gatewayController = async (req, res) => {
    console.log('TU SMO API')
    console.log(req.params)
    console.log(req.query)
    const registryData = await getChannalServiceConfigData()
    const mainServicesRegistry = await getMainServiceConfigData()
    const coreServicesRegistry = await getCoreServiceConfigData()
    try {
        if (registryData.services[req.params.servis]) {
            console.log('TU SMO U REGISTRIJU')
            if (registryData.services[req.params.servis].is_login) {
                console.log('DOBRO JE')
                console.log(registryData.services[req.params.servis].url +'/' + req.params.module +'/'+ req.params.path + (req.params.subpath ? '/' + req.params.subpath : ''))
                axios({
                    method: req.method,
                    url: registryData.services[req.params.servis].url +'/' + req.params.module +'/'+ req.params.path + (req.params.subpath ? '/' + req.params.subpath : ''),
                    data: req.body
                }).then((response) => {
                    res.status(response.data.status).json(response.data.data)
                })
                .catch(error =>{
                    console.log(error)
                    res.status(500)
                })
            } else { 
                console.log('AUTH') 
                console.log(req.cookies) 
                console.log('AUTH') 
                axios({
                    method: 'post',
                    url: registryData.services[req.params.servis].auth_url,
                    headers: {
                        cookie: req.headers.cookie || "",
                    },
                    data: {
                        body:req.body,
                        headers: req.headers},
                validateStatus: () => true,           
                }).then(async (response) => {
                    console.log(response)
                    if(response.status === 200){
                        if(req.params.path === 'api_sales_login'){
                            axios({
                                method: req.method,
                                url: registryData.services[req.params.servis] + '/' + req.params.path,
                                data: {
                                    header:response.data.data.data,
                                    body:req.body
                                }
                            }).then((resp)=>{
                                console.log(resp.data)
                                res.status(resp.data.status).json(resp.data.data)
                            })
                        }else{
                            const serviceUrl = registryData.services[req.params.servis].url + '/' + req.params.module + '/' + req.params.path + (req.params.subpath ? '/' + req.params.subpath : '');
                            try {
                                // Odgovor se uzima kao tok pa se tek onda odlucuje:
                                // otvorena veza (SSE) mora teci prema uredaju, a
                                // sve ostalo se skupi kao i dosad. S 'arraybuffer'
                                // gateway je cekao kraj odgovora, pa otvorena veza
                                // nikad ne bi stigla do uredaja.
                                const respo = await axios({
                                    method: req.method,
                                    url: serviceUrl,
                                    data: {
                                        header: response.data.data,
                                        body: req.body,
                                    },
                                    params: req.query,
                                    responseType: 'stream',
                                    validateStatus: () => true,
                                });
                                const ctype = respo.headers['content-type'] || 'application/octet-stream';

                                if (ctype.includes('text/event-stream')) {
                                    res.status(respo.status);
                                    res.setHeader('content-type', ctype);
                                    res.setHeader('cache-control', 'no-cache, no-transform');
                                    res.setHeader('connection', 'keep-alive');
                                    // Nginx inace skuplja odgovor i uredaj ne dobije nista.
                                    res.setHeader('x-accel-buffering', 'no');
                                    res.flushHeaders?.();
                                    respo.data.pipe(res);
                                    // Kad uredaj prekine vezu, treba prekinuti i onu
                                    // prema servisu, inace ostaje viseti.
                                    const prekini = () => { try { respo.data.destroy(); } catch (e) { /* vec zatvoreno */ } };
                                    req.on('close', prekini);
                                    res.on('close', prekini);
                                    return;
                                }

                                const dijelovi = [];
                                for await (const dio of respo.data) dijelovi.push(dio);
                                const tijelo = Buffer.concat(dijelovi);

                                if (ctype.includes('application/json')) {
                                    const parsed = JSON.parse(tijelo.toString('utf-8'));
                                    const status = parsed?.status ?? respo.status;
                                    const body = parsed?.data !== undefined ? parsed.data : parsed;
                                    return res.status(status).json(body);
                                }
                                // Binary passthrough (PDF, images, etc.)
                                res.status(respo.status);
                                res.setHeader('content-type', ctype);
                                if (respo.headers['content-disposition']) {
                                    res.setHeader('content-disposition', respo.headers['content-disposition']);
                                }
                                return res.send(tijelo);
                            } catch (err) {
                                console.log('CHANNEL GATEWAY ERROR:', err?.message || err);
                                return res.status(500).json({ msg: 'gateway_error' });
                            }
                        }
                    }else{
                        console.log('authERROr')
                        const s = Number.isInteger(response?.data?.status) ? response.data.status : (response?.status || 401);
                        res.status(s).json(response?.data?.data || { msg: response?.data?.message || 'auth_failed' })
                    }
                })
            }
        }else if(mainServicesRegistry.services[req.params.servis]){
            console.log('DOBRO JE DOLJE SMO', req.params.servis)
                console.log(mainServicesRegistry.services[req.params.servis].url +'/' + req.params.module +'/'+ req.params.path + (req.params.subpath ? '/' + req.params.subpath : ''))
                console.log(req.method)
                console.log(req.body)
                console.log(mainServicesRegistry.services[req.params.servis].is_login)
            if (mainServicesRegistry.services[req.params.servis].is_login) {
                console.log('IS LOGIN')
                axios({
                    method: req.method,
                    url: mainServicesRegistry.services[req.params.servis].url +'/' + req.params.module +'/'+ req.params.path + (req.params.subpath ? '/' + req.params.subpath : ''),
                    data: req.body,
                    validateStatus: () => true,
                    headers: {
                        ...req.headers,
                        host: undefined,
                        "content-length": undefined,
                    },
                }).then((response) => {
                    if(mainServicesRegistry.services[req.params.servis].cookie){

                        res.status(response.status);
                        const setCookie = response.headers["set-cookie"];
                        if (setCookie) {
                            res.setHeader("set-cookie", setCookie);
                        }
                        if (response.headers["content-type"]) {
                            res.setHeader("content-type", response.headers["content-type"]);
                        }
                        
                        return res.send(response.data);
                    }else{
                        res.status(response.data.status).json(response.data.data)
                    }

                    //
                })
                .catch(error =>{
                    console.log(error)
                    res.status(500)
                })
            }
        } else if (coreServicesRegistry?.services?.[req.params.servis]) {
            const svc = coreServicesRegistry.services[req.params.servis];
            const targetUrl = svc.url + '/' + req.params.module
                + (req.params.path ? '/' + req.params.path : '')
                + (req.params.subpath ? '/' + req.params.subpath : '');
            try {
                const response = await axios({
                    method: req.method,
                    url: targetUrl,
                    data: req.body,
                    params: req.query,
                    headers: { cookie: req.headers.cookie || "" },
                    validateStatus: () => true,
                    responseType: 'arraybuffer',
                });
                const ctype = response.headers['content-type'] || 'application/octet-stream';
                res.status(response.status);
                res.setHeader('content-type', ctype);
                if (response.headers['content-disposition']) {
                    res.setHeader('content-disposition', response.headers['content-disposition']);
                }
                if (ctype.includes('application/json')) {
                    const payload = JSON.parse(Buffer.from(response.data).toString('utf-8'));
                    const status = payload?.status ?? response.status;
                    const body = payload?.data !== undefined ? payload.data : payload;
                    return res.status(status).json(body);
                }
                return res.send(Buffer.from(response.data));
            } catch (error) {
                console.log('CORE GATEWAY ERROR:', error?.message || error);
                return res.status(500).send();
            }
        } else {
            res.status(400).json({ msg: 'Nije pronaden servis' })
        }

    } catch (error) {
        console.log('ERROR JE....', error)
        res.send({
            status:500,
            data:error
        })
    }
}


module.exports = { 
    gatewayController
}