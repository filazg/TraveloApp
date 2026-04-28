import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Button,
  Checkbox,
  Grid,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import axios from 'axios'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import ScienceIcon from '@mui/icons-material/Science'
import { HeaderSmall } from '../../../components/Headers'
import { useT } from '../../../i18n/useT'
import {
  postDataThunk,
  resetTicketsData,
  resetTripData,
  setBuyerData,
  setGlobalLoading,
  setOrderNumber,
  setPreparedTickets,
  setStatus,
  updateTickets,
  webSalesDataSlice,
} from '../../webSalesSlice'
import { monriPayment } from '../../sales/monri'
import { url } from '../../../config/config'

import mc from '../../../assets/mc_vrt_opt_pos_63_2x.png'
import ms from '../../../assets/ms_vrt_opt_pos_53_2x.png'
import visa from '../../../assets/Visa 2015 50.gif'
import diners from '../../../assets/Diners50.gif'
import amex from '../../../assets/AmericanExpress50.jpg'

const subtotal = (tickets) => tickets.reduce((sum, t) => sum + (t.total_price || 0), 0)

// Pure helper: build preparedTickets[] from raw tickets. Same logic as the
// useEffect below, usable from submit handlers where we can't rely on redux
// state having been updated yet (render-ordering race).
const buildPreparedTickets = (tickets) => {
  const prepared = []
  const uniqueRoutes = tickets.filter(
    (v, i, a) => a.findIndex((t) => t.sales_route_uuid === v.sales_route_uuid) === i
  )
  for (const route of uniqueRoutes) {
    const routeTickets = tickets.filter((t) => t.sales_route_uuid === route.sales_route_uuid)
    // Grupiranje: otočne karte ne smiju se mergati po ticket_type_uuid jer
    // svaka iskaznica nosi vlastite SEOP podatke koje treba ispisati na karti.
    const groupKey = (t) => `${t.ticket_type_uuid}|${t.is_island ? (t.seop_card_no || '') : ''}`
    const uniqueTypes = routeTickets.filter(
      (v, i, a) => a.findIndex((t) => groupKey(t) === groupKey(v)) === i
    )
    const ticketsByType = uniqueTypes.map((type) => {
      const ofType = routeTickets.filter((tt) => groupKey(tt) === groupKey(type))
      return {
        ticket_type_name: type.ticket_type_name,
        ticket_type_id: type.ticket_type_id,
        ticket_type_uuid: type.ticket_type_uuid,
        single_price: type.single_price,
        total_price: ofType.reduce((s, i) => s + (i.total_price || 0), 0),
        total_vat_base: ofType.reduce((s, i) => s + (i.total_vat_base || 0), 0),
        total_vat: ofType.reduce((s, i) => s + (i.total_vat || 0), 0),
        total_harbor_tax: ofType.reduce((s, i) => s + (i.total_harbor_tax || 0), 0),
        quantity: ofType.reduce((s, i) => s + (i.quantity || 0), 0),
        is_island: type.is_island === true,
        seop_card_no: type.seop_card_no || null,
        seop_pravo: type.seop_pravo || null,
        seop_otok: type.seop_otok || null,
        seop_discount_pct: type.seop_discount_pct ?? null,
      }
    })
    prepared.push({
      sales_route_uuid: route.sales_route_uuid,
      line_code: route.line_code,
      line_name: route.line_name,
      departure: route.departure,
      departure_harbor_id: route.departure_harbor_id,
      departure_harbor_name: route.departure_harbor_name,
      arrival: route.arrival,
      arrival_harbor_id: route.arrival_harbor_id,
      arrival_harbor_name: route.arrival_harbor_name,
      ticket_item_price: ticketsByType.reduce((s, i) => s + i.total_price, 0),
      ticket_item_vat_base: ticketsByType.reduce((s, i) => s + i.total_vat_base, 0),
      ticket_item_vat: ticketsByType.reduce((s, i) => s + i.total_vat, 0),
      ticket_item_harbor_tax: ticketsByType.reduce((s, i) => s + i.total_harbor_tax, 0),
      ticketsData: ticketsByType,
    })
  }
  return prepared
}

export default function SelectedTicketsSummaryComponent() {
  const { t, lang } = useT()
  const dispatch = useDispatch()
  const webSalesData = useSelector(webSalesDataSlice)
  const salesData = webSalesData.salesData || {}
  const statuses = webSalesData.statuses || {}
  const tickets = salesData.tickets || []
  const preparedTickets = salesData.preparedTickets || []
  const buyerData = salesData.buyerData || {}

  const [minutes, setMinutes] = useState(14)
  const [seconds, setSeconds] = useState(59)
  const [companyInvoice, setCompanyInvoice] = useState(false)
  const [countries, setCountries] = useState([])

  useEffect(() => {
    let alive = true
    axios.get(`${url}/countries`).then((resp) => {
      if (!alive) return
      setCountries(resp.data?.data?.countries || [])
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  const [submitting, setSubmitting] = useState(false)
  const isNonMobile = useMediaQuery('(min-width:600px)')


  const handleTimeOut = () => {
    dispatch(resetTripData())
    dispatch(resetTicketsData())
  }

  useEffect(() => {
    const iv = setInterval(() => {
      setSeconds((s) => {
        if (s > 0) return s - 1
        setMinutes((m) => {
          if (m === 0) {
            handleTimeOut()
            clearInterval(iv)
            return 0
          }
          return m - 1
        })
        return 59
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // Group selected tickets by sales_route_uuid → preparedTickets (for display)
  useEffect(() => {
    dispatch(setPreparedTickets({ value: buildPreparedTickets(tickets) }))
  }, [tickets, dispatch])

  // Validate buyer data live
  useEffect(() => {
    const isValidEmail = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/g
    const baseOk =
      buyerData.summary_buyer_email &&
      String(buyerData.summary_buyer_email).match(isValidEmail) &&
      buyerData.summary_buyer_name &&
      buyerData.summary_checkbox_term
    const companyOk =
      !companyInvoice ||
      (buyerData.summary_buyer_company_name &&
        buyerData.summary_buyer_company_vat_id &&
        buyerData.summary_buyer_company_address &&
        buyerData.summary_buyer_company_postal_code &&
        buyerData.summary_buyer_company_town &&
        buyerData.summary_buyer_company_country)
    dispatch(setStatus({ path: 'validateBuyerData', value: !!(baseOk && companyOk) }))
  }, [buyerData, companyInvoice, dispatch])

  const total = subtotal(tickets)

  const handleRemove = (_, row) => {
    const filtered = tickets.filter((tt) => tt.sales_route_uuid !== row.sales_route_uuid)
    dispatch(updateTickets({ value: filtered }))
  }

  const handleBuyerField = (e) => {
    dispatch(setBuyerData({ path: e.target.name, value: e.target.value }))
  }

  const handleCheck = (e) => {
    dispatch(setBuyerData({ path: 'summary_checkbox_term', value: e.target.checked }))
  }

  const createOrderOnBackend = async (uuidOrder) => {
    const prepared = buildPreparedTickets(tickets)
    if (!prepared.length) {
      throw new Error('No tickets to order (prepared is empty)')
    }
    const resp = await axios.post(`${url}/order_confirmation`, {
      data: prepared,
      order_number: uuidOrder,
      buyer_data: buyerData,
      language: lang,
    })
    console.log('order_confirmation ←', resp.data)
    if (resp.data?.status && resp.data.status !== 200) {
      throw new Error(`order_confirmation status ${resp.data.status}`)
    }
    return resp.data
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    dispatch(setGlobalLoading({ active: true, message: 'Pripremamo Vašu narudžbu…' }))
    const uuidOrder = uuid()
    dispatch(setOrderNumber({ value: uuidOrder }))

    try {
      await createOrderOnBackend(uuidOrder)
      dispatch(setGlobalLoading({ active: true, message: 'Preusmjeravamo na sigurno plaćanje…' }))
      const intAmount = Math.round(total * 100)
      await monriPayment({
        order_number: uuidOrder,
        amount: intAmount,
        order_info: uuidOrder,
        language: lang === 'hr' ? 'hr' : 'en',
      })
      // Loading ostaje aktivan do redirect-a (browser preuzima kontrolu).
    } catch (err) {
      console.error('submit error:', err?.response?.data || err.message)
      dispatch(setGlobalLoading({ active: false }))
      alert(`Greška: ${err?.response?.data?.data?.message || err.message}`)
      setSubmitting(false)
    }
  }

  // DEV only — skip Monri (no HTTPS on localhost) and finalize directly.
  const handleSimulate = async () => {
    setSubmitting(true)
    dispatch(setGlobalLoading({ active: true, message: 'Simulacija plaćanja u tijeku…' }))
    const uuidOrder = uuid()
    dispatch(setOrderNumber({ value: uuidOrder }))
    console.log('simulate: starting with uuidOrder', uuidOrder)
    try {
      await createOrderOnBackend(uuidOrder)
      dispatch(setGlobalLoading({ active: true, message: 'Generiramo karte i račun…' }))
      const simResp = await axios.post(`${url}/simulate_payment`, {
        payment_reference: uuidOrder,
        status: 'approved',
      })
      console.log('simulate_payment ←', simResp.data)
      window.location.href = `/download?order_number=${encodeURIComponent(uuidOrder)}&status=approved`
    } catch (err) {
      console.error('simulate error:', err?.response?.data || err.message)
      dispatch(setGlobalLoading({ active: false }))
      alert(`Simulacija nije uspjela: ${err?.response?.data?.data?.message || err.message}`)
      setSubmitting(false)
    }
  }

  const devMode = typeof import.meta !== 'undefined' && import.meta.env?.DEV

  return (
    <Grid size={12}>
      <Grid container direction="row" spacing={1}>
        <Grid size={12}>
          {minutes === 0 && seconds === 0 ? null : (
            <Typography variant="h6">
              {t('summary.time')} {minutes}:
              {seconds < 10 ? `0${seconds}` : seconds}
            </Typography>
          )}
        </Grid>

        <Grid size={12}>
          <HeaderSmall
            subtitle={t('summary.title')}
            subtitle1={t('summary.subtitle')}
          />
        </Grid>

        <Grid size={12}>
          {preparedTickets.map((row) => (
            <Box
              key={row.sales_route_uuid}
              sx={{
                bgcolor: 'background.paper',
                boxShadow: 7,
                borderRadius: 2,
                mb: 2,
                p: 2,
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <ShoppingCartOutlinedIcon />
                <Button color="error" onClick={(e) => handleRemove(e, row)}>
                  {t('summary.remove_ticket')}
                </Button>
              </Box>
              <Typography variant="h6" sx={{ mt: 1 }}>
                {row.departure_harbor_name?.toUpperCase()} – {row.arrival_harbor_name?.toUpperCase()}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('summary.departure')}: {row.departure}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('summary.ticket_type')}</TableCell>
                      <TableCell align="right">{t('summary.quantity')}</TableCell>
                      <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        {t('summary.price')}
                      </TableCell>
                      <TableCell align="right">{t('summary.amount')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {row.ticketsData.map((ttype, i) => (
                      <TableRow key={`${ttype.ticket_type_uuid}-${ttype.seop_card_no || i}`}>
                        <TableCell>
                          {ttype.ticket_type_name}
                          {ttype.is_island && (
                            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                              Iskaznica br.: <strong>{ttype.seop_card_no}</strong>
                              {ttype.seop_otok ? ` · ${ttype.seop_otok}` : ''}
                              {ttype.seop_pravo ? ` · ${ttype.seop_pravo}` : ''}
                              {ttype.seop_discount_pct ? ` · -${ttype.seop_discount_pct}%` : ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{ttype.quantity}</TableCell>
                        <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {ttype.single_price.toFixed(2)} EUR
                        </TableCell>
                        <TableCell align="right">{ttype.total_price.toFixed(2)} EUR</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Grid>

        <Grid size={12}>
          <Stack direction="row" alignItems="center">
            <HeaderSmall subtitle={t('summary.buyer_title')} />
            <Tooltip title={t('summary.buyer_info')}>
              <IconButton>
                <InfoOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box
            display="grid"
            gridTemplateColumns="repeat(4, minmax(0, 1fr))"
            sx={{ '& > *': { gridColumn: isNonMobile ? undefined : 'span 4' }, gap: 2 }}
          >
            <Stack direction="row" alignItems="center" sx={{ gridColumn: 'span 4' }}>
              <Switch
                color="primary"
                checked={companyInvoice}
                onChange={(e) => setCompanyInvoice(e.target.checked)}
              />
              <Typography>{t('summary.buyer_company_invoice')}</Typography>
            </Stack>
            <TextField
              name="summary_buyer_name"
              label={t('summary.buyer_name')}
              value={buyerData.summary_buyer_name || ''}
              onChange={handleBuyerField}
              required
              fullWidth
              sx={{ gridColumn: 'span 4' }}
            />
            <TextField
              name="summary_buyer_email"
              label={t('summary.buyer_email')}
              type="email"
              value={buyerData.summary_buyer_email || ''}
              onChange={handleBuyerField}
              required
              fullWidth
              sx={{ gridColumn: 'span 4' }}
            />
            {companyInvoice && (
              <>
                <TextField
                  name="summary_buyer_company_name"
                  label={t('summary.buyer_company_name')}
                  value={buyerData.summary_buyer_company_name || ''}
                  onChange={handleBuyerField}
                  required
                  fullWidth
                  sx={{ gridColumn: 'span 4' }}
                />
                <TextField
                  name="summary_buyer_company_address"
                  label={t('summary.buyer_company_address')}
                  value={buyerData.summary_buyer_company_address || ''}
                  onChange={handleBuyerField}
                  required
                  fullWidth
                  sx={{ gridColumn: 'span 4' }}
                />
                <TextField
                  name="summary_buyer_company_postal_code"
                  label={t('summary.buyer_company_postal_code')}
                  value={buyerData.summary_buyer_company_postal_code || ''}
                  onChange={handleBuyerField}
                  required
                  fullWidth
                  sx={{ gridColumn: 'span 2' }}
                />
                <TextField
                  name="summary_buyer_company_town"
                  label={t('summary.buyer_company_town')}
                  value={buyerData.summary_buyer_company_town || ''}
                  onChange={handleBuyerField}
                  required
                  fullWidth
                  sx={{ gridColumn: 'span 2' }}
                />
                <TextField
                  name="summary_buyer_company_vat_id"
                  label={t('summary.buyer_company_vat_id')}
                  value={buyerData.summary_buyer_company_vat_id || ''}
                  onChange={handleBuyerField}
                  required
                  fullWidth
                  sx={{ gridColumn: 'span 4' }}
                />
                <TextField
                  select
                  name="summary_buyer_company_country"
                  label={t('summary.buyer_company_country')}
                  value={buyerData.summary_buyer_company_country || ''}
                  onChange={handleBuyerField}
                  required
                  fullWidth
                  sx={{ gridColumn: 'span 4' }}
                >
                  <MenuItem value="">—</MenuItem>
                  {countries.map((c) => (
                    <MenuItem key={c.code} value={c.code}>
                      {c.name_hr} ({c.code})
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
          </Box>
          <Stack direction="row" alignItems="center" sx={{ mt: 2 }}>
            <Checkbox checked={!!buyerData.summary_checkbox_term} onChange={handleCheck} />
            <Typography variant="body2">
              {t('summary.checkbox_term_first')}{' '}
              <Link href={t('navbar.terms_link') || '#'} target="_blank">
                {t('summary.checkbox_term_general')}
              </Link>{' '}
              {t('summary.and')}{' '}
              <Link href={t('navbar.payment_link') || '#'} target="_blank">
                {t('summary.checkbox_term_payment')}
              </Link>
            </Typography>
          </Stack>
        </Grid>

        <Grid size={12} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            fullWidth
            disabled={!statuses.validateBuyerData || submitting || total === 0}
            sx={{ height: 60 }}
            onClick={handleSubmit}
          >
            <Typography variant="h6">
              {submitting ? (t('summary.processing')) : (t('summary.pay'))} {total.toFixed(2)} EUR
            </Typography>
          </Button>
          {devMode && (
            <Button
              fullWidth
              color="warning"
              variant="outlined"
              disabled={!statuses.validateBuyerData || submitting || total === 0}
              startIcon={<ScienceIcon />}
              sx={{ mt: 1, height: 44, borderStyle: 'dashed' }}
              onClick={handleSimulate}
            >
              DEV: simuliraj plaćanje (bez Monrija)
            </Button>
          )}
        </Grid>

        <Grid
          size={12}
          container
          direction="row"
          justifyContent="center"
          alignItems="center"
          spacing={2}
          sx={{ mt: 2 }}
        >
          {[
            { src: mc, href: 'https://www.mastercard.hr/hr-hr.html', alt: 'mc' },
            { src: ms, href: 'https://www.mastercard.com/brandcenter/en/home', alt: 'ms' },
            { src: visa, href: 'https://www.visa.co.uk/about-visa/visa-in-europe.html', alt: 'visa' },
            { src: diners, href: 'https://www.diners.hr/', alt: 'diners' },
            { src: amex, href: 'https://www.americanexpress.com', alt: 'amex' },
          ].map((card) => (
            <Grid key={card.alt}>
              <Button onClick={() => window.open(card.href, '_blank')}>
                <img alt={card.alt} height="40px" src={card.src} />
              </Button>
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Grid>
  )
}
