'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface StaffRow {
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
}

type SortKey = keyof StaffRow
type SortDir = 'asc' | 'desc'

const NUMERIC_KEYS: SortKey[] = [
  'totalSales', 'techSales', 'promoSales', 'otherSales',
  'avgSpend', 'totalCustomers', 'totalNominations',
]

function yen(n: number) {
  return '¥' + n.toLocaleString('ja-JP')
}

function pct(v: string) {
  if (v === '-') return '-'
  // Already formatted like "45.2%" or "45.2"
  return v.includes('%') ? v : v + '%'
}

const COLUMNS: { key: SortKey; label: string; format?: (row: StaffRow) => string }[] = [
  { key: 'store',            label: '店舗' },
  { key: 'name',             label: '名前' },
  { key: 'totalSales',       label: '総売上',       format: (r) => yen(r.totalSales) },
  { key: 'techSales',        label: '技術売上',      format: (r) => yen(r.techSales) },
  { key: 'promoSales',       label: '販促売上',      format: (r) => yen(r.promoSales) },
  { key: 'otherSales',       label: 'その他売上',    format: (r) => yen(r.otherSales) },
  { key: 'avgSpend',         label: '単価',          format: (r) => yen(r.avgSpend) },
  { key: 'totalCustomers',   label: '総合客数' },
  { key: 'totalNominations', label: '合計指名数' },
  { key: 'new3m',            label: '新規3ヶ月',     format: (r) => pct(r.new3m) },
  { key: 'new6m',            label: '新規6ヶ月',     format: (r) => pct(r.new6m) },
  { key: 'fixed3m',          label: '固定3ヶ月',     format: (r) => pct(r.fixed3m) },
  { key: 'fixed6m',          label: '固定6ヶ月',     format: (r) => pct(r.fixed6m) },
  { key: 'sixMonthNew',      label: '6ヶ月新規数' },
  { key: 'sixMonthLost',     label: '6ヶ月失客数' },
  { key: 'newLossRate',      label: '新規失客率',    format: (r) => pct(r.newLossRate) },
]

function sortRows(rows: StaffRow[], key: SortKey, dir: SortDir): StaffRow[] {
  return [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    let cmp: number
    if (NUMERIC_KEYS.includes(key)) {
      cmp = (av as number) - (bv as number)
    } else {
      const as = (av as string).replace('%', '')
      const bs = (bv as string).replace('%', '')
      const an = parseFloat(as)
      const bn = parseFloat(bs)
      if (!isNaN(an) && !isNaN(bn)) {
        cmp = an - bn
      } else {
        cmp = String(av).localeCompare(String(bv), 'ja')
      }
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [months, setMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('totalSales')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterStore, setFilterStore] = useState('')

  useEffect(() => {
    fetch('/api/sheets')
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then((d) => {
        if (!d) return
        setMonths(d.months ?? [])
        if (d.months?.[0]) setSelectedMonth(d.months[0])
      })
      .catch(() => setError('月一覧の取得に失敗しました'))
  }, [router])

  const fetchData = useCallback((month: string) => {
    if (!month) return
    setLoading(true)
    setError('')
    fetch(`/api/sheets?month=${encodeURIComponent(month)}`)
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.json()
      })
      .then((d) => {
        if (!d) return
        setRows(d.data ?? [])
      })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (selectedMonth) fetchData(selectedMonth)
  }, [selectedMonth, fetchData])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const stores = Array.from(new Set(rows.map((r) => r.store))).sort()
  const filtered = filterStore ? rows.filter((r) => r.store === filterStore) : rows
  const sorted = sortRows(filtered, sortKey, sortDir)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="font-bold text-white text-lg">AI TOKYO GROUP</span>
          <span className="text-gray-400 text-sm ml-3">月次成績ダッシュボード</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
        >
          ログアウト
        </button>
      </header>

      <main className="px-4 py-5 max-w-[1600px] mx-auto">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">対象月</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">店舗</label>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全店舗</option>
              {stores.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {!loading && rows.length > 0 && (
            <span className="text-gray-500 text-sm ml-auto">
              {sorted.length}名 表示
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            データ取得中...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm border-collapse min-w-[1400px]">
              <thead>
                <tr className="bg-gray-800 text-gray-300 text-xs uppercase tracking-wide">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-3 py-3 text-left cursor-pointer select-none hover:text-white whitespace-nowrap
                                 border-b border-gray-700 transition-colors"
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span className="ml-1 text-indigo-400">
                          {sortDir === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-gray-500">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  sorted.map((row, i) => (
                    <tr
                      key={`${row.store}-${row.name}-${i}`}
                      className="border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors"
                    >
                      {COLUMNS.map((col) => {
                        const raw = row[col.key]
                        const display = col.format ? col.format(row) : String(raw)
                        const isDash = display === '-'
                        const isHighSales = col.key === 'totalSales' && (raw as number) >= 3_000_000
                        return (
                          <td
                            key={col.key}
                            className={[
                              'px-3 py-2.5 whitespace-nowrap',
                              isDash ? 'text-gray-600' : '',
                              isHighSales ? 'text-yellow-400 font-semibold' : '',
                              col.key === 'store' ? 'text-gray-400' : '',
                              col.key === 'name' ? 'font-medium text-white' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {display}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
