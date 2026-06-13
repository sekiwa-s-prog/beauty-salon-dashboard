import { google } from 'googleapis'
import path from 'path'
import fs from 'fs'

function getAuth(readonly = true) {
  const scopes = readonly
    ? ['https://www.googleapis.com/auth/spreadsheets.readonly']
    : ['https://www.googleapis.com/auth/spreadsheets']

  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8')
    )
    return new google.auth.GoogleAuth({ credentials, scopes })
  }
  const credPath = path.join(process.cwd(), '..', 'beauty_salon_report', 'credentials.json')
  const credentials = JSON.parse(fs.readFileSync(credPath, 'utf-8'))
  return new google.auth.GoogleAuth({ credentials, scopes })
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
  _rowIndex: number
}

function toInt(v: string | undefined): number {
  if (!v) return 0
  const n = parseInt(v.replace(/[¥,円\s]/g, ''), 10)
  return isNaN(n) ? 0 : n
}

function colLetter(i: number): string {
  // 0-based index → A, B, ..., Z, AA, ...
  if (i < 26) return String.fromCharCode(65 + i)
  return String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26))
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
    range: `'${month}'!A1:T500`,
  })

  const rows = res.data.values ?? []
  if (rows.length < 2) return []

  const headerIdx = rows.findIndex((r) => r[0] === '店舗')
  if (headerIdx === -1) return []

  const header = rows[headerIdx]
  const col = (key: string) => header.indexOf(key)

  return rows
    .slice(headerIdx + 1)
    .map((r, i) => ({ r, sheetRow: headerIdx + 1 + i + 1 })) // 1-based sheet row
    .filter(({ r }) => r[col('店舗')] && r[col('名前')])
    .map(({ r, sheetRow }) => ({
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
      newNominations:   r[col('新規指名数')]    ?? '',
      newFree:          r[col('新規フリー数')]  ?? '',
      stylePost:        r[col('スタイル投稿数')]?? '',
      blogPost:         r[col('ブログ投稿数')]  ?? '',
      _rowIndex:        sheetRow,
    }))
}

export interface ManualUpdate {
  rowIndex: number
  newNominations: string
  newFree: string
  stylePost: string
  blogPost: string
}

export async function saveManualFields(month: string, updates: ManualUpdate[]): Promise<void> {
  if (updates.length === 0) return
  const sheets = google.sheets({ version: 'v4', auth: getAuth(false) })

  // Read first 3 rows to find actual header row (row 1 is the month marker)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${month}'!A1:T3`,
  })
  const allRows = res.data.values ?? []
  const headerRow = allRows.find((r) => r[0] === '店舗') ?? []
  const header = headerRow as string[]

  const cNewNom  = header.indexOf('新規指名数')
  const cNewFree = header.indexOf('新規フリー数')
  const cStyle   = header.indexOf('スタイル投稿数')
  const cBlog    = header.indexOf('ブログ投稿数')

  // Fallback: if header row is not row 1, find it
  const startCol = Math.min(...[cNewNom, cNewFree, cStyle, cBlog].filter((c) => c >= 0))
  const endCol   = Math.max(...[cNewNom, cNewFree, cStyle, cBlog].filter((c) => c >= 0))

  if (startCol < 0) throw new Error('スプレッドシートに新規列ヘッダーが見つかりません。スクレイパーを再実行してください。')

  const data = updates.map((u) => {
    const rowValues: string[] = []
    for (let c = startCol; c <= endCol; c++) {
      if (c === cNewNom)  rowValues.push(u.newNominations)
      else if (c === cNewFree) rowValues.push(u.newFree)
      else if (c === cStyle)   rowValues.push(u.stylePost)
      else if (c === cBlog)    rowValues.push(u.blogPost)
      else rowValues.push('')
    }
    return {
      range: `'${month}'!${colLetter(startCol)}${u.rowIndex}:${colLetter(endCol)}${u.rowIndex}`,
      values: [rowValues],
    }
  })

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  })
}
