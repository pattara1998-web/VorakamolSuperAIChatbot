# ✅ Deployment Checklist for Vorakamol SuperAI Chatbot v2.8

## 🔴 CRITICAL STEPS (Required for Production)

### 1. Environment Variables Setup
- [ ] Copy `.env.example` to `.env`
- [ ] Set `GEMINI_API_KEY` - **MANDATORY** (System won't work without this)
- [ ] Set `APP_URL` - **MANDATORY** (For OAuth callbacks)
- [ ] Set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` - **MANDATORY** (For Facebook integration)
- [ ] Set `ENCRYPTION_SECRET_KEY` - **MANDATORY** (For data security)
- [ ] Set `FACEBOOK_VERIFY_TOKEN` to `FB_AI_SALES_TOKEN_2026`

### 2. Facebook App Configuration
- [ ] Create Facebook App at https://developers.facebook.com/apps
- [ ] Add "Messenger" product to the app
- [ ] Set Webhook URL: `https://your-domain.com/api/webhook/facebook`
- [ ] Set Verify Token: `FB_AI_SALES_TOKEN_2026`
- [ ] Subscribe to webhooks: `messages`, `messaging_postbacks`, `feed`
- [ ] Add permissions: `pages_show_list`, `pages_messaging`, `pages_read_engagement`

### 3. Server Setup
- [ ] Install Node.js (v18+ recommended)
- [ ] Run `npm install` to install dependencies
- [ ] Run `npm run build` to build the project
- [ ] Ensure `dist/` folder exists with build files
- [ ] Run `npm start` to start the server

### 4. Database Setup
- [ ] Ensure `data/` folder exists
- [ ] Check file permissions for writing to `data/superai-v2.8.json`
- [ ] Test database sync functionality in the admin panel

### 5. Port Configuration
- [ ] Ensure port 3000 is available (or set custom PORT in .env)
- [ ] Configure firewall to allow traffic on chosen port
- [ ] Set up SSL/HTTPS if deploying to production

## 🟡 IMPORTANT CHECKS (Functionality Verification)

### 6. AI Functionality
- [ ] Test API key validation in "ตั้งค่า AI API" panel
- [ ] Test chat response in "จำลองแชท AI" panel
- [ ] Verify AI can access product database
- [ ] Test step-by-step sales sequence

### 7. Facebook Integration
- [ ] Test "เชื่อมต่อ Facebook" button
- [ ] Verify OAuth flow works correctly
- [ ] Test webhook verification
- [ ] Test real message receiving (from Facebook to server)
- [ ] Test message sending (from server to Facebook)

### 8. Database Operations
- [ ] Test adding products to database
- [ ] Test syncing database with pages
- [ ] Test CSV export functionality
- [ ] Verify data persistence after server restart

### 9. Frontend Components
- [ ] Test all navigation tabs work
- [ ] Test page settings modal
- [ ] Test product template modal
- [ ] Test database sheet sync
- [ ] Verify responsive design on mobile

## 🟢 OPTIONAL ENHANCEMENTS

### 10. Additional Integrations
- [ ] Configure Google Sheets integration (if needed)
- [ ] Configure LINE messaging (if needed)
- [ ] Configure Telegram notifications (if needed)
- [ ] Set up automated follow-up rules

### 11. Performance & Security
- [ ] Enable HTTPS/SSL
- [ ] Set up rate limiting
- [ ] Configure backup strategy
- [ ] Monitor server logs
- [ ] Set up monitoring/alerting

## 🚀 POST-DEPLOYMENT VERIFICATION

### 12. Final Testing
- [ ] Test full chat flow with real Facebook page
- [ ] Test order creation flow
- [ ] Test customer database updates
- [ ] Test comment moderation
- [ ] Verify AI responses are appropriate

### 13. Documentation
- [ ] Update user documentation
- [ ] Create admin guide
- [ ] Document API endpoints
- [ ] Create troubleshooting guide

## ⚠️ COMMON ISSUES & SOLUTIONS

### Issue: AI not responding
**Solution:** Check `GEMINI_API_KEY` is set correctly and has valid quota

### Issue: Facebook webhook not receiving messages
**Solution:** Verify webhook URL is correct and verify token matches

### Issue: Database not persisting
**Solution:** Check file permissions for `data/` folder

### Issue: OAuth flow failing
**Solution:** Verify `APP_URL` and Facebook App redirect settings

### Issue: Build errors
**Solution:** Run `npm install` again and check Node.js version

## 📞 SUPPORT CONTACT
- Check system logs in console for detailed error messages
- Review `PRODUCTION_CONFIG.md` for configuration details
- Test individual components using the "จำลองแชท AI" panel