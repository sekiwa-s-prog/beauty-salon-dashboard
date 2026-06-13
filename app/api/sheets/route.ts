import { NextRequest, NextResponse } from 'next/server'
import { getAvailableMonths, getMonthData, saveManualFields, ManualUpdate } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const month = searchParams.get('month')

    if (!month) {
      const months = await getAvailableMonths()
      return NextResponse.json({ months })
    }

    const data = await getMonthData(month)
    return NextResponse.json({ data })
  } catch (err) {
    console.error('Sheets GET error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { month, updates } = await req.json() as { month: string; updates: ManualUpdate[] }
    if (!month || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'month と updates が必要です' }, { status: 400 })
    }
    await saveManualFields(month, updates)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Sheets POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
