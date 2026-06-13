import { google } from 'googleapis'
import path from 'path'
import fs from 'fs'

function getAuth() {
  // Vercel: GOOGLE_CREDENTIALS_BASE64 env var (base64 encoded JSON)
  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8')
    )
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
  }
  // Local dev: read credentials.json from the report directory
  const credPath = path.join(process.cwd(), '..', 'beauty_salon_report', 'credentials.json')
  const credentials = JSON.parse(fs.readFileSync(credPath, 'utf-8'))
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID ?? '1CA4Jl5gRNp0fifKw4jV-LQ45ghpYNNjNPodwN50_YJE'

export interface StaffRow {
  store: string
  name: string
  totalSales: number
  techSales: number
  promoSales: number
  otherSales: number
  avgSpend: number
  new3m: string
  new6m: string
  fixed3m: string
  fixed6m: string
  sixMonthNew: string
  sixMonthLost: string
  newLossRate: string
  totalCustomers: number
  totalNominations: number
  newNominations: string
  newFree: string
  stylePost: string
  blogPost: string
}

function toInt(v: string | undefined): number {
  if (!v) return 0
  const n = parseInt(v.replace(/[¥,円\s]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

export async function getAvailableMonths(): Promise<string[]> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const names = res.data.sheets?.map((s) => s.properties?.title ?? '') ?? []
  return names
    .filter((n) => /^\d{4}年\d{1,2}月$/.test(n))
    .sort()
    .reverse()
}

export async function getMonthData(month: string): Promise<StaffRow[]> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${month}'!A1:P500`,
  })

  const rows = res.data.values ?? []
  if (rows.length < 2) return []

  // Find header row (contains '店舗')
  const headerIdx = rows.findIndex((r) => r[0] === '店舗')
  if (headerIdx === -1) return []

  const header = rows[headerIdx]
  const col = (key: string) => header.indexOf(key)

  return rows
    .slice(headerIdx + 1)
    .filter((r) => r[col('店舗')] && r[col('名前')])
    .map((r) => ({
      store:            r[col('店舗')] ?? '',
      name:             r[col('名前')] ?? '',
      totalSales:       toInt(r[col('総売上')]),
      techSales:        toInt(r[col('技術売上')]),
      promoSales:       toInt(r[col('販促売上')]),
      otherSales:       toInt(r[col('その他売上')]),
      avgSpend:         toInt(r[col('単価')]),
      new3m:            r[col('新規3ヶ月')]     || '-',
      new6m:            r[col('新規6ヶ月')]     || '-',
      fixed3m:          r[col('固定3ヶ月')]     || '-',
      fixed6m:          r[col('固定6ヶ月')]     || '-',
      sixMonthNew:      r[col('6ヶ月新規数')]   || '-',
      sixMonthLost:     r[col('6ヶ月失客数')]   || '-',
      newLossRate:      r[col('新規失客率')]     || '-',
      totalCustomers:   toInt(r[col('総合客数')]),
      totalNominations: toInt(r[col('合計指名数')]),
      newNominations:   r[col('新規指名数')]    || '-',
      newFree:          r[col('新規フリー数')]  || '-',
      stylePost:        r[col('スタイル投稿数')]|| '-',
      blogPost:         r[col('ブログ投稿数')]  || '-',
    }))
}
