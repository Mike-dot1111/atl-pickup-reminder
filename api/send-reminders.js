// Airport Taxi Links — Pickup Reminder Service
// Runs daily at 9am via Vercel Cron
// Checks unfulfilled orders for tomorrow's pickups
// Sends branded reminder email via Shopify draft order invoice (free)

const https = require('https');

const STORE = 'tap-taxi.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN;

function shopifyRest(method, path, body) {
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
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function shopifyGraphQL(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const opts = {
      hostname: STORE,
      path: '/admin/api/2024-01/graphql.json',
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
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
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  let parsed = dateStr.trim().split(' ')[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(parsed)) {
    const [d, m, y] = parsed.split('/');
    parsed = `${y}-${m}-${d}`;
  }
  return parsed === tomorrowStr;
}

function buildReminderMessage(order) {
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
  const notes = getOrderProp(order, '_Notes') || '';
  const dateTimeDisplay = when || (date + ' ' + time).trim();
  const customerName = order.customer ? (order.customer.first_name || '') : '';

  let destination = '';
  if (airport && terminal) destination = airport + ' \u2013 ' + terminal;
  else if (airport) destination = airport;
  else if (dropoff) destination = dropoff;

  let details = '';
  if (destination) details += 'Destination: ' + destination + '\n';
  if (pickup) details += 'Pickup Address: ' + pickup + '\n';
  if (flight && flight !== 'N/A') details += 'Flight: ' + flight + '\n';
  if (vehicle) details += 'Vehicle: ' + vehicle + '\n';
  if (passengers) details += 'Passengers: ' + passengers + '\n';

  return `Hi${customerName ? ' ' + customerName : ''},

Just checking in to make sure everything is all set for your journey tomorrow.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
\u2708 Pickup: ${dateTimeDisplay}
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Your Journey Details
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${details}
Payment Details
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Total Fare: ${total}
Payment Method: ${payment}

\u2714 Your booking is fully confirmed
\u2714 Your driver will arrive promptly at the scheduled time
\u2714 Sit back and enjoy a smooth, stress-free journey to the airport

If there's anything you'd like to update or check before your trip, we're always happy to help:

\u2709 Email: info@airporttaxilinks.co.uk
\u260e Phone: 07903 040442

Thank you for choosing Airport Taxi Links \u2014 your trusted Heathrow specialists covering all UK airports.

We wish you a pleasant journey and safe travels \u2708

Kind regards,
Airport Taxi Links Team
airporttaxilinks.co.uk`;
}

async function sendReminderEmail(order) {
  const to = order.email || order.contact_email;
  if (!to) {
    console.log('  No email for order ' + order.name);
    return false;
  }

  const message = buildReminderMessage(order);
  const dateTimeDisplay = getOrderProp(order, '_When') || (getOrderProp(order, '_Date') || '') + ' ' + (getOrderProp(order, '_Time') || '');

  try {
    // Step 1: Create a temporary draft order
    const draftRes = await shopifyRest('POST', '/draft_orders.json', {
      draft_order: {
        line_items: [{ title: 'Pickup Reminder', quantity: 1, price: '0.00' }],
        email: to,
        note: 'booking-email',
      },
    });

    const draftOrder = draftRes.draft_order;
    if (!draftOrder || !draftOrder.id) {
      console.log('  Failed to create draft order for ' + order.name);
      return false;
    }

    console.log('  Created draft order ' + draftOrder.id + ' for ' + to);

    // Step 2: Send invoice with custom message
    const gid = 'gid://shopify/DraftOrder/' + draftOrder.id;
    const subject = 'Reminder: Your Pickup is Tomorrow — ' + order.name;

    // Escape the message for GraphQL
    const escapedMessage = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const escapedSubject = subject.replace(/"/g, '\\"');
    const escapedTo = to.replace(/"/g, '\\"');

    const mutation = `mutation {
      draftOrderInvoiceSend(
        id: "${gid}",
        email: {
          to: "${escapedTo}",
          subject: "${escapedSubject}",
          customMessage: "${escapedMessage}"
        }
      ) {
        userErrors { field message }
      }
    }`;

    const invoiceRes = await shopifyGraphQL(mutation);
    const errors = invoiceRes?.data?.draftOrderInvoiceSend?.userErrors || [];

    if (errors.length > 0) {
      console.log('  Invoice errors:', JSON.stringify(errors));
    } else {
      console.log('  Reminder email sent to ' + to);
    }

    // Step 3: Delete the draft order
    await shopifyRest('DELETE', '/draft_orders/' + draftOrder.id + '.json');
    console.log('  Deleted draft order ' + draftOrder.id);

    return errors.length === 0;
  } catch (err) {
    console.error('  Email send error:', err.message);
    return false;
  }
}

module.exports = async function handler(req, res) {
  console.log('Starting 24-hour reminder check...');

  try {
    const data = await shopifyRest('GET', '/orders.json?status=any&fulfillment_status=unfulfilled&limit=250');
    const orders = data.orders || [];
    console.log('Found ' + orders.length + ' unfulfilled orders');

    let remindersSent = 0;

    for (const order of orders) {
      if ((order.tags || '').includes('reminder-sent')) continue;

      const pickupDate = getOrderProp(order, '_Date') || '';
      const pickupWhen = getOrderProp(order, '_When') || '';
      const dateToCheck = pickupDate || pickupWhen;

      if (isTomorrow(dateToCheck)) {
        console.log('Order ' + order.name + ' has pickup tomorrow: ' + dateToCheck);

        const sent = await sendReminderEmail(order);

        if (sent) {
          // Tag as reminder-sent so we don't send again
          const currentTags = (order.tags || '').split(',').map(t => t.trim()).filter(t => t);
          currentTags.push('reminder-sent');
          await shopifyRest('PUT', '/orders/' + order.id + '.json', {
            order: { id: order.id, tags: currentTags.join(', ') },
          });
          remindersSent++;
        }
      }
    }

    console.log('Done. ' + remindersSent + ' reminders sent.');
    return res.status(200).json({
      success: true,
      ordersChecked: orders.length,
      remindersSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
