import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, apiResponse } from '../utils/apiUtils.js';

const prisma = new PrismaClient();

const normalizePhone = (phone: string): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Take last 10 digits (standard Indian mobile format)
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
};


export const getLeads = asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 10, 
    statusIds, // Array
    projectIds, // Array
    sourceIds, // Array
    brandIds, // Array
    stageIds, // Array
    assignedToIds, // Array
    tagId,
    rating,
    timeframe, // 'today', 'tomorrow', 'week', 'month'
    fromDate,
    toDate,
    search 
  } = req.body;
  const skip = (Number(page) - 1) * Number(limit);
  
  const where: any = {};
  
  if (statusIds && Array.isArray(statusIds) && statusIds.length > 0) where.statusId = { in: statusIds };
  else if (req.body.statusId) where.statusId = req.body.statusId;

  if (projectIds && Array.isArray(projectIds) && projectIds.length > 0) where.projectId = { in: projectIds };
  else if (req.body.projectId) where.projectId = req.body.projectId;

  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) where.sourceId = { in: sourceIds };
  else if (req.body.sourceId) where.sourceId = req.body.sourceId;

  if (brandIds && Array.isArray(brandIds) && brandIds.length > 0) where.brandId = { in: brandIds };
  else if (req.body.brandId) where.brandId = req.body.brandId;

  if (stageIds && Array.isArray(stageIds) && stageIds.length > 0) where.currentStageId = { in: stageIds };

  if (assignedToIds && Array.isArray(assignedToIds) && assignedToIds.length > 0) where.assignedToId = { in: assignedToIds };

  if (rating) where.rating = Number(rating);
  if (tagId) {
    where.tags = { some: { id: tagId } };
  }
  
  // Explicit Date Range
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }
  
  if (timeframe) {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    if (timeframe === 'today') {
      where.contactableDate = { gte: startOfDay, lte: endOfDay };
    } else if (timeframe === 'tomorrow') {
      const tomorrowStart = new Date(startOfDay);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const tomorrowEnd = new Date(endOfDay);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
      where.contactableDate = { gte: tomorrowStart, lte: tomorrowEnd };
    } else if (timeframe === 'week') {
      const weekEnd = new Date(startOfDay);
      weekEnd.setDate(weekEnd.getDate() + 7);
      where.contactableDate = { gte: startOfDay, lte: weekEnd };
    } else if (timeframe === 'month') {
      const monthEnd = new Date(startOfDay);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      where.contactableDate = { gte: startOfDay, lte: monthEnd };
    }
  }
  
  if (search) {
    const searchConditions: any[] = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
    
    // Also search by numeric leadId if the search term is a valid number
    if (!isNaN(Number(search)) && search.trim() !== '') {
      searchConditions.push({ leadId: Number(search) });
    }

    where.OR = searchConditions;
  }

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: Number(limit),
      include: {
        status: true,
        project: true,
        source: true,
        brand: true,
        tags: true,
        currentStage: true,
        assignedTo: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lead.count({ where }),
  ]);

  apiResponse.success(res, {
    data: data.map((l: any) => ({
        ...l,
        brand_name: l.brand?.name || '-',
        status_name: l.status?.name || '-',
    })),
    total,
    page: Number(page),
    limit: Number(limit)
  });
});

export const getContactableCounts = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.query;
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const tomorrowStart = new Date(startOfDay);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(endOfDay);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const weekEnd = new Date(startOfDay);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthEnd = new Date(startOfDay);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const filter: any = {};
    if (userId) filter.assignedToId = String(userId);

    const [uptoToday, today, tomorrow, week, month] = await Promise.all([
        prisma.lead.count({ where: { ...filter, contactableDate: { lte: endOfDay } } }),
        prisma.lead.count({ where: { ...filter, contactableDate: { gte: startOfDay, lte: endOfDay } } }),
        prisma.lead.count({ where: { ...filter, contactableDate: { gte: tomorrowStart, lte: tomorrowEnd } } }),
        prisma.lead.count({ where: { ...filter, contactableDate: { gte: startOfDay, lte: weekEnd } } }),
        prisma.lead.count({ where: { ...filter, contactableDate: { gte: startOfDay, lte: monthEnd } } }),
    ]);

    apiResponse.success(res, { uptoToday, today, tomorrow, week, month });
});

export const createLead = asyncHandler(async (req: Request, res: Response) => {
  const { 
      name, phone, projectId, sourceId, statusId, 
      brandId, rating, nextFollowUp, tagIds, 
      comments, createdById, instructionToPass,
      dataCollected, contactableDate
  } = req.body;

  if (!name || !phone) {
      return apiResponse.error(res, 'Name and phone are required', 400);
  }

  const normalizedPhone = normalizePhone(phone);

  // Check for duplicate lead
  const existingLead = await prisma.lead.findFirst({
    where: {
      phone: {
        contains: normalizedPhone
      }
    },
    select: { id: true, leadId: true, name: true }
  });

  if (existingLead) {
    return apiResponse.error(res, `A lead with this phone number already exists: ${existingLead.name} (Lead ID: ${existingLead.leadId})`, 409);
  }

  
  const allowedFields = [
    'name', 'email', 'phone', 'projectId', 'sourceId', 'statusId', 
    'brandId', 'rating', 'nextFollowUp', 'comments', 'createdById', 
    'instructionToPass', 'dataCollected', 'contactableDate', 'leadType'
  ];
  
  const data: any = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      if (['projectId', 'sourceId', 'statusId', 'brandId'].includes(field) && req.body[field] === '') {
        data[field] = null;
      } else if (['nextFollowUp', 'dataCollected', 'contactableDate'].includes(field)) {
        data[field] = req.body[field] ? new Date(String(req.body[field])) : (field === 'dataCollected' ? new Date() : null);
      } else if (field === 'rating') {
        data[field] = Number(req.body[field]);
      } else if (field === 'phone') {
        data[field] = normalizedPhone;
      } else {
        data[field] = req.body[field];
      }
    }
  });

  if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
    data.tags = { 
      connect: tagIds.map((id: string) => ({ id: String(id) })) 
    };
  }
  
  // If no createdById, find first admin or use a system placeholder
  if (!data.createdById) {
      const firstAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      data.createdById = firstAdmin?.id || 'system';
  }

  const lead = await prisma.lead.create({ 
      data,
      include: { status: true, brand: true, project: true, source: true }
  });

  // Log Initial Contact Activity
  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: 'SYSTEM',
      content: `Lead initialized via ${lead.source?.name || 'Direct Source'}`,
      userId: createdById || null
    }
  });

  if (comments) {
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'NOTE',
        content: comments,
        userId: createdById || null
      }
    });
  }

  apiResponse.success(res, lead, 'Lead created successfully', 201);
});

export const getAllActivities = asyncHandler(async (req: Request, res: Response) => {
    const { from_date, to_date, activity_type, lead_status_id } = req.body;
    
    const where: any = {};
    
    if (from_date || to_date) {
        where.createdAt = {};
        if (from_date) where.createdAt.gte = new Date(String(from_date));
        if (to_date) where.createdAt.lte = new Date(String(to_date));
    }
    
    if (activity_type) {
        where.type = activity_type;
    }
    
    if (lead_status_id) {
        where.lead = {
            statusId: lead_status_id
        };
    }
    
    const activities = await prisma.leadActivity.findMany({
        where,
        include: {
            lead: {
                select: {
                    id: true,
                    name: true,
                    status: true
                }
            },
            user: {
                select: {
                    id: true,
                    fullName: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 100 // Limit to last 100 activities for performance
    });
    
    apiResponse.success(res, activities);
});

export const updateLead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tagIds } = req.body;
  const allowedFields = [
    'name', 'email', 'phone', 'projectId', 'sourceId', 'statusId', 
    'brandId', 'rating', 'nextFollowUp', 'comments', 'assignedToId',
    'instructionToPass', 'dataCollected', 'contactableDate', 'leadType'
  ];

  const data: any = {};
  
  if (req.body.phone) {
    const normalizedPhone = normalizePhone(req.body.phone);
    const duplicate = await prisma.lead.findFirst({
      where: {
        phone: { contains: normalizedPhone },
        NOT: { id: String(id) }
      }
    });
    if (duplicate) {
      return apiResponse.error(res, `Another lead already exists with this phone number: ${duplicate.name}`, 409);
    }
    data.phone = normalizedPhone;
  }

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'phone') return; // Handled above
      if (['projectId', 'sourceId', 'statusId', 'brandId', 'assignedToId'].includes(field) && req.body[field] === '') {
        data[field] = null;
      } else if (['nextFollowUp', 'dataCollected', 'contactableDate'].includes(field)) {
        data[field] = req.body[field] ? new Date(String(req.body[field])) : (field === 'dataCollected' ? undefined : null);
      } else if (field === 'rating') {
        data[field] = Number(req.body[field]);
      } else {
        data[field] = req.body[field];
      }
    }
  });

  // Fetch existing lead to handle comments preservation
  const existingLead = await prisma.lead.findUnique({
    where: { id: String(id) },
    select: { comments: true }
  });

  if (req.body.comments !== undefined && req.body.comments !== existingLead?.comments) {
    if (existingLead?.comments && !req.body.comments.includes(existingLead.comments)) {
      data.comments = `${existingLead.comments} / ${req.body.comments}`;
    } else {
      data.comments = req.body.comments;
    }
    
    // Log new comment as a NOTE activity
    const newPart = existingLead?.comments && data.comments.startsWith(existingLead.comments) 
        ? data.comments.replace(existingLead.comments, '').replace(/^ \/ /, '')
        : data.comments;

    if (newPart.trim()) {
        await prisma.leadActivity.create({
            data: {
                leadId: String(id),
                type: 'NOTE',
                content: `Added comment: ${newPart}`,
                userId: req.body.userId || null
            }
        });
    }
  }

  const updated = await prisma.lead.update({
    where: { id: String(id) },
    data: {
        ...data,
        tags: tagIds && Array.isArray(tagIds) ? { 
            set: tagIds.map((tid: string) => ({ id: String(tid) })) 
        } : undefined,
    },
    include: { tags: true, brand: true, status: true, project: true }
  });

  // Log Status Change or Update
  await prisma.leadActivity.create({
    data: {
      leadId: updated.id,
      type: data.statusId ? 'STATUS_CHANGE' : 'SYSTEM',
      content: data.statusId 
        ? `Status transitioned to ${updated.status?.name || 'New Status'}`
        : `Lead details refined`,
      userId: req.body.userId || null
    }
  });

  apiResponse.success(res, updated, 'Lead updated successfully');
});

export const assignLead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user_id } = req.body;
  const updated = await prisma.lead.update({
    where: { id: String(id) },
    data: { assignedToId: user_id ? String(user_id) : null },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: updated.id,
      type: 'ASSIGNMENT',
      content: user_id ? `Assigned to user ID: ${user_id}` : `Lead unassigned`,
      userId: null // System action
    }
  });

  apiResponse.success(res, updated, 'Lead assigned successfully');
});

export const addActivity = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, content, userId } = req.body;
  const activity = await prisma.leadActivity.create({
    data: {
      leadId: String(id),
      type: type || 'NOTE',
      content: String(content),
      userId: userId || null
    },
    include: { user: true }
  });
  apiResponse.success(res, activity, 'Activity added successfully', 201);
});

export const getLead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const lead = await prisma.lead.findUnique({
    where: { id: String(id) },
    include: {
      status: true,
      project: true,
      source: true,
      brand: true,
      tags: true,
      currentStage: true,
      assignedTo: true,
      createdBy: true,
      tasks: { orderBy: { createdAt: 'desc' } },
      appointments: { orderBy: { createdAt: 'desc' } },
      showroomVisits: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { createdAt: 'desc' }, include: { user: true } },
    },
  });

  if (!lead) {
    return apiResponse.error(res, 'Lead not found', 404);
  }

  apiResponse.success(res, lead);
});

export const bulkAssignLeads = asyncHandler(async (req: Request, res: Response) => {
  const { leadIds, userId } = req.body;
  
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return apiResponse.error(res, 'Lead IDs are required', 400);
  }

  await prisma.lead.updateMany({
    where: { id: { in: leadIds.map(id => String(id)) } },
    data: { assignedToId: userId ? String(userId) : null },
  });

  // Create activities for each lead
  const activities = leadIds.map(id => ({
    leadId: String(id),
    type: 'ASSIGNMENT',
    content: userId ? `Bulk assigned to user ID: ${userId}` : `Bulk unassigned`,
  }));

  await prisma.leadActivity.createMany({ data: activities });

  apiResponse.success(res, null, `Successfully assigned ${leadIds.length} leads`);
});
