---
"@techstream/quark-core": patch
---

Bump nodemailer 9→10

The only breaking change in nodemailer 10 is "Node.js 20 or newer is required"
(this repo requires ≥22). `createTransport` and the SMTP transport options
(`host`, `port`, `secure`, `connectionTimeout`, `greetingTimeout`,
`socketTimeout`) are unchanged, so `email.js` needs no changes.
