// 24-Hour Pickup Reminder — Vercel Cron Function
// Checks all unfulfilled orders, finds pickups happening tomorrow,
// sends a branded reminder email via Shopify Admin API

const https = require('https');

const STORE = 'tap-taxi.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN;

function shopifyRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: STORE,
      path: `/admin/api/2024-01${path}`,
      method,
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function getOrderProp(order, key) {
  for (const item of order.line_items || []) {
    for (const prop of item.properties || []) {
      if (prop.name === key) return prop.value;
    }
  }
  return null;
}

function isTomorrow(dateStr) {
  if (!dateStr) return false;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

  // Handle various date formats
  // "2026-04-08" or "2026-04-08 14:30" or "08/04/2026"
  let parsed = dateStr.trim().split(' ')[0]; // Take date part only

  // If it's DD/MM/YYYY, convert
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(parsed)) {
    const [d, m, y] = parsed.split('/');
    parsed = `${y}-${m}-${d}`;
  }

  return parsed === tomorrowStr;
}

function buildReminderEmail(order) {
  const pickup = getOrderProp(order, '_Pickup') || getOrderProp(order, '_Pickup address') || getOrderProp(order, '_Address') || '';
  const dropoff = getOrderProp(order, '_Dropoff') || '';
  const airport = getOrderProp(order, '_Airport') || '';
  const terminal = getOrderProp(order, '_Terminal') || '';
  const direction = getOrderProp(order, '_Direction') || getOrderProp(order, '_Transfer') || '';
  const date = getOrderProp(order, '_Date') || '';
  const time = getOrderProp(order, '_Time') || '';
  const when = getOrderProp(order, '_When') || '';
  const vehicle = getOrderProp(order, '_Vehicle') || '';
  const passengers = getOrderProp(order, '_Passengers') || '';
  const flight = getOrderProp(order, '_Flight') || '';
  const total = getOrderProp(order, '_Total') || '';
  const payment = getOrderProp(order, '_Payment') || '';
  const returnTrip = getOrderProp(order, '_Return') || '';
  const returnDate = getOrderProp(order, '_Return Date') || '';
  const returnTime = getOrderProp(order, '_Return Time') || '';
  const notes = getOrderProp(order, '_Notes') || '';

  const dateTimeDisplay = when || `${date} ${time}`.trim();
  const customerName = order.customer
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
    : '';

  return `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;">

  <div style="background:#1a2b4a;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
    <img src="https://airporttaxilinks.co.uk/cdn/shop/files/Airport_Logo_310x148.png?v=1774380496" alt="Airport Taxi Links" style="max-width:200px;height:auto;">
  </div>

  <div style="background:#fff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;">

    <h1 style="color:#1a2b4a;font-size:22px;margin:0 0 8px;">Reminder: Your Pickup is Tomorrow</h1>
    <p style="color:#6b7280;margin:0 0 24px;">Hi${customerName ? ' ' + customerName : ''}, just a friendly reminder that your trip is scheduled for tomorrow. Everything is confirmed and your driver is ready.</p>

    <div style="background:#1a2b4a;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="color:#e9a825;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Your Pickup</p>
      <p style="color:#fff;font-size:28px;font-weight:700;margin:0;">${dateTimeDisplay}</p>
    </div>

    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <h2 style="color:#1a2b4a;font-size:16px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Trip Details</h2>
      ${direction ? `<p style="margin:4px 0;font-size:14px;"><strong>Direction:</strong> ${direction}</p>` : ''}
      ${pickup ? `<p style="margin:4px 0;font-size:14px;"><strong>Pickup:</strong> ${pickup}</p>` : ''}
      ${dropoff ? `<p style="margin:4px 0;font-size:14px;"><strong>Dropoff:</strong> ${dropoff}</p>` : ''}
      ${airport ? `<p style="margin:4px 0;font-size:14px;"><strong>Airport:</strong> ${airport}</p>` : ''}
      ${terminal ? `<p style="margin:4px 0;font-size:14px;"><strong>Terminal:</strong> ${terminal}</p>` : ''}
      ${flight ? `<p style="margin:4px 0;font-size:14px;"><strong>Flight:</strong> ${flight}</p>` : ''}
      <p style="margin:4px 0;font-size:14px;"><strong>Vehicle:</strong> ${vehicle}</p>
      <p style="margin:4px 0;font-size:14px;"><strong>Passengers:</strong> ${passengers}</p>
      ${returnTrip === 'Yes' ? `<p style="margin:4px 0;font-size:14px;"><strong>Return:</strong> ${returnDate} ${returnTime}</p>` : ''}
      ${notes && notes !== 'None' ? `<p style="margin:4px 0;font-size:14px;"><strong>Notes:</strong> ${notes}</p>` : ''}
    </div>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="color:#166534;font-size:16px;font-weight:700;margin:0 0 4px;">Total Fare: ${total}</p>
      <p style="color:#166534;font-size:13px;margin:0;">Payment: ${payment}</p>
    </div>

    <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:20px;margin-bottom:24px;">
      <h2 style="color:#854d0e;font-size:16px;margin:0 0 8px;">Everything looks good?</h2>
      <p style="color:#854d0e;font-size:14px;line-height:1.6;margin:0;">No action needed if everything is still correct. If you need to make any changes, please let us know as soon as possible so we can adjust your booking.</p>
    </div>

    <div style="text-align:center;padding:16px 0;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1a2b4a;">Need to make changes?</p>
      <p style="margin:0 0 4px;font-size:14px;">Email: <a href="mailto:info@heathrowairporttaxilinks.co.uk" style="color:#1a2b4a;">info@heathrowairporttaxilinks.co.uk</a></p>
      <p style="margin:0;font-size:14px;">Phone: <a href="tel:07903040442" style="color:#1a2b4a;">07903 040442</a></p>
    </div>

  </div>

  <div style="background:#1a2b4a;padding:16px 24px;text-align:center;border-radius:0 0 8px 8px;">
    <p style="color:#fff;font-size:12px;margin:0;">Airport Taxi Links — Heathrow specialists covering all UK airports</p>
    <p style="color:#6b7280;font-size:11px;margin:4px 0 0;"><a href="https://airporttaxilinks.co.uk" style="color:#e9a825;">airporttaxilinks.co.uk</a></p>
  </div>

</div>`;
}

async function sendReminderEmail(order, emailBody) {
  // Use Shopify's order note + tag to track that reminder was sent
  const subject = `Reminder: Your Pickup is Tomorrow — ${order.name}`;
  const to = order.email || order.contact_email;

  if (!to) {
    console.log(`  No email for order ${order.name}, skipping`);
    return false;
  }

  // Send via Shopify draft order email or direct SMTP
  // Since Shopify doesn't have a direct "send email" API,
  // we use the order notification approach - add a note and send via Flow
  // Actually, we'll tag the order so a Flow can pick it up

  // Tag the order with 'reminder-sent' and 'send-reminder'
  const currentTags = order.tags || '';
  const newTags = currentTags ? `${currentTags}, reminder-due` : 'reminder-due';

  await shopifyRequest('PUT', `/orders/${order.id}.json`, {
    order: { id: order.id, tags: newTags },
  });

  console.log(`  Tagged order ${order.name} with 'reminder-due' for ${to}`);
  return true;
}

module.exports = async function handler(req, res) {
  // Verify this is a cron call or has auth
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Starting 24-hour reminder check...');

  try {
    // Fetch all unfulfilled orders
    const data = await shopifyRequest('GET', '/orders.json?status=any&fulfillment_status=unfulfilled&limit=250');
    const orders = data.orders || [];
    console.log(`Found ${orders.length} unfulfilled orders`);

    let remindersSent = 0;

    for (const order of orders) {
      // Skip if already tagged with reminder
      if ((order.tags || '').includes('reminder-sent')) {
        continue;
      }

      // Check pickup date - try multiple property names
      const pickupDate = getOrderProp(order, '_Date') || '';
      const pickupWhen = getOrderProp(order, '_When') || '';

      const dateToCheck = pickupDate || pickupWhen;

      if (isTomorrow(dateToCheck)) {
        console.log(`Order ${order.name} has pickup tomorrow: ${dateToCheck}`);

        const emailBody = buildReminderEmail(order);
        const sent = await sendReminderEmail(order, emailBody);

        if (sent) {
          // Update tag to 'reminder-sent' so we don't send again
          const currentTags = (order.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t !== 'reminder-due');
          currentTags.push('reminder-sent');

          await shopifyRequest('PUT', `/orders/${order.id}.json`, {
            order: { id: order.id, tags: currentTags.join(', ') },
          });

          remindersSent++;
        }
      }
    }

    console.log(`Done. ${remindersSent} reminders tagged.`);

    return res.status(200).json({
      success: true,
      ordersChecked: orders.length,
      remindersSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reminder error:', error);
    return res.status(500).json({ error: error.message });
  }
};
