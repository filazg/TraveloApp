import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ThemeProvider,
  Typography,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import DirectionsBoatIcon from '@mui/icons-material/DirectionsBoat'
import HomeIcon from '@mui/icons-material/Home'
import { useDispatch, useSelector } from 'react-redux'
import { theme } from '../../theme'
import { useT } from '../../i18n/useT'
import { url } from '../../config/config'
import Navbar from '../../components/Navbar'
import { resetTicketsData, resetTripData, webSalesDataSlice } from '../webSalesSlice'

const fmtEUR = (n) => `${Number(n).toFixed(2)} EUR`

export default function DownloadPage() {
  const { t } = useT()
  const dispatch = useDispatch()
  const webSalesData = useSelector(webSalesDataSlice)
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [orders, setOrders] = useState([])
  const [payload, setPayload] = useState(null)

  // Monri typically returns `order_number` in query. We stored it as payment_reference.
  const paymentReference =
    searchParams.get('order_number') ||
    searchParams.get('payment_reference') ||
    searchParams.get('reference') ||
    ''

  const monriStatus = (searchParams.get('status') || '').toLowerCase()
  const paymentFailed = monriStatus && !['approved', 'success', 'ok'].includes(monriStatus)

  useEffect(() => {
    // Clear any leftover cart state so returning to / shows a fresh search.
    dispatch(resetTripData())
    dispatch(resetTicketsData())
  }, [dispatch])

  useEffect(() => {
    if (!paymentReference) {
      setLoading(false)
      setError(t('download.no_reference'))
      return
    }

    // Monri otkazana/odbijena uplata — ne polluj invoice_uuid (nikad neće doći).
    // Server-side GET /monricallback je već markirao order kao declined.
    if (paymentFailed) {
      setLoading(false)
      return
    }

    let cancelled = false
    // Order-i postoje od trenutka kreiranja narudžbe (prije plaćanja), ali
    // invoice_uuid se postavlja tek kad Monri webhook → finalize_web_sale dovrši.
    // Zato čekamo dok svi order-i nemaju invoice_uuid (a ne samo dok postoje).
    const isReady = (list) => list.length > 0 && list.every((o) => o.invoice_uuid)
    const MAX_ATTEMPTS = 12 // 12 × 1.5s = ~18s — webhook + finalize obično < 5s
    const poll = async (attempt = 0) => {
      try {
        const resp = await axios.get(`${url}/orders_by_reference`, {
          params: { payment_reference: paymentReference },
        })
        const data = resp.data?.data ?? resp.data
        const list = Array.isArray(data?.orders) ? data.orders : []
        if (cancelled) return
        if (isReady(list)) {
          setOrders(list)
          setPayload(data)
          setLoading(false)
        } else if (attempt < MAX_ATTEMPTS) {
          setTimeout(() => poll(attempt + 1), 1500)
        } else if (list.length) {
          // Timeout — pokaži ono što imamo (karte + napomena da račun još dolazi).
          setOrders(list)
          setPayload(data)
          setError(t('download.not_ready'))
          setLoading(false)
        } else {
          setError(t('download.not_ready'))
          setLoading(false)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError(t('download.fetch_error'))
          setLoading(false)
        }
      }
    }
    poll()
    return () => {
      cancelled = true
    }
  }, [paymentReference])

  const ordersWithPdf = orders.filter((o) => o.uuid)
  const totalAmount = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  const invoiceUuid = orders.find((o) => o.invoice_uuid)?.invoice_uuid

  const openPdf = (order) => {
    window.open(`${url}/tickets_pdf/${order.uuid}`, '_blank')
  }

  // "Preuzmi sve karte" — jedan PDF s svim kartama. Pop-up blokeri inače
  // dozvole samo prvi window.open kad se forEach pozove u istom event tick-u.
  const openAll = () => {
    if (!ordersWithPdf.length) return
    const ids = ordersWithPdf.map((o) => o.uuid).join(',')
    window.open(`${url}/tickets_pdf?order_uuids=${encodeURIComponent(ids)}`, '_blank')
  }

  const openInvoice = () => {
    if (invoiceUuid) window.open(`${url}/invoice_pdf/${invoiceUuid}`, '_blank')
  }

  return (
    <ThemeProvider theme={theme}>
      <Grid container direction="row" justifyContent="center" alignItems="flex-start">
        <Grid size={12}>
          <Navbar title={t('navbar.web_sales_title')} />
        </Grid>

        <Grid size={{ xs: 11, md: 10, lg: 8 }} sx={{ mt: 4 }}>
          <Paper sx={{ p: 4, borderRadius: 3, boxShadow: 2 }}>
            {loading && (
              <Stack direction="row" spacing={2} alignItems="center">
                <CircularProgress size={28} />
                <Typography variant="h6">
                  {t('download.processing')}
                </Typography>
              </Stack>
            )}

            {!loading && paymentFailed && (
              <>
                <Alert severity="error" sx={{ mb: 2 }}>
                  {t('download.failed')} ({monriStatus})
                </Alert>
                <Button variant="contained" startIcon={<HomeIcon />} href="/">
                  {t('download.home')}
                </Button>
              </>
            )}

            {!loading && error && (
              <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>
            )}

            {!loading && !error && orders.length > 0 && (
              <>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
                  <DirectionsBoatIcon color="primary" />
                  <Typography variant="h5" fontWeight={900}>
                    {t('download.title')}
                  </Typography>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {t('download.reference')}: <code>{paymentReference}</code>
                </Typography>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Polazak</TableCell>
                        <TableCell>Datum / Vrijeme</TableCell>
                        <TableCell align="right">Iznos</TableCell>
                        <TableCell align="right">Akcija</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((o) => (
                        <TableRow key={o.uuid}>
                          <TableCell>
                            <strong>{o.departure_harbor_name}</strong> → {o.arrival_harbor_name}
                          </TableCell>
                          <TableCell>{o.departure_date} · {o.departure_time}</TableCell>
                          <TableCell align="right">{fmtEUR(o.total_amount)}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<PictureAsPdfIcon />}
                              onClick={() => openPdf(o)}
                            >
                              {t('download.pdf')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3, justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" fontWeight={800}>
                    {t('download.total')}: {fmtEUR(totalAmount)}
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    {invoiceUuid && (
                      <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<ReceiptLongIcon />}
                        onClick={openInvoice}
                      >
                        {t('download.invoice')}
                      </Button>
                    )}
                    {ordersWithPdf.length > 1 && (
                      <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={openAll}>
                        {t('download.all_pdf')}
                      </Button>
                    )}
                    <Button variant="text" startIcon={<HomeIcon />} href="/">
                      {t('download.home')}
                    </Button>
                  </Stack>
                </Stack>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ThemeProvider>
  )
}
