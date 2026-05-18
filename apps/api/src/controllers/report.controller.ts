import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, apiResponse } from '../utils/apiUtils.js';

const prisma = new PrismaClient();

export const getUserPerformance = asyncHandler(async (req: Request, res: Response) => {
  // Fetch all active users (you can filter by role if needed)
  const users = await prisma.user.findMany({
    where: { status: true },
    select: { id: true, fullName: true, role: true }
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);

  const reportData = await Promise.all(users.map(async (user) => {
    // 1. CALLS
    const calls = await prisma.leadActivity.count({
      where: {
        userId: user.id,
        OR: [
          { type: { contains: 'call', mode: 'insensitive' } },
          { content: { contains: 'call', mode: 'insensitive' } }
        ]
      }
    });

    // 2. PRP (Proposals)
    const prp = await prisma.leadActivity.count({
      where: {
        userId: user.id,
        OR: [
          { type: { contains: 'proposal', mode: 'insensitive' } },
          { content: { contains: 'proposal', mode: 'insensitive' } }
        ]
      }
    });

    // 3. MSMT (Measurement)
    const msmt = await prisma.leadActivity.count({
      where: {
        userId: user.id,
        OR: [
          { type: { contains: 'measurement', mode: 'insensitive' } },
          { content: { contains: 'measurement', mode: 'insensitive' } }
        ]
      }
    });

    // 4. SRV (Showroom Visits)
    // Could be based on showroomVisits assigned to the lead the user owns, or visits created by user.
    // Since showroomVisit doesn't have userId directly, we check visits for leads assigned to the user.
    const srv = await prisma.showroomVisit.count({
      where: {
        lead: {
          assignedToId: user.id
        }
      }
    });

    // 5. ORDERS (Order Booked)
    const orders = await prisma.lead.count({
      where: {
        assignedToId: user.id,
        status: { name: 'Order Booked' }
      }
    });

    // Helper to get ratings for a specific timeframe
    const getRatingsForTimeframe = async (startDate: Date) => {
      const leads = await prisma.lead.findMany({
        where: {
          assignedToId: user.id,
          createdAt: { gte: startDate },
          rating: { gte: 5, lte: 9 }
        },
        select: { rating: true }
      });

      const counts = { '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, 'total': leads.length };
      leads.forEach(l => {
        if (l.rating >= 5 && l.rating <= 9) {
          counts[l.rating.toString() as keyof typeof counts]++;
        }
      });
      return counts;
    };

    const upToDay = await getRatingsForTimeframe(todayStart);
    const thisWeek = await getRatingsForTimeframe(weekStart);

    return {
      userId: user.id,
      name: user.fullName,
      role: user.role,
      calls,
      upToDay,
      thisWeek,
      prp,
      srv,
      msmt,
      orders
    };
  }));

  // Sort by name or role if needed
  reportData.sort((a, b) => a.name.localeCompare(b.name));

  return apiResponse.success(res, reportData, 'Performance report generated successfully');
});
