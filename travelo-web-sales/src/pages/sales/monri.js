import axios from 'axios'
import { SHA512, enc } from 'crypto-js'
import { url } from '../../config/config'

const MONRI_URL = 'https://ipgtest.monri.com/v2/form'
const MERCHANT_KEY = 'krilo65#$%&amp;3'
const AUTHENTICITY_TOKEN = 'cec50256766ed9ba50fc88d7787326494f3f06fe'

// Monri na povratku dodaje svoje parametre (order_number, status, digest, …).
// Vraćamo se na backend (/monricallback), a ne ravno na stranicu s kartama:
// tamo se provjeri digest i dovrši narudžba, pa handler preusmjeri preglednik
// na /download s istim parametrima. Bez toga narudžba ostaje na pending_payment
// dok ne stigne server-to-server webhook, a on traži postavku u Monri panelu —
// stranica se tada samo vrti na "pripremamo karte".
//
// Monri traži https za success_url_override, pa lokalni razvoj (http) pada na
// testnu adresu.
const FALLBACK_HTTPS_URL = 'https://webbookingtest.krilo.hr/download'
const defaultSuccessUrl = () => {
  if (typeof window === 'undefined') return FALLBACK_HTTPS_URL
  if (window.location.protocol === 'https:') return `${url}/monricallback`
  return FALLBACK_HTTPS_URL
}

// value = { order_number, amount (cents int), order_info, language? }
// Cardholder data (name/address/email/phone) is collected by Monri's hosted
// form after redirect — we don't send it here.
export const monriPayment = async (value) => {
  const digest = SHA512(
    MERCHANT_KEY + value.order_number + value.amount + 'EUR'
  ).toString(enc.Hex)

  const order = {
    order_info: value.order_info || value.order_number,
    order_number: value.order_number,
    amount: value.amount,
    currency: 'EUR',
    language: value.language || 'en',
    transaction_type: 'purchase',
    authenticity_token: AUTHENTICITY_TOKEN,
    digest,
    success_url_override: value.success_url_override || defaultSuccessUrl(),
  }

  try {
    const response = await axios.post(MONRI_URL, order, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })
    if (response.data?.payment_url) {
      window.open(response.data.payment_url, '_self')
    }
    return response.data
  } catch (error) {
    console.error('monri error:', error?.response?.status, error?.response?.data || error.message)
    throw error
  }
}
