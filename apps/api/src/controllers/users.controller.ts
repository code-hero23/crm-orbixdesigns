import prisma from '../lib/prisma.js';
import type { Request, Response } from 'express';
import { asyncHandler, apiResponse } from '../utils/apiUtils.js';


export const getUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    include: {
      showroom: true,
      signaturePhoto: true,
      businessHead: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  apiResponse.success(res, users);
});

export const createUser = asyncHandler(async (req, res) => {
  const { username, fullName, email, phone, role, showroomId, signaturePhotoId, businessHeadId, status } = req.body;
  
  if (!username || !email || !fullName) {
    return apiResponse.error(res, 'Username, Email, and Full Name are required', 400);
  }

  // Sanitize empty strings to null for optional relations
  const data = {
    username: String(username),
    fullName: String(fullName),
    email: String(email),
    phone: phone ? String(phone) : null,
    role: role || 'CRE',
    status: status !== undefined ? Boolean(status) : true,
    showroomId: showroomId && showroomId !== '' ? String(showroomId) : null,
    signaturePhotoId: signaturePhotoId && signaturePhotoId !== '' ? String(signaturePhotoId) : null,
    businessHeadId: businessHeadId && businessHeadId !== '' ? String(businessHeadId) : null,
  };

  try {
    const user = await prisma.user.create({
      data,
      include: { showroom: true, signaturePhoto: true, businessHead: true }
    });
    apiResponse.success(res, user, 'User created successfully', 201);
  } catch (error: any) {
    console.error('❌ Prisma Create User Error:', error);
    if (error.code === 'P2002') {
      return apiResponse.error(res, 'Username or Email already exists', 400);
    }
    return apiResponse.error(res, error.message || 'Failed to create user', 500, error);
  }
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowedFields = ['username', 'fullName', 'email', 'phone', 'role', 'showroomId', 'signaturePhotoId', 'businessHeadId', 'status'];
  
  console.log('Updating user:', id, 'Body:', req.body);
  
  const updateData: any = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      // Convert empty strings to null for relation IDs
      if (['showroomId', 'signaturePhotoId', 'businessHeadId'].includes(field) && req.body[field] === '') {
        updateData[field] = null;
      } else {
        updateData[field] = req.body[field];
      }
    }
  });

  console.log('Filtered update data:', updateData);

  try {
    const updated = await prisma.user.update({
      where: { id: String(id) },
      data: updateData,
      include: { showroom: true, signaturePhoto: true, businessHead: true }
    });
    apiResponse.success(res, updated, 'User updated successfully');
  } catch (error: any) {
    console.error('❌ Prisma Update User Error:', error);
    if (error.code === 'P2002') {
      return apiResponse.error(res, 'Username or Email already exists', 400);
    }
    return apiResponse.error(res, error.message || 'Failed to update user', 500, error);
  }
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({ where: { id: String(id) } });
  apiResponse.success(res, null, 'User deleted successfully', 204);
});
