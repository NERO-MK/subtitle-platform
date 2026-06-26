import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    hasKey: !!process.env.OPENROUTER_API_KEY,
    keyPrefix: process.env.OPENROUTER_API_KEY?.slice(0, 8) || 'NOT FOUND'
  })
}
