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
  newNominations: string
  newFree: string
  stylePost: string
  blogPost: string
  _rowIndex: number
}

type SortKey = keyof StaffRow
type SortDir = 'asc' | 'desc'
type RunStatus = 'idle' | 'running' | 'success' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const NUMERIC_KEYS: SortKey[] = [
  'totalSales', 'techSales', 'promoSales', 'otherSales',
  'avgSpend', 'totalCustomers', 'totalNominations',
]
const MANUAL_KEYS: SortKey[] = ['newNominations', 'newFree', 'stylePost', 'blogPost']
const LOCAL_API = 'http://127.0.0.1:8787'

function yen(n: number) { return '¥' + n.toLocaleString('ja-JP') }
function pct(v: string) { return v === '-' || v === '' ? '-' : v.includes('%') ? v : v + '%' }

const COLUMNS: { key: SortKey; label: string; format?: (row: StaffRow) => string }[] = [
  { key: 'store',            label: '店舗' },
  { key: 'name',             label: '名前' },
  { key: 'totalSales',       label: '総売上',        format: (r) => yen(r.totalSales) },
  { key: 'techSales',        label: '技術売上',       format: (r) => yen(r.techSales) },
  { key: 'promoSales',       label: '販促売上',       format: (r) => yen(r.promoSales) },
  { key: 'otherSales',       label: 'その他売上',     format: (r) => yen(r.otherSales) },
  { key: 'avgSpend',         label: '単価',           format: (r) => yen(r.avgSpend) },
  { key: 'totalCustomers',   label: '総合客数' },
  { key: 'totalNominations', label: '合計指名数' },
  { key: 'newNominations',   label: '新規指名数' },
  { key: 'newFree',          label: '新規フリー数' },
  { key: 'new3m',            label: '新規3ヶ月',      format: (r) => pct(r.new3m) },
  { key: 'new6m',            label: '新規6ヶ月',      format: (r) => pct(r.new6m) },
  { key: 'fixed3m',          label: '固定3ヶ月',      format: (r) => pct(r.fixed3m) },
  { key: 'fixed6m',          label: '固定6ヶ月',      format: (r) => pct(r.fixed6m) },
  { key: 'sixMonthNew',      label: '6ヶ月新規数' },
  { key: 'sixMonthLost',     label: '6ヶ月失客数' },
  { key: 'newLossRate',      label: '新規失客率',      format: (r) => pct(r.newLossRate) },
  { key: 'stylePost',        label: 'スタイル投稿数' },
  { key: 'blogPost',         label: 'ブログ投稿数' },
]

function sortRows(rows: StaffRow[], key: SortKey, dir: SortDir): StaffRow[] {
  return [...rows].sort((a, b) => {
    const av = a[key], bv = b[key]
    let cmp: number
    if (NUMERIC_KEYS.includes(key)) {
      cmp = (av as number) - (bv as number)
    } else {
      const an = parseFloat(String(av).replace('%', ''))
      const bn = parseFloat(String(bv).replace('%', ''))
      cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv), 'ja')
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

  // 編集モード
  const [editMode, setEditMode] = useState(false)
  const [edits, setEdits] = useState<Record<number, Partial<StaffRow>>>({})
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // データ更新（スクレイパー実行）
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [runLog, setRunLog] = useState<string[]>([])
  const [showLog, setShowLog] = useState(false)
  const [runMonth, setRunMonth] = useState('')

  useEffect(() => {
    fetch('/api/sheets')
      .then((r) => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then((d) => { if (!d) return; setMonths(d.months ?? []); if (d.months?.[0]) setSelectedMonth(d.months[0]) })
      .catch(() => setError('月一覧の取得に失敗しました'))
  }, [router])

  const fetchData = useCallback((month: string) => {
    if (!month) return
    setLoading(true); setError(''); setEdits({})
    fetch(`/api/sheets?month=${encodeURIComponent(month)}`)
      .then((r) => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then((d) => { if (!d) return; setRows(d.data ?? []) })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => { if (selectedMonth) fetchData(selectedMonth) }, [selectedMonth, fetchData])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  // スプレッドシートに保存
  async function handleSave() {
    const changed = Object.entries(edits)
    if (changed.length === 0) return
    setSaveStatus('saving')
    const updates = changed.map(([rowIdx, patch]) => ({
      rowIndex: Number(rowIdx),
      newNominations: String(patch.newNominations ?? ''),
      newFree:        String(patch.newFree ?? ''),
      stylePost:      String(patch.stylePost ?? ''),
      blogPost:       String(patch.blogPost ?? ''),
    }))
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, updates }),
      })
      if (res.ok) {
        setSaveStatus('saved')
        setEdits({})
        setEditMode(false)
        fetchData(selectedMonth)
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        const { error: msg } = await res.json()
        setError(msg || '保存に失敗しました')
        setSaveStatus('error')
      }
    } catch (e) {
      setError(`保存エラー: ${e}`)
      setSaveStatus('error')
    }
  }

  // スクレイパー実行
  async function handleRun() {
    setRunStatus('running'); setRunLog([]); setShowLog(true)
    const body = runMonth ? JSON.stringify({ month: runMonth.replace(/\D/g, '') }) : '{}'
    try {
      const res = await fetch(`${LOCAL_API}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok || !res.body) {
        setRunLog([`エラー: ${await res.text().catch(() => res.statusText)}`]); setRunStatus('error'); return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          if (part.startsWith('event: done')) {
            setRunStatus(part.includes('success') ? 'success' : 'error')
          } else if (part.startsWith('data: ')) {
            setRunLog((prev) => [...prev, part.slice(6)])
          }
        }
      }
      setRunStatus((s) => s === 'running' ? 'success' : s)
      setTimeout(() => fetchData(selectedMonth), 2000)
    } catch (e) {
      setRunLog([`ローカルサーバーに接続できません。「サーバー起動.bat」を実行してください。\n${e}`])
      setRunStatus('error')
    }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function handleEdit(rowIndex: number, key: SortKey, value: string) {
    setEdits((prev) => ({ ...prev, [rowIndex]: { ...prev[rowIndex], [key]: value } }))
  }

  const stores = Array.from(new Set(rows.map((r) => r.store))).sort()
  const filtered = filterStore ? rows.filter((r) => r.store === filterStore) : rows
  const sorted = sortRows(filtered, sortKey, sortDir)
  const hasEdits = Object.keys(edits).length > 0

  const runBtnColor = runStatus === 'running' ? 'bg-yellow-600' : runStatus === 'success' ? 'bg-green-700' : runStatus === 'error' ? 'bg-red-700' : 'bg-emerald-600 hover:bg-emerald-500'
  const runBtnLabel = runStatus === 'running' ? '実行中...' : runStatus === 'success' ? '✓ 完了' : runStatus === 'error' ? '✗ エラー' : 'データ更新'

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="font-bold text-white text-lg">AI TOKYO GROUP</span>
          <span className="text-gray-400 text-sm ml-3">月次成績ダッシュボード</span>
        </div>
        <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
          ログアウト
        </button>
      </header>

      <main className="px-4 py-5 max-w-[1900px] mx-auto">
        {/* コントロールバー */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">対象月</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">店舗</label>
            <select value={filterStore} onChange={(e) => setFilterStore(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">全店舗</option>
              {stores.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* 編集・保存ボタン */}
            {!editMode ? (
              <button onClick={() => setEditMode(true)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
                ✏️ 手動入力
              </button>
            ) : (
              <>
                <button onClick={() => { setEditMode(false); setEdits({}) }}
                  className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors">
                  キャンセル
                </button>
                <button onClick={handleSave} disabled={!hasEdits || saveStatus === 'saving'}
                  className={`px-4 py-1.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50
                    ${saveStatus === 'saved' ? 'bg-green-700' : saveStatus === 'error' ? 'bg-red-700' : 'bg-blue-600 hover:bg-blue-500'}`}>
                  {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '✓ 保存完了' : 'スプレッドシートに保存'}
                </button>
              </>
            )}

            {/* データ更新ボタン */}
            <input type="text" placeholder="月 例:202506" value={runMonth} onChange={(e) => setRunMonth(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600" />
            <button onClick={handleRun} disabled={runStatus === 'running'}
              className={`px-4 py-1.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-60 ${runBtnColor}`}>
              {runBtnLabel}
            </button>
            {runStatus !== 'idle' && (
              <button onClick={() => setShowLog((v) => !v)} className="text-gray-400 hover:text-white text-xs px-2 py-1.5 rounded hover:bg-gray-700">
                {showLog ? 'ログ非表示' : 'ログ'}
              </button>
            )}
          </div>

          {!loading && rows.length > 0 && (
            <span className="text-gray-500 text-sm">{sorted.length}名 表示</span>
          )}
        </div>

        {/* ログパネル */}
        {showLog && runLog.length > 0 && (
          <div className="mb-4 bg-gray-900 border border-gray-700 rounded-xl p-4 max-h-48 overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400 font-mono">実行ログ</span>
              {runStatus === 'running' && <span className="text-yellow-400 text-xs animate-pulse">● 実行中</span>}
              {runStatus === 'success' && <span className="text-green-400 text-xs">● 完了</span>}
              {runStatus === 'error'   && <span className="text-red-400 text-xs">● エラー</span>}
            </div>
            {runLog.map((line, i) => (
              <div key={i} className="text-xs font-mono text-gray-300 leading-5 whitespace-pre-wrap">{line}</div>
            ))}
          </div>
        )}

        {editMode && (
          <div className="mb-3 text-sm text-indigo-300 bg-indigo-900/20 border border-indigo-800 rounded-lg px-4 py-2">
            ✏️ 手動入力モード — 新規指名数・新規フリー数・スタイル投稿数・ブログ投稿数 を編集できます。入力後「スプレッドシートに保存」を押してください。
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
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
            <table className="w-full text-sm border-collapse" style={{ minWidth: '2000px' }}>
              <thead>
                <tr className="bg-gray-800 text-gray-300 text-xs uppercase tracking-wide">
                  {COLUMNS.map((col) => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      className={`px-3 py-3 text-left cursor-pointer select-none hover:text-white whitespace-nowrap border-b border-gray-700 transition-colors
                        ${MANUAL_KEYS.includes(col.key) && editMode ? 'text-indigo-300' : ''}`}>
                      {col.label}
                      {sortKey === col.key && <span className="ml-1 text-indigo-400">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-gray-500">データがありません</td></tr>
                ) : (
                  sorted.map((row, i) => {
                    const patch = edits[row._rowIndex] ?? {}
                    return (
                      <tr key={`${row.store}-${row.name}-${i}`} className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
                        {COLUMNS.map((col) => {
                          const isManual = MANUAL_KEYS.includes(col.key)
                          const rawVal = patch[col.key] !== undefined ? patch[col.key] : row[col.key]
                          const display = col.format ? col.format({ ...row, ...patch } as StaffRow) : String(rawVal ?? '')
                          const isDash = display === '-' || display === ''
                          const isHighSales = col.key === 'totalSales' && (row.totalSales) >= 3_000_000

                          if (isManual && editMode) {
                            return (
                              <td key={col.key} className="px-2 py-1.5">
                                <input
                                  type="text"
                                  value={String(patch[col.key] ?? row[col.key] ?? '')}
                                  onChange={(e) => handleEdit(row._rowIndex, col.key, e.target.value)}
                                  className="w-full bg-gray-700 border border-indigo-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                  placeholder="未入力"
                                />
                              </td>
                            )
                          }

                          return (
                            <td key={col.key} className={[
                              'px-3 py-2.5 whitespace-nowrap',
                              isDash ? 'text-gray-600' : '',
                              isHighSales ? 'text-yellow-400 font-semibold' : '',
                              col.key === 'store' ? 'text-gray-400' : '',
                              col.key === 'name' ? 'font-medium text-white' : '',
                              isManual && !editMode ? 'text-gray-500' : '',
                            ].filter(Boolean).join(' ')}>
                              {display || (isManual ? '—' : display)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
