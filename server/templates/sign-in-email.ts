export function buildSignInEmail(signInLink: string, email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Sign in to Hooklab</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!-- Outer container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 0 24px 0;">
              <span style="font-size:22px;font-weight:700;letter-spacing:0.05em;color:#01189b;text-decoration:none;">HOOKLAB</span>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#ffffff;border:1px solid #dee0e2;border-radius:8px;">
                <tr>
                  <td style="padding:40px 40px 32px 40px;">
                    <!-- Greeting -->
                    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:600;color:#323232;line-height:1.3;">Sign in to Hooklab</h1>

                    <!-- Description -->
                    <p style="margin:0 0 28px 0;font-size:16px;line-height:1.6;color:#323232;">
                      Click the button below to sign in to your account. This link expires in 1 hour.
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding:0 0 28px 0;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${signInLink}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="13%" fillcolor="#01189b" strokecolor="#01189b" strokeweight="0">
                            <w:anchorlock/>
                            <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:600;">Sign in to Hooklab</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${signInLink}" target="_blank" style="display:inline-block;background-color:#01189b;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;line-height:1;mso-hide:all;">Sign in to Hooklab</a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback link -->
                    <p style="margin:0 0 8px 0;font-size:14px;line-height:1.5;color:#686868;">
                      If the button doesn't work, copy and paste this link:
                    </p>
                    <p style="margin:0 0 28px 0;font-size:14px;line-height:1.5;word-break:break-all;">
                      <a href="${signInLink}" style="color:#01189b;text-decoration:underline;">${signInLink}</a>
                    </p>

                    <!-- Security note -->
                    <p style="margin:0;font-size:14px;line-height:1.5;color:#686868;">
                      If you didn't request this email, you can safely ignore it.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 0 0 0;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#686868;">
                &copy; 2026 Hooklab &middot; hooklab.junaid.guru
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
