import { NextRequest, NextResponse } from 'next/server'
import { getAvailableMonths, getMonthData } from '@/lib/sheets'

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
    console.error('Sheets API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
