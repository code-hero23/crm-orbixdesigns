import prisma from '../lib/prisma.js';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler, apiResponse } from '../utils/apiUtils.js';


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
      // Today's leads: due today OR overdue (no future ones)
      where.contactableDate = { lte: endOfDay };
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
    } else if (timeframe === 'overdue') {
      where.contactableDate = { lt: startOfDay };
    }
  } else {
    // DEFAULT: When no timeframe filter is selected,
    // hide leads that are scheduled for a FUTURE date (rescheduled follow-ups).
    // Only show: leads with no contactableDate OR leads due today/earlier.
    const now = new Date();
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));
    where.OR = [
      { contactableDate: null },
      { contactableDate: { lte: endOfDay } },
    ];
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

    // If we already have an OR clause (from date filter), combine using AND
    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        { OR: searchConditions },
      ];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
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
        activities: { orderBy: { createdAt: 'desc' }, include: { user: true } },
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

export const bulkUploadLeads = asyncHandler(async (req: Request, res: Response) => {
  const { leads } = req.body;

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return apiResponse.error(res, 'No lead records found in upload', 400);
  }

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const createdById = (req as any).user?.id || adminUser?.id;
  if (!createdById) {
    return apiResponse.error(res, 'No admin user found to attribute uploaded leads', 400);
  }

  const [allStatuses, allBrands, allProjects, allSources, allShowrooms, allUsers] = await Promise.all([
    prisma.leadStatus.findMany(),
    prisma.brand.findMany(),
    prisma.project.findMany(),
    prisma.source.findMany(),
    prisma.showroom.findMany(),
    prisma.user.findMany(),
  ]);

  const normalizeStatusName = (raw: string): string => {
    const s = raw.trim().toLowerCase();
    if (s === 'fresh' || s === 'fresh leads' || s === 'fresh lead') return 'Fresh';
    if (s === 'yet to follow-up' || s === 'yet to followup' || s === 'yet to follow up') return 'Yet To Follow-up';
    if (s === 'follow-up' || s === 'follow-ups' || s === 'followup' || s === 'follow ups' || s === 'follow up') return 'Follow-up';
    if (s === 'opportunities' || s === 'opportunity') return 'Opportunities';
    if (s === 'order booked' || s === 'order book') return 'Order Booked';
    if (s === 'disqualified') return 'Disqualified';
    if (s === 'showroom visit' || s === 'showroom visits') return 'Showroom Visit';
    if (s === 'appointment fix' || s === 'appointment' || s === 'appointments') return 'Appointment Fix';
    return raw.trim() || 'Fresh';
  };

  let createdCount = 0;
  let updatedCount = 0;
  let visitsCreated = 0;
  let appointmentsCreated = 0;

  for (const row of leads) {
    const getField = (keys: string[]) => {
      for (const k of Object.keys(row)) {
        const cleanKey = k.trim().toLowerCase().replace(/[\s_-]+/g, '');
        if (keys.includes(cleanKey)) return row[k];
      }
      return undefined;
    };

    const rawName = getField(['name', 'leadname', 'customername', 'fullname']);
    const rawPhone = getField(['phone', 'phonenumber', 'mobile', 'contact']);
    if (!rawName || !rawPhone) continue;

    const name = String(rawName).trim();
    const phone = normalizePhone(String(rawPhone));
    if (!phone) continue;

    const email = getField(['email', 'emailaddress']) ? String(getField(['email', 'emailaddress'])).trim() : null;
    const rawStatus = String(getField(['status', 'leadstatus']) || 'Fresh');
    const canonicalStatusName = normalizeStatusName(rawStatus);

    let statusObj = allStatuses.find(s => s.name.toLowerCase() === canonicalStatusName.toLowerCase());
    if (!statusObj) {
      statusObj = await prisma.leadStatus.upsert({
        where: { name: canonicalStatusName },
        update: {},
        create: { name: canonicalStatusName },
      });
      allStatuses.push(statusObj);
    }

    const rawBrand = getField(['brand', 'brandname']);
    let brandObj = rawBrand
      ? allBrands.find(b => b.name.toLowerCase() === String(rawBrand).trim().toLowerCase())
      : allBrands[0];
    if (!brandObj && rawBrand) {
      brandObj = await prisma.brand.upsert({
        where: { name: String(rawBrand).trim() },
        update: {},
        create: { name: String(rawBrand).trim() },
      });
      allBrands.push(brandObj);
    }

    const rawProject = getField(['project', 'projectname']);
    let projectObj = rawProject
      ? allProjects.find(p => p.name.toLowerCase() === String(rawProject).trim().toLowerCase())
      : allProjects[0];
    if (!projectObj && rawProject) {
      projectObj = await prisma.project.upsert({
        where: { name: String(rawProject).trim() },
        update: {},
        create: { name: String(rawProject).trim() },
      });
      allProjects.push(projectObj);
    }

    const rawSource = getField(['source', 'leadsource', 'sourcename']);
    let sourceObj = rawSource
      ? allSources.find(s => s.name.toLowerCase() === String(rawSource).trim().toLowerCase())
      : allSources[0];
    if (!sourceObj && rawSource) {
      sourceObj = await prisma.source.upsert({
        where: { name: String(rawSource).trim() },
        update: {},
        create: { name: String(rawSource).trim() },
      });
      allSources.push(sourceObj);
    }

    const rawAssigned = getField(['assignedto', 'executive', 'cre', 'user']);
    const assignedUser = rawAssigned
      ? allUsers.find(
          u =>
            u.fullName.toLowerCase() === String(rawAssigned).trim().toLowerCase() ||
            u.username.toLowerCase() === String(rawAssigned).trim().toLowerCase() ||
            u.email.toLowerCase() === String(rawAssigned).trim().toLowerCase()
        )
      : undefined;

    const rawRating = getField(['rating', 'stars']);
    const rating = rawRating !== undefined && !isNaN(Number(rawRating)) ? Number(rawRating) : 4;
    const rawComments = getField(['comments', 'comment', 'command', 'commands', 'notes', 'remarks']);
    const comments = rawComments ? String(rawComments).trim() : null;
    const rawInstruction = getField(['instructiontopass', 'instruction', 'instructions', 'instructionstopass', 'passinstruction']);
    const instructionToPass = rawInstruction ? String(rawInstruction).trim() : comments;

    let lead = await prisma.lead.findFirst({ where: { phone: { contains: phone } } });
    if (lead) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          name,
          email: email ?? lead.email,
          statusId: statusObj.id,
          brandId: brandObj?.id ?? lead.brandId,
          projectId: projectObj?.id ?? lead.projectId,
          sourceId: sourceObj?.id ?? lead.sourceId,
          rating,
          comments: comments ?? lead.comments,
          instructionToPass: instructionToPass ?? lead.instructionToPass,
          assignedToId: assignedUser?.id ?? lead.assignedToId,
        },
      });
      if (comments) {
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'NOTE',
            content: comments,
            userId: createdById,
          },
        });
      }
      updatedCount++;
    } else {
      lead = await prisma.lead.create({
        data: {
          name,
          email,
          phone,
          statusId: statusObj.id,
          brandId: brandObj?.id ?? null,
          projectId: projectObj?.id ?? null,
          sourceId: sourceObj?.id ?? null,
          rating,
          comments,
          instructionToPass,
          assignedToId: assignedUser?.id ?? null,
          createdById,
        },
      });
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: 'SYSTEM',
          content: `Lead imported via Bulk File Upload (${canonicalStatusName})`,
          userId: createdById,
        },
      });
      if (comments) {
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'NOTE',
            content: comments,
            userId: createdById,
          },
        });
      }
      createdCount++;
    }

    const rawVisitDate = getField(['visitdate', 'showroomvisitdate']);
    const rawShowroom = getField(['showroom', 'showroomname']);
    if (canonicalStatusName === 'Showroom Visit' || rawVisitDate) {
      let showroomObj = rawShowroom
        ? allShowrooms.find(s => s.name.toLowerCase().includes(String(rawShowroom).trim().toLowerCase()))
        : allShowrooms[0];
      if (!showroomObj && allShowrooms.length > 0) {
        showroomObj = allShowrooms[0];
      }
      if (showroomObj) {
        const parsedVisitDate = rawVisitDate && !isNaN(Date.parse(String(rawVisitDate)))
          ? new Date(String(rawVisitDate))
          : new Date();
        await prisma.showroomVisit.create({
          data: {
            leadId: lead.id,
            showroomId: showroomObj.id,
            visitDate: parsedVisitDate,
            comments: comments || `Showroom visit at ${showroomObj.name}`,
          },
        });
        visitsCreated++;
      }
    }

    const rawAppointmentDate = getField(['appointmentdate', 'appointment']);
    const rawLocation = getField(['location', 'appointmentlocation']);
    if (canonicalStatusName === 'Appointment Fix' || rawAppointmentDate) {
      const parsedAppDate = rawAppointmentDate && !isNaN(Date.parse(String(rawAppointmentDate)))
        ? new Date(String(rawAppointmentDate))
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.appointment.create({
        data: {
          leadId: lead.id,
          appointmentDate: parsedAppDate,
          location: rawLocation ? String(rawLocation).trim() : (rawShowroom ? String(rawShowroom).trim() : 'Client Site / Showroom'),
          comments: comments || 'Appointment scheduled via Bulk Upload',
          status: 'Scheduled',
        },
      });
      appointmentsCreated++;
    }
  }

  apiResponse.success(
    res,
    { createdCount, updatedCount, visitsCreated, appointmentsCreated },
    `Imported ${createdCount} new leads (${updatedCount} updated, ${visitsCreated} showroom visits, ${appointmentsCreated} appointments)`
  );
});

export const deleteLead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (user?.role !== 'ADMIN') {
    return apiResponse.error(res, 'Access denied. Only administrators can delete leads.', 403);
  }

  const existingLead = await prisma.lead.findUnique({ where: { id: String(id) } });
  if (!existingLead) {
    return apiResponse.error(res, 'Lead not found', 404);
  }

  await prisma.$transaction([
    prisma.leadActivity.deleteMany({ where: { leadId: String(id) } }),
    prisma.task.deleteMany({ where: { leadId: String(id) } }),
    prisma.appointment.deleteMany({ where: { leadId: String(id) } }),
    prisma.showroomVisit.deleteMany({ where: { leadId: String(id) } }),
    prisma.lead.delete({ where: { id: String(id) } }),
  ]);

  apiResponse.success(res, null, 'Lead deleted successfully');
});

export const bulkDeleteLeads = asyncHandler(async (req: Request, res: Response) => {
  const { leadIds } = req.body;
  const user = (req as any).user;

  if (user?.role !== 'ADMIN') {
    return apiResponse.error(res, 'Access denied. Only administrators can delete leads.', 403);
  }

  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return apiResponse.error(res, 'Lead IDs are required', 400);
  }

  const stringIds = leadIds.map(id => String(id));

  await prisma.$transaction([
    prisma.leadActivity.deleteMany({ where: { leadId: { in: stringIds } } }),
    prisma.task.deleteMany({ where: { leadId: { in: stringIds } } }),
    prisma.appointment.deleteMany({ where: { leadId: { in: stringIds } } }),
    prisma.showroomVisit.deleteMany({ where: { leadId: { in: stringIds } } }),
    prisma.lead.deleteMany({ where: { id: { in: stringIds } } }),
  ]);

  apiResponse.success(res, null, `Successfully deleted ${leadIds.length} leads`);
});
