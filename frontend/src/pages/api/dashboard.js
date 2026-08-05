import prisma from '@/lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Fetch latest summary (assuming the last row has the most recent totals)
    const summary = await prisma.dashboard_summary.findFirst({
      orderBy: { row_number: 'desc' }
    });

    // Fetch 5 most recent cash inflows for the recent activity feed
    const recentInflows = await prisma.cash_inflows.findMany({
      take: 5,
      orderBy: { row_number: 'desc' }
    });

    res.status(200).json({
      summary,
      recentInflows
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    res.status(500).json({ message: 'Error fetching dashboard data' });
  }
}
