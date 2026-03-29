// src/services/emailTemplate.js

const buildHtmlEmail = ({
  businessName = 'Business Owner',
  subject      = 'Exclusive Hosting Offer from DevExHost',
  bodyText     = '',
  ctaText      = 'START NOW',
  ctaLink      = 'https://devexhost.com',
  trackingId   = '',
  campaignType = 'free_domain',
  unsubLink    = '',
}) => {
  const trackingPixel = trackingId
    ? `<img src="${process.env.TRACKING_URL || 'https://devexhost.com'}/track/${trackingId}" width="1" height="1" style="display:none;" />`
    : '';

  const ctaColors = {
    free_domain:  '#16a34a',
    free_hosting: '#2563eb',
    vps_speed:    '#7c3aed',
    reseller:     '#d97706',
    discount:     '#dc2626',
  };
  const btnColor = ctaColors[campaignType] || '#16a34a';

  // Convert plain text body to HTML paragraphs
  const bodyHtml = bodyText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p style="margin:0 0 16px 0;line-height:1.7;color:#374151;">${line}</p>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:30px 0;">
    <tr><td align="center">

      <!-- Email Container -->
      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px 40px;text-align:center;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="text-align:center;">
                  <div style="display:inline-block;background:#16a34a;color:white;font-size:22px;font-weight:800;
                              letter-spacing:1px;padding:8px 20px;border-radius:8px;">
                    DevEx<span style="color:#86efac;">Host</span>
                  </div>
                  <p style="color:#94a3b8;font-size:12px;margin:10px 0 0 0;letter-spacing:2px;text-transform:uppercase;">
                    Bangladesh's Premium Web Hosting
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── OFFER BANNER ── -->
        <tr>
          <td style="background:${btnColor};padding:14px 40px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.5px;">
              ${getCampaignBannerText(campaignType)}
            </p>
          </td>
        </tr>

        <!-- ── BODY ── -->
        <tr>
          <td style="padding:36px 40px;">

            <!-- Greeting -->
            <p style="margin:0 0 20px 0;font-size:17px;font-weight:600;color:#111827;">
              Hello, ${businessName}! 👋
            </p>

            <!-- AI-generated body -->
            ${bodyHtml}

            <!-- ── CTA BUTTON ── -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding:24px 0 8px 0;">
                  <a href="${ctaLink}?utm_source=email&utm_campaign=${campaignType}&utm_content=${ctaText.replace(/ /g,'_')}"
                     style="background:${btnColor};
                            color:white;
                            padding:15px 36px;
                            border-radius:8px;
                            text-decoration:none;
                            font-weight:700;
                            font-size:16px;
                            display:inline-block;
                            letter-spacing:0.5px;
                            box-shadow:0 4px 12px rgba(0,0,0,0.2);">
                    ${ctaText} →
                  </a>
                </td>
              </tr>
            </table>

            <p style="text-align:center;margin:16px 0 0 0;color:#6b7280;font-size:12px;">
              🔒 No commitment. Cancel anytime. Secure checkout.
            </p>

          </td>
        </tr>

        <!-- ── FEATURES ROW ── -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="33%" style="text-align:center;padding:8px;">
                  <div style="font-size:24px;">⚡</div>
                  <div style="font-size:12px;font-weight:600;color:#374151;margin-top:4px;">99.9% Uptime</div>
                </td>
                <td width="33%" style="text-align:center;padding:8px;">
                  <div style="font-size:24px;">🔒</div>
                  <div style="font-size:12px;font-weight:600;color:#374151;margin-top:4px;">Free SSL</div>
                </td>
                <td width="33%" style="text-align:center;padding:8px;">
                  <div style="font-size:24px;">🇧🇩</div>
                  <div style="font-size:12px;font-weight:600;color:#374151;margin-top:4px;">BD Support 24/7</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#0f172a;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 8px 0;color:#94a3b8;font-size:13px;">
              DevExHost | Dhaka, Bangladesh
            </p>
            <p style="margin:0 0 12px 0;">
              <a href="https://devexhost.com" style="color:#86efac;text-decoration:none;font-size:13px;">devexhost.com</a>
              &nbsp;|&nbsp;
              <a href="mailto:support@devexhost.com" style="color:#94a3b8;text-decoration:none;font-size:13px;">support@devexhost.com</a>
            </p>
            ${unsubLink ? `
            <p style="margin:0;">
              <a href="${unsubLink}" style="color:#6b7280;font-size:11px;text-decoration:underline;">
                Unsubscribe from future emails
              </a>
            </p>` : ''}
            <p style="margin:8px 0 0 0;color:#374151;font-size:11px;">
              © ${new Date().getFullYear()} DevExHost. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
      <!-- End Container -->

    </td></tr>
  </table>

  ${trackingPixel}
</body>
</html>`;
};

const getCampaignBannerText = (type) => {
  const banners = {
    free_domain:  '🎁 FREE .com.bd Domain — Limited Time Offer!',
    free_hosting: '🚀 30 Days FREE Hosting — No Credit Card Required!',
    vps_speed:    '⚡ Blazing VPS Hosting Starting at ৳999/month!',
    reseller:     '💼 Start Your Hosting Business Today!',
    discount:     '🔥 50% OFF All Hosting Plans — This Week Only!',
  };
  return banners[type] || '🌐 Premium Hosting for Bangladesh Businesses!';
};

// Plain text fallback
const buildPlainTextEmail = ({ businessName, bodyText, ctaText, ctaLink }) => {
  return `Hello ${businessName},

${bodyText}

👉 ${ctaText}: ${ctaLink}

---
DevExHost | Dhaka, Bangladesh
devexhost.com | support@devexhost.com
© ${new Date().getFullYear()} DevExHost. All rights reserved.
`;
};

module.exports = { buildHtmlEmail, buildPlainTextEmail };
