import { resolveBackendUrl } from "./backendUrl"

// Web prodaja ima svoj servis (/web_sale) i gateway (/) na istom poslužitelju.
export const url = import.meta.env.VITE_WEB_SALES_URL
    || resolveBackendUrl('/web_sale', 'http://localhost:6030')
export const downloadurl = import.meta.env.VITE_DOWNLOAD_URL
    || resolveBackendUrl('', 'http://localhost:5100')
