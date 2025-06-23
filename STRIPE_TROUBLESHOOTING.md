# Stripe Integration Troubleshooting Guide

## Issue: Token purchases complete but user token count doesn't increase

### Quick Diagnosis Steps

1. **Check Webhook Configuration in Stripe Dashboard**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Verify webhook endpoint URL is: `https://yourdomain.com/api/webhook`
   - Ensure `checkout.session.completed` event is selected
   - Check webhook secret matches `STRIPE_WEBHOOK_SECRET` environment variable

2. **Verify Product IDs Match**
   ```javascript
   // In buy-tokens.js
   { tokens: 10000, price: '4.99', priceId: 'price_1RWlea4gLT9aIqMDkebCi9N2' }
   { tokens: 25000, price: '9.99', priceId: 'price_1RWlfr4gLT9aIqMDl62HX9DF' }
   ```
   - These must match exactly with Stripe product IDs in your dashboard

3. **Test Webhook Delivery**
   - In Stripe Dashboard → Webhooks → click your webhook → View logs
   - Make a test purchase and check if webhook events are being delivered
   - Look for 200 responses (success) or error codes

4. **Check Application Logs**
   - Webhook handler logs extensively - check your deployment logs
   - Look for lines starting with timestamps like `[2024-01-...]`
   - Key indicators:
     - `✅ Webhook signature verified successfully`
     - `💳 Checkout completed for: user@email.com`
     - `👤 Found user: {...}`
     - `✅ Successfully credited X tokens`

### Common Problems & Solutions

#### Problem 1: Webhook Not Being Called
**Symptoms:** No webhook logs appear in application logs

**Solutions:**
- Verify webhook URL in Stripe dashboard
- Ensure webhook endpoint is publicly accessible
- Check webhook secret configuration

#### Problem 2: User Not Found
**Symptoms:** Log shows "❌ User not found for email: user@email.com"

**Solutions:**
- Verify user's email in Stripe matches email in your database exactly
- Check for email case sensitivity issues
- Ensure user completed registration process

#### Problem 3: Price ID Mismatch
**Symptoms:** Log shows "🔄 Using metadata fallback, token_count: undefined"

**Solutions:**
- Double-check price IDs in Stripe dashboard match code
- Ensure product is active in Stripe
- Verify checkout session includes proper metadata

#### Problem 4: Database Update Fails
**Symptoms:** User found but tokens not updated

**Solutions:**
- Verify Supabase service role key has write permissions
- Check database connection and table permissions
- Ensure `users` table has correct column names

### Testing Steps

#### 1. Test Database Connection
```bash
# Run from project root
node debug-stripe.js
```

#### 2. Test Token Credit Logic
```bash
# Use webhook test endpoint
curl -X POST https://yourdomain.com/api/webhook-test \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","tokenAmount":1000}'
```

#### 3. Test End-to-End Purchase
1. Make a small test purchase ($0.50 minimum)
2. Monitor webhook logs in Stripe dashboard
3. Check application logs for processing
4. Verify token balance in database

### Environment Variables Checklist
```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Support Information
- Webhook endpoint: `/api/webhook`
- Test endpoint: `/api/webhook-test`
- Debug script: `debug-stripe.js`
- Enhanced logging enabled in webhook handler
