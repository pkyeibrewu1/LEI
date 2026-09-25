function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return jsonResponse({}, 204);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const { phone } = await request.json();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return jsonResponse({ error: 'Enter a valid mobile number.' }, 400);
    }

    if (process.env.ALLOW_DEVELOPER_BYPASS === 'true' && process.env.DEVELOPER_BYPASS_CODE) {
      return jsonResponse({ sent: true, developerBypass: true });
    }

    const credentials = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const body = new URLSearchParams({
      To: phone,
      Channel: 'sms'
    });
    const response = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    if (!response.ok) {
      const error = await response.json();
      return jsonResponse({ error: error.message || 'Twilio could not send the code.' }, response.status);
    }

    return jsonResponse({ sent: true });
  } catch {
    return jsonResponse({ error: 'Unable to send the verification code.' }, 500);
  }
}