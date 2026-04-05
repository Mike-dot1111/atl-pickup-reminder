// Airport Taxi Links — Order Confirmation Email
// Triggered by Shopify webhook on order creation
// Sends branded confirmation email to customer via draft order invoice

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

function buildConfirmationMessage(order) {
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
  const returnTrip = getOrderProp(order, '_Return') || '';
  const returnDate = getOrderProp(order, '_Return Date') || '';
  const returnTime = getOrderProp(order, '_Return Time') || '';
  const dateTimeDisplay = when || (date + ' ' + time).trim();
  const customerName = order.customer
    ? (order.customer.first_name || '') + ' ' + (order.customer.last_name || '')
    : '';

  let details = '';
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
  if (returnTrip === 'Yes') {
    details += 'Return Trip: Yes\n';
    if (returnDate && returnDate !== 'N/A') details += 'Return Date: ' + returnDate + '\n';
    if (returnTime && returnTime !== 'N/A') details += 'Return Time: ' + returnTime + '\n';
  }
  if (notes && notes !== 'None') details += 'Notes: ' + notes + '\n';

  return `Hi${customerName ? ' ' + customerName.trim() : ''},

Thank you for booking with Airport Taxi Links! Your booking is confirmed.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Booking Ref: ${order.name}
Pickup: ${dateTimeDisplay}
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Your Journey Details
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${details}
Payment Details
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Total Fare: ${total}
Payment Method: ${payment}
Deposit Paid: \u00a3${order.total_price || '0.00'}

What Happens Next
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2714 Your booking is confirmed and your driver has been notified
\u2714 We will send you a reminder 24 hours before your pickup
\u2714 Your driver will track your flight and adjust for any delays
\u2714 If you need to make changes, please contact us as soon as possible

Need to make changes?
\u2709 Email: info@airporttaxilinks.co.uk
\u260e Phone: 07903 040442

Thank you for choosing Airport Taxi Links \u2014 your trusted Heathrow specialists covering all UK airports.

Kind regards,
Airport Taxi Links Team
airporttaxilinks.co.uk`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'OK — send POST with order data' });
  }

  // Read the raw body for webhook
  let body = '';
  if (typeof req.body === 'object') {
    body = req.body;
  } else {
    return res.status(400).json({ error: 'No order data' });
  }

  const order = body;
  const to = order.email || order.contact_email;

  if (!to) {
    console.log('No customer email on order ' + (order.name || 'unknown'));
    return res.status(200).json({ message: 'No customer email, skipping' });
  }

  console.log('Sending confirmation for ' + order.name + ' to ' + to);

  try {
    const message = buildConfirmationMessage(order);

    // Create temporary draft order
    const draftRes = await shopifyRest('POST', '/draft_orders.json', {
      draft_order: {
        line_items: [{ title: 'Booking Confirmation', quantity: 1, price: '0.00' }],
        email: to,
        note: 'booking-email',
      },
    });

    const draftOrder = draftRes.draft_order;
    if (!draftOrder || !draftOrder.id) {
      console.log('Failed to create draft order');
      return res.status(500).json({ error: 'Failed to create draft order' });
    }

    // Send invoice email
    const gid = 'gid://shopify/DraftOrder/' + draftOrder.id;
    const subject = 'Booking Confirmed \\u2014 ' + order.name;
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
      console.log('Invoice errors:', JSON.stringify(errors));
    } else {
      console.log('Confirmation email sent to ' + to);
    }

    // Delete draft order
    await shopifyRest('DELETE', '/draft_orders/' + draftOrder.id + '.json');

    return res.status(200).json({
      success: errors.length === 0,
      order: order.name,
      to,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
