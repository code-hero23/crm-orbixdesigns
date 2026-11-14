import crypto from 'crypto';

interface UserData {
  email?: string | null | undefined;
  phone?: string | null | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  clientIpAddress?: string | null | undefined;
  clientUserAgent?: string | null | undefined;
  fbc?: string | null | undefined;
  fbp?: string | null | undefined;
}

interface CustomData {
  currency?: string;
  value?: number;
  content_name?: string;
  content_category?: string;
  status?: string;
  [key: string]: any;
}

interface MetaEventParams {
  eventName: string;
  eventId?: string;
  eventSourceUrl?: string;
  userData: UserData;
  customData?: CustomData;
  actionSource?: 'website' | 'system_generated' | 'other';
}

/**
 * Normalizes and hashes strings using SHA-256 (as required by Meta CAPI)
 */
const sha256 = (val: string): string => {
  return crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex');
};

const normalizePhone = (phone: string): string => {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // If 10 digits (India format), prefix with country code 91
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

export const sendMetaConversionEvent = async (params: MetaEventParams) => {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  const testEventCode = process.env.META_TEST_EVENT_CODE;

  if (!pixelId || !accessToken) {
    console.warn('⚠️ [Meta CAPI] Skipping event: META_PIXEL_ID or META_ACCESS_TOKEN is missing.');
    return null;
  }

  try {
    // 1. Build and hash user data
    const userDataPayload: Record<string, any> = {};

    if (params.userData.email) {
      userDataPayload.em = [sha256(params.userData.email)];
    }

    if (params.userData.phone) {
      userDataPayload.ph = [sha256(normalizePhone(params.userData.phone))];
    }

    if (params.userData.firstName) {
      userDataPayload.fn = [sha256(params.userData.firstName)];
    }

    if (params.userData.lastName) {
      userDataPayload.ln = [sha256(params.userData.lastName)];
    }

    if (params.userData.clientIpAddress) {
      userDataPayload.client_ip_address = params.userData.clientIpAddress;
    }

    if (params.userData.clientUserAgent) {
      userDataPayload.client_user_agent = params.userData.clientUserAgent;
    }

    if (params.userData.fbc) {
      userDataPayload.fbc = params.userData.fbc;
    }

    if (params.userData.fbp) {
      userDataPayload.fbp = params.userData.fbp;
    }

    // 2. Build event payload
    const eventData: Record<string, any> = {
      event_name: params.eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: params.actionSource || 'system_generated',
      user_data: userDataPayload,
    };

    if (params.eventId) {
      eventData.event_id = params.eventId;
    }

    if (params.eventSourceUrl) {
      eventData.event_source_url = params.eventSourceUrl;
    }

    if (params.customData) {
      eventData.custom_data = params.customData;
    }

    const payload: Record<string, any> = {
      data: [eventData],
    };

    if (testEventCode) {
      payload.test_event_code = testEventCode;
    }

    const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ [Meta CAPI Error]', JSON.stringify(result));
    } else {
      console.log(`✅ [Meta CAPI] Dispatched "${params.eventName}" event successfully:`, result);
    }

    return result;
  } catch (error) {
    console.error('❌ [Meta CAPI Exception]:', error);
    return null;
  }
};

