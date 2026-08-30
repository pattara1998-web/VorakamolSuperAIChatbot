# 🧪 Complete System Testing Guide for Vorakamol SuperAI Chatbot v2.8

## 🎯 PRE-DEPLOYMENT TESTING CHECKLIST

### 1. 🔑 API Configuration Testing
#### Test 1.1: AI API Key Validation
- [ ] Open "ตั้งค่า AI API" modal
- [ ] Check that status shows "ยังไม่ได้ตั้งค่า API" when no key is set
- [ ] Enter a valid Gemini API key
- [ ] Verify status changes to "AI พร้อมใช้งาน"
- [ ] Check that key is saved (persists after page refresh)
- [ ] Test with invalid key - should show error message

#### Test 1.2: API Status Indicators
- [ ] Check Navbar shows correct API status
- [ ] Verify Simulator shows API warning when not configured
- [ ] Test status updates every 10 seconds

### 2. 📘 Facebook Integration Testing
#### Test 2.1: OAuth Connection Flow
- [ ] Click "เชื่อมต่อ Facebook" button
- [ ] Verify it opens Facebook OAuth popup
- [ ] Test connection with valid credentials
- [ ] Verify pages are imported successfully
- [ ] Check that page tokens are saved correctly

#### Test 2.2: Manual Token Connection
- [ ] Switch to "สถานะ Webhook & Manual" tab
- [ ] Test manual token import
- [ ] Verify single page connection
- [ ] Test batch page import

#### Test 2.3: Webhook Verification
- [ ] Copy webhook URL from the modal
- [ ] Test webhook verification endpoint
- [ ] Verify verify token matches
- [ ] Check subscription fields are correct

### 3. 📊 Database Testing
#### Test 3.1: Product Database Sync
- [ ] Add a product to database
- [ ] Click "ซิงค์ Database" button
- [ ] Verify product appears in page settings
- [ ] Check that data is linked correctly
- [ ] Test sync across different categories (AMULET, CHINA, OTOP, AGRICULTURE)

#### Test 3.2: Page-Product Linking
- [ ] Set up product in page settings
- [ ] Check that product appears in database
- [ ] Modify product in database
- [ ] Verify changes reflect in page settings
- [ ] Test data persistence after server restart

### 4. 💬 Chat Functionality Testing
#### Test 4.1: AI Chat Response
- [ ] Test chat in simulator with API configured
- [ ] Verify AI responds with product information
- [ ] Test step-by-step sales sequence
- [ ] Check that AI uses correct product data
- [ ] Test with different page products

#### Test 4.2: Order Detection
- [ ] Send message with order intent
- [ ] Verify AI detects order correctly
- [ ] Check that customer data is captured
- [ ] Test address extraction
- [ ] Verify order is created in system

#### Test 4.3: No API Scenario
- [ ] Test chat without API key configured
- [ ] Verify appropriate warning message is shown
- [ ] Check that system doesn't crash
- [ ] Test that user is informed to set API key

### 5. 🎨 Frontend Component Testing
#### Test 5.1: Navigation
- [ ] Test all tabs work correctly
- [ ] Verify page selector dropdown
- [ ] Test responsive design on mobile
- [ ] Check theme toggle works
- [ ] Verify lock screen functionality

#### Test 5.2: Modals
- [ ] Test Facebook Connect Modal
- [ ] Test Page Settings Modal
- [ ] Test AI API Settings Modal
- [ ] Test Product Template Modal
- [ ] Verify all modals close properly

#### Test 5.3: Data Display
- [ ] Check pages display correctly in Pages Hub
- [ ] Verify products show in Database Sheet
- [ ] Test customer list in CRM
- [ ] Check orders display correctly
- * Verify statistics calculations

### 6. 🔧 Backend API Testing
#### Test 6.1: Health Endpoints
- [ ] Test `/api/health` endpoint
- [ ] Test `/api/system/readiness` endpoint
- [ ] Verify proper JSON responses
- [ ] Check error handling

#### Test 6.2: Settings Endpoints
- [ ] Test GET `/api/settings`
- [ ] Test POST `/api/settings/gemini`
- [ ] Verify API key validation
- [ ] Check data persistence

#### Test 6.3: Data Endpoints
- [ ] Test GET `/api/data`
- [ ] Test POST `/api/data/update`
- [ ] Verify data sync
- [ ] Check error handling

### 7. 🚨 Error Handling Testing
#### Test 7.1: Network Errors
- [ ] Test with server offline
- [ ] Verify graceful degradation
- [ ] Check localStorage fallback
- [ ] Test retry logic

#### Test 7.2: Invalid Data
- [ ] Test with invalid API keys
- [ ] Test with malformed Facebook tokens
- * Verify error messages are clear
- [ ] Check system doesn't crash

#### Test 7.3: Edge Cases
- [ ] Test with empty database
- [ ] Test with no pages configured
- [ ] Test with very long messages
- [ ] Test with special characters

### 8. 📱 Real-World Scenario Testing
#### Test 8.1: Complete User Flow
1. User opens website
2. User sees API not configured warning
3. User sets up AI API key
4. User connects Facebook page
5. User adds product to database
6. User syncs database with page
7. User tests chat in simulator
8. User enables auto-reply
9. Real customer sends message
10. AI responds with product info
11. Customer places order
12. Order appears in system

#### Test 8.2: Multi-Page Scenario
- [ ] Connect multiple Facebook pages
- [ ] Set different products for each page
- [ ] Test chat on different pages
- [ ] Verify correct product data per page
- [ ] Test order handling per page

### 9. 🔒 Security Testing
#### Test 9.1: Data Encryption
- [ ] Verify API keys are encrypted
- [ ] Check page tokens are encrypted
- [ ] Test data at rest encryption
- [ ] Verify decryption works correctly

#### Test 9.2: Access Control
- [ ] Test lock screen functionality
- [ ] Verify PIN protection works
- [ ] Test session management
- [ ] Check logout functionality

### 10. ⚡ Performance Testing
#### Test 10.1: Load Testing
- [ ] Test with 100+ pages
- [ ] Test with 1000+ products
- [ ] Test with 1000+ customers
- [ ] Verify system remains responsive

#### Test 10.2: Response Time
- [ ] Measure API response times
- [ ] Test webhook processing speed
- [ ] Check database query performance
- [ ] Verify AI response latency

## 🎯 SUCCESS CRITERIA

### MUST PASS (Critical)
- ✅ AI API key validation works
- ✅ Facebook OAuth flow completes successfully
- ✅ Webhook receives and processes messages
- ✅ AI responds with correct product information
- ✅ Database sync works bidirectionally
- ✅ Orders are created correctly
- ✅ System doesn't crash on errors
- ✅ Data persists after server restart

### SHOULD PASS (Important)
- ✅ UI is responsive and works on mobile
- ✅ Error messages are clear and helpful
- ✅ All modals function correctly
- ✅ Real-time status updates work
- ✅ Data encryption works properly
- ✅ Lock screen functions correctly

### NICE TO HAVE (Enhancement)
- ✅ Performance is acceptable under load
- ✅ Multiple pages work simultaneously
- ✅ Integration with external services works
- ✅ Backup/restore functionality works

## 📋 TEST REPORT TEMPLATE

```
Date: [DATE]
Tester: [NAME]
Environment: [LOCAL/STAGING/PRODUCTION]

Critical Tests:
- API Configuration: [PASS/FAIL]
- Facebook Integration: [PASS/FAIL]
- Chat Functionality: [PASS/FAIL]
- Database Sync: [PASS/FAIL]

Important Tests:
- UI Responsiveness: [PASS/FAIL]
- Error Handling: [PASS/FAIL]
- Data Persistence: [PASS/FAIL]

Nice to Have:
- Performance: [PASS/FAIL]
- Multi-page Support: [PASS/FAIL]

Overall Status: [READY FOR PRODUCTION / NEEDS FIXES]

Issues Found:
- [List any issues discovered]

Recommendations:
- [List any recommendations for improvement]
```

## 🚀 GO/NO-GO DECISION

### GO Criteria (All must be true):
- All critical tests pass
- No critical security issues
- Data persistence works correctly
- Performance is acceptable

### NO-GO Criteria (Any of these):
- Critical tests fail
- Security vulnerabilities found
- Data loss issues
- System instability

## 📞 SUPPORT CONTACT
If any test fails, refer to:
- System logs in console
- DEPLOYMENT_CHECKLIST.md
- PRODUCTION_CONFIG.md
- Error messages in the UI