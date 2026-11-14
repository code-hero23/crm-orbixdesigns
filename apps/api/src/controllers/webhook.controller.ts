import prisma from '../lib/prisma.js';
import type { Request, Response } from 'express';
import { asyncHandler, apiResponse } from '../utils/apiUtils.js';
import { sendMetaConversionEvent } from '../services/metaCapi.service.js';

const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
};

export const intakeWebhookLead = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};

  const getField = (keys: string[]) => {
    for (const k of Object.keys(body)) {
      const cleanKey = k.trim().toLowerCase().replace(/[\s_-]+/g, '');
      if (keys.includes(cleanKey) && body[k] !== undefined && body[k] !== null && String(body[k]).trim() !== '') {
        return body[k];
      }
    }
    return undefined;
  };

  const rawName = getField(['name', 'leadname', 'fullname', 'customername', 'first_name']);
  const rawPhone = getField(['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'phone_number']);

  if (!rawName || !rawPhone) {
    return apiResponse.error(res, 'Missing required fields: "name" and "phone" are required.', 400);
  }

  const name = String(rawName).trim();
  const phone = normalizePhone(String(rawPhone));

  if (!phone || phone.length < 10) {
    return apiResponse.error(res, 'Invalid phone number provided.', 400);
  }

  const email = getField(['email', 'emailaddress']) ? String(getField(['email', 'emailaddress'])).trim() : null;
  const rawBrand = getField(['brand', 'brandname']) || 'Cookscape';
  const rawSource = getField(['source', 'leadsource', 'platform']) || 'Meta Ads';
  const rawProject = getField(['project', 'projectname', 'service', 'category']) || 'Modular Kitchen';
  const campaignName = getField(['campaign', 'campaignname', 'ad_name', 'adname', 'form_name']);
  const rawComments = getField(['comments', 'notes', 'remarks', 'message', 'requirement']);
  const rawRating = getField(['rating', 'star', 'stars']);
  const rating = rawRating !== undefined && !isNaN(Number(rawRating)) ? Number(rawRating) : 6;

  let fullComments = rawComments ? String(rawComments).trim() : '';
  if (campaignName) {
    fullComments = fullComments 
      ? `Campaign: ${campaignName} | ${fullComments}`
      : `Generated via Meta Campaign: ${campaignName}`;
  }

  const source = await prisma.source.upsert({
    where: { name: String(rawSource).trim() },
    update: {},
    create: { name: String(rawSource).trim() },
  });

  let brand = await prisma.brand.findFirst({
    where: { name: { contains: String(rawBrand).trim(), mode: 'insensitive' } },
  });
  if (!brand) {
    brand = await prisma.brand.upsert({
      where: { name: String(rawBrand).trim() },
      update: {},
      create: { name: String(rawBrand).trim() },
    });
  }

  let project = await prisma.project.findFirst({
    where: { name: { contains: String(rawProject).trim(), mode: 'insensitive' } },
  });
  if (!project) {
    project = await prisma.project.upsert({
      where: { name: String(rawProject).trim() },
      update: {},
      create: { name: String(rawProject).trim() },
    });
  }

  let freshStatus = await prisma.leadStatus.findUnique({ where: { name: 'Fresh' } });
  if (!freshStatus) {
    freshStatus = await prisma.leadStatus.create({ data: { name: 'Fresh' } });
  }

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const createdById = adminUser?.id || 'webhook';

  const existingLead = await prisma.lead.findFirst({
    where: { phone: { contains: phone } },
  });

  let lead;
  let isNew = false;

  if (existingLead) {
    const updatedComments = fullComments
      ? (existingLead.comments ? `${existingLead.comments} \n[Webhook Update]: ${fullComments}` : fullComments)
      : existingLead.comments;

    lead = await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        name,
        email: email ?? existingLead.email,
        comments: updatedComments,
        sourceId: source.id,
        brandId: brand.id,
        projectId: project.id,
      },
      include: { status: true, brand: true, project: true, source: true },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'NOTE',
        content: `Lead re-engaged via Webhook (${rawSource}). ${fullComments}`,
        userId: null,
      },
    });
  } else {
    isNew = true;
    lead = await prisma.lead.create({
      data: {
        name,
        phone,
        email,
        brandId: brand.id,
        projectId: project.id,
        sourceId: source.id,
        statusId: freshStatus.id,
        rating,
        comments: fullComments,
        instructionToPass: `Follow up with ${name} regarding ${project.name} inquiry from ${rawSource}.`,
        createdById,
        dataCollected: new Date(),
        contactableDate: new Date(),
      },
      include: { status: true, brand: true, project: true, source: true },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'SYSTEM',
        content: `Lead ingested automatically via Webhook (${rawSource})`,
        userId: null,
      },
    });
  }

  // Trigger Meta CAPI Lead event in background
  sendMetaConversionEvent({
    eventName: 'Lead',
    eventId: lead.id,
    actionSource: 'system_generated',
    userData: {
      email: lead.email,
      phone: lead.phone,
      firstName: lead.name?.split(' ')[0] || lead.name,
      lastName: lead.name?.split(' ').slice(1).join(' ') || undefined,
    },
    customData: {
      content_name: lead.project?.name || 'Modular Kitchen',
      content_category: lead.brand?.name || 'Cookscape',
      status: 'Fresh',
    },
  }).catch((err) => console.error('Meta CAPI Lead event error on webhook:', err));

  apiResponse.success(
    res,
    {
      leadId: lead.leadId,
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      status: lead.status?.name,
      isNew,
    },
    isNew ? 'Lead created successfully' : 'Lead updated successfully',
    isNew ? 201 : 200
  );
});

