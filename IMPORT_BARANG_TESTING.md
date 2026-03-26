# Testing Guide - Mobile Import Barang

## ✅ Setup Complete (2026-01-15)

**Dependencies Installed:**
- ✅ `react-native-flash-message` - For toast notifications
- ✅ `expo-image-picker` - For twibbon upload (already installed)
- ✅ `FlashMessage` component added to App.tsx

**Status:** ✅ Ready for testing!

---

## 🚀 Quick Start

### 1. Restart the Development Server

```bash
# Stop current server (Ctrl+C)
# Then restart:
npm start
```

### 2. Reload the App

- **Android:** Press `r` in terminal or shake device → Reload
- **iOS:** Press `r` in terminal or Cmd+R in simulator
- **Expo Go:** Shake device → Reload

---

## 🧪 Testing Checklist

### ✅ Basic Functionality

#### Marketplace Selection
- [ ] Marketplace tabs appear at the top
- [ ] Can switch between marketplaces
- [ ] Active marketplace is highlighted
- [ ] Status indicators show (idle/importing/completed/error)

#### Product Listing
- [ ] Products load correctly
- [ ] Product cards show: image, name, SKU, stock, price, status
- [ ] Smooth scrolling
- [ ] Pull-to-refresh works
- [ ] Pagination works (Previous/Next buttons)

#### Filtering
- [ ] SKU filter works (300ms debounce)
- [ ] Name filter works (300ms debounce)
- [ ] Clear filters button works
- [ ] Results update correctly

#### Selection
- [ ] Can select individual products (checkbox)
- [ ] Select all works
- [ ] Deselect all works
- [ ] Selection count displays
- [ ] Selection bar appears when items selected

### ✅ Bind Massal Feature

- [ ] "Bind" button appears when products selected
- [ ] Modal opens with correct UI
- [ ] Can choose "Master Barang" or "Bundling"
- [ ] Selected count displays correctly
- [ ] "Bind Sekarang" button triggers API call
- [ ] Loading indicator shows
- [ ] Success message appears (toast notification)
- [ ] Modal closes after completion
- [ ] Product list refreshes

### ✅ Migration Feature

- [ ] "Migrate" button appears when products selected
- [ ] Modal opens with correct UI
- [ ] Can select target marketplace (horizontal scroll)
- [ ] Can upload twibbon image
- [ ] Can remove twibbon
- [ ] "Migrate Sekarang" button starts migration
- [ ] Progress bar appears and updates
- [ ] Success/failed counts display
- [ ] Current item shows during processing
- [ ] Completion message appears
- [ ] Modal closes after completion

### ✅ Progress Tracking

- [ ] Import progress polls automatically (3s interval)
- [ ] Progress indicators on marketplace tabs
- [ ] Migration progress updates in real-time (2s interval)
- [ ] Progress bar shows percentage

---

## 🐛 Troubleshooting

### Error: Module not found
**Solution:** Restart the development server and reload the app

### Flash messages not appearing
**Check:** FlashMessage component is in App.tsx (✅ already added)

### Image picker crashes
**Check:** Permissions granted for photo library access

### API errors (404, 500)
**Check:**
- Backend server is running
- Correct API endpoints
- Valid authentication token
- Network connection

---

## 📱 Test Scenarios

### Scenario 1: Bind Products to Master Barang
1. Select marketplace with products
2. Select 3-5 products
3. Click "Bind" button
4. Choose "Master Barang"
5. Click "Bind Sekarang"
6. **Expected:** Success message with count

### Scenario 2: Migrate Products with Twibbon
1. Select marketplace with products
2. Select 2-3 products
3. Click "Migrate" button
4. Select target marketplace
5. Upload a twibbon image
6. Click "Migrate Sekarang"
7. **Expected:** Progress bar updates, completion message

### Scenario 3: Filter and Select
1. Enter SKU in filter
2. Wait 300ms
3. **Expected:** Filtered results
4. Select all filtered products
5. **Expected:** Selection count matches filtered count

---

## ✅ Success Criteria

- ✅ No crashes
- ✅ Smooth UI/UX
- ✅ API calls succeed
- ✅ Toast notifications appear
- ✅ Loading states visible
- ✅ Error handling works

---

## 📊 Performance Check

- **Scrolling:** Should be smooth with 100+ products
- **Filter debounce:** 300ms delay before API call
- **Polling:** Background updates without UI lag

---

**Ready to test! 🎉**

If you encounter issues, check console logs for error details.

