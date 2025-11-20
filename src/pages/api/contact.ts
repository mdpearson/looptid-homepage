/**
 * Astro API endpoint to handle contact form submissions
 * 
 * This validates Turnstile captcha and sends email via MailChannels
 */

import type { APIRoute } from 'astro';

interface ContactFormData {
  name: string;
  email: string;
  organization?: string;
  message: string;
  'cf-turnstile-response': string;
}

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get environment variables from Cloudflare runtime
  const env = locals.runtime?.env as { TURNSTILE_SECRET_KEY?: string; CONTACT_EMAIL?: string };
  
  if (!env?.TURNSTILE_SECRET_KEY || !env?.CONTACT_EMAIL) {
    console.error('Missing environment variables');
    return new Response(JSON.stringify({ message: 'Server configuration error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Parse form data
  let formData: ContactFormData;
  try {
    formData = await request.json();
  } catch (error) {
    console.error('JSON parse error:', error);
    return new Response(JSON.stringify({ message: 'Invalid request format' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Validate required fields
  if (!formData.name || !formData.email || !formData.message || !formData['cf-turnstile-response']) {
    console.error('Missing required fields:', { 
      hasName: !!formData.name, 
      hasEmail: !!formData.email, 
      hasMessage: !!formData.message, 
      hasTurnstile: !!formData['cf-turnstile-response'] 
    });
    return new Response(JSON.stringify({ message: 'Missing required fields' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Verify Turnstile token
  const turnstileValid = await verifyTurnstile(
    formData['cf-turnstile-response'],
    env.TURNSTILE_SECRET_KEY,
    request.headers.get('CF-Connecting-IP') || ''
  );

  if (!turnstileValid) {
    console.error('Turnstile validation failed');
    return new Response(JSON.stringify({ message: 'Captcha verification failed' }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  // Send email
  try {
    await sendEmail(formData, env.CONTACT_EMAIL);
    
    return new Response(JSON.stringify({ message: 'Message sent successfully' }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Email sending failed:', error);
    return new Response(JSON.stringify({ message: 'Failed to send message' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

/**
 * Verify Cloudflare Turnstile token
 */
async function verifyTurnstile(
  token: string,
  secretKey: string,
  remoteIP: string
): Promise<boolean> {
  const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  
  const response = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: secretKey,
      response: token,
      remoteip: remoteIP,
    }),
  });

  const data = await response.json() as { success: boolean };
  return data.success === true;
}

/**
 * Send email using MailChannels
 */
async function sendEmail(formData: ContactFormData, recipientEmail: string): Promise<void> {
  const emailContent = `
Name: ${formData.name}
Email: ${formData.email}
${formData.organization ? `Organization: ${formData.organization}\n` : ''}
Message:
${formData.message}
  `.trim();

  const emailPayload = {
    personalizations: [
      {
        to: [{ email: recipientEmail }],
      },
    ],
    from: {
      email: 'noreply@looptid.io',
      name: 'Looptid Contact Form',
    },
    reply_to: {
      email: formData.email,
      name: formData.name,
    },
    subject: `Contact Form: ${formData.name}${formData.organization ? ' from ' + formData.organization : ''}`,
    content: [
      {
        type: 'text/plain',
        value: emailContent,
      },
    ],
  };

  console.log('Sending email with payload:', JSON.stringify(emailPayload, null, 2));

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('MailChannels API error:', response.status, errorText);
    throw new Error(`Failed to send email: ${response.status} - ${errorText}`);
  }
}
