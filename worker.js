const PRODUCTS = {
  product1: { name: 'Product 1', amount: 55, redirectUrl: 'https://chat.whatsapp.com/Hct5SVgIqePIlJV6iDHvG0?s=cl&p=a&mlu=4&ilr=4' },
  product2: { name: 'Product 2', amount: 150, redirectUrl: 'https://chat.whatsapp.com/ELCDcKLQTcU83TiTKOGXKr?s=cl&p=a&mlu=4&ilr=4' }
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors, 'Cache-Control': 'no-store' } });
const validRef = ref => typeof ref === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(ref);
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/collect' && request.method === 'POST') {
      try {
        const body = await request.json();
        const product = PRODUCTS[body.productId];
        const reference = body.reference;
        const phone = String(body.phone || '').trim();
        const operator = String(body.operator || '').toLowerCase();
        if (!product) return reply({ message: 'Invalid product' }, 400);
        if (!validRef(reference)) return reply({ message: 'Invalid reference' }, 400);
        if (!['airtel', 'mtn', 'zamtel'].includes(operator)) return reply({ message: 'Invalid network' }, 400);
        if (!/^[0-9+ ]{9,15}$/.test(phone)) return reply({ message: 'Invalid phone' }, 400);
        // Durable transaction binding prevents a reference being reused for a different product.
        if (!env.PAYMENTS) return reply({ message: 'PAYMENTS KV binding is missing' }, 503);
        const key = `payment:${reference}`;
        if (await env.PAYMENTS.get(key)) return reply({ message: 'Reference already exists' }, 409);
        const record = { productId: body.productId, amount: product.amount, state: 'initiating' };
        await env.PAYMENTS.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 30 });
        const response = await fetch('https://api.lenco.co/access/v2/collections/mobile-money', {
          method: 'POST', headers: { Authorization: `Bearer ${env.LENCO_SECRET_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: product.amount, reference, phone, operator, country: 'zm', bearer: 'merchant' })
        });
        const data = await response.json();
        await env.PAYMENTS.put(key, JSON.stringify({ ...record, state: response.ok ? 'requested' : 'initiation_failed' }), { expirationTtl: 60 * 60 * 24 * 30 });
        return reply(data, response.status);
      } catch (error) { console.error('Collect error', error); return reply({ message: 'Unable to initiate payment' }, 500); }
    }
    if (url.pathname === '/verify' && request.method === 'GET') {
      const reference = url.searchParams.get('reference');
      if (!validRef(reference)) return reply({ message: 'Invalid reference' }, 400);
      if (!env.PAYMENTS) return reply({ message: 'PAYMENTS KV binding is missing' }, 503);
      const record = await env.PAYMENTS.get(`payment:${reference}`, 'json');
      if (!record || record.state === 'initiation_failed') return reply({ message: 'Unknown payment' }, 404);
      try {
        const response = await fetch(`https://api.lenco.co/access/v2/collections/status/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${env.LENCO_SECRET_KEY}` } });
        const data = await response.json();
        if (!response.ok) return reply({ message: 'Unable to verify payment' }, response.status);
        const tx = data?.data;
        const status = String(tx?.status || '').toLowerCase();
        const verifiedReference = String(tx?.reference || '');
        const verifiedAmount = Number(tx?.amount);
        const verifiedCurrency = String(tx?.currency || '').toUpperCase();
        const paid = ['successful', 'success'].includes(status) && verifiedReference === reference && verifiedAmount === record.amount && verifiedCurrency === 'ZMW';
        if (paid) {
          const product = PRODUCTS[record.productId];
          return reply({ status: 'successful', product: { name: product.name, amount: record.amount }, reference, redirectUrl: product.redirectUrl });
        }
        return reply({ status: ['pending', 'pay-offline', 'processing'].includes(status) ? 'pending' : 'not_completed' });
      } catch (error) { console.error('Verify error', error); return reply({ message: 'Unable to verify payment' }, 502); }
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return reply({ message: 'Lenco payment worker is running' });
  }
};
