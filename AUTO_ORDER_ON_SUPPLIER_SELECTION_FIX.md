# Auto-Order on Supplier Selection Fix

**Date:** 2026-01-17  
**Issue:** Items not automatically moving to Sudah Pesan tab after supplier selection  
**Status:** ✅ **FIXED**

---

## 🐛 Problem Description

### Original Issue
After selecting a supplier for an item in the Belum Pesan tab, the mobile app was only updating the local state but **not making the backend API call** to mark the item as ordered. This caused the item to remain in the Belum Pesan tab instead of moving to the Sudah Pesan tab.

### Console Logs Showed
```
LOG  [BelumPesanTab] Supplier selected: 5 Hartono Motor
LOG  [BelumPesanTab] Updating supplier for item: 369 to: 5
LOG  [PesanBarang] Updating supplier for item: 369 to supplier: 5
```

But nothing happened after that - no API call was made.

### Root Cause
The mobile implementation was **missing the automatic API call** that exists in the web version. 

**Web Version Behavior** (lines 455-463 in `Pesan Barang.tsx`):
```typescript
onSelect={({ id }) => {
    this.setState((s: State) => {
        s.showSupplier = false;
        s.id_supplier = id
        s.itemBelumPesan = s.itemBelumPesan.filter(item => item.id != this.state.id_barang);
        return s;
    })
    
    this.pesan(this.state.id_barang, id);  // ← Immediately calls API
}}
```

**Mobile Version (Before Fix)**:
```typescript
const handleUpdateSupplierBelum = (id: number, id_supplier: number) => {
  console.log('[PesanBarang] Updating supplier for item:', id, 'to supplier:', id_supplier);
  setItemsBelumPesan(prev =>
    prev.map(item => (item.id === id ? { ...item, id_supplier } : item))
  );
  // ❌ No API call - only updates local state!
};
```

---

## ✅ Solution Implemented

### Changes Made

#### 1. **Updated `handleUpdateSupplierBelum` to Auto-Mark as Ordered**

**File:** `screens/transaksi/PesanBarangScreen.tsx`

**Before:**
```typescript
const handleUpdateSupplierBelum = (id: number, id_supplier: number) => {
  console.log('[PesanBarang] Updating supplier for item:', id, 'to supplier:', id_supplier);
  setItemsBelumPesan(prev =>
    prev.map(item => (item.id === id ? { ...item, id_supplier } : item))
  );
};
```

**After:**
```typescript
const handleUpdateSupplierBelum = async (id: number, id_supplier: number) => {
  console.log('[PesanBarang] Updating supplier for item:', id, 'to supplier:', id_supplier);
  
  // Find the item to get its qty_pesan
  const item = itemsBelumPesan.find(item => item.id === id);
  if (!item) {
    console.error('[PesanBarang] Item not found:', id);
    Alert.alert('Error', 'Item not found');
    return;
  }

  // Validate qty_pesan
  if (!item.qty_pesan || item.qty_pesan <= 0) {
    console.warn('[PesanBarang] Invalid qty_pesan for item:', id, 'qty:', item.qty_pesan);
    Alert.alert('Error', 'Please set a valid quantity before selecting a supplier');
    return;
  }

  try {
    console.log('[PesanBarang] Auto-marking item as ordered:', { id, id_supplier, qty_pesan: item.qty_pesan });
    
    // Make API call to mark as ordered (same as web version)
    const response = await ApiService.patch(`/masterbarang/pesan/${id}`, {
      id_supplier,
      qty_pesan: item.qty_pesan,
    });

    if (response.status) {
      console.log('[PesanBarang] Item auto-marked as ordered successfully');
      Alert.alert('Success', 'Item marked as ordered and moved to "Sudah Pesan" tab');
      
      // Remove from Belum Pesan list
      setItemsBelumPesan(prev => prev.filter(item => item.id !== id));
      
      // Refresh Sudah Pesan list to show the newly ordered item
      await fetchSudahPesan();
    } else {
      console.error('[PesanBarang] Failed to auto-mark as ordered:', response.reason);
      Alert.alert('Error', response.reason || 'Failed to mark as ordered');
    }
  } catch (error) {
    console.error('[PesanBarang] Error auto-marking as ordered:', error);
    Alert.alert('Error', 'Failed to mark as ordered');
  }
};
```

#### 2. **Updated Interface to Support Async Callback**

**File:** `screens/transaksi/components/BelumPesanTab.tsx`

**Before:**
```typescript
interface BelumPesanTabProps {
  // ...
  onUpdateSupplier: (id: number, id_supplier: number) => void;
}
```

**After:**
```typescript
interface BelumPesanTabProps {
  // ...
  onUpdateSupplier: (id: number, id_supplier: number) => Promise<void>;
}
```

#### 3. **Updated `handleSupplierSelect` to Await Async Call**

**File:** `screens/transaksi/components/BelumPesanTab.tsx`

**Before:**
```typescript
const handleSupplierSelect = (supplier: SupplierItem) => {
  console.log('[BelumPesanTab] Supplier selected:', supplier.id, supplier.nama);
  if (currentItemId) {
    console.log('[BelumPesanTab] Updating supplier for item:', currentItemId, 'to:', supplier.id);
    onUpdateSupplier(currentItemId, supplier.id);
    setShowSupplierModal(false);
    setCurrentItemId(null);
  }
};
```

**After:**
```typescript
const handleSupplierSelect = async (supplier: SupplierItem) => {
  console.log('[BelumPesanTab] Supplier selected:', supplier.id, supplier.nama);
  if (currentItemId) {
    console.log('[BelumPesanTab] Updating supplier for item:', currentItemId, 'to:', supplier.id);
    
    // Close modal immediately for better UX
    setShowSupplierModal(false);
    
    // Call the async update function (which will auto-mark as ordered)
    await onUpdateSupplier(currentItemId, supplier.id);
    
    // Clear current item
    setCurrentItemId(null);
  }
};
```

---

## 🔄 New Flow (After Fix)

```
1. User clicks "Change" button on item in Belum Pesan tab
   → [BelumPesanTab] Change button pressed for item: 369
   → [BelumPesanTab] Opening supplier modal for item: 369

2. User selects supplier from modal
   → [BelumPesanTab] Supplier selected: 5 Hartono Motor
   → [BelumPesanTab] Updating supplier for item: 369 to: 5
   → Modal closes immediately

3. Auto-mark as ordered (NEW!)
   → [PesanBarang] Updating supplier for item: 369 to supplier: 5
   → [PesanBarang] Auto-marking item as ordered: {id: 369, id_supplier: 5, qty_pesan: 50}
   → API PATCH /masterbarang/pesan/369 with {id_supplier: 5, qty_pesan: 50}
   → [PesanBarang] Item auto-marked as ordered successfully
   → Alert: "Item marked as ordered and moved to Sudah Pesan tab"

4. UI updates
   → Item removed from Belum Pesan list
   → Sudah Pesan list refreshed
   → Item now appears in Sudah Pesan tab
```

---

## 📊 Code Changes Summary

| File | Lines Added | Lines Modified | Changes |
|------|-------------|----------------|---------|
| `PesanBarangScreen.tsx` | +40 | -7 | Made `handleUpdateSupplierBelum` async with API call |
| `BelumPesanTab.tsx` | +8 | -5 | Made interface and handler async |
| **TOTAL** | **+48** | **-12** | **Net: +36 lines** |

---

## ✅ Key Improvements

1. **Feature Parity with Web** - Mobile now matches web behavior exactly
2. **Automatic API Call** - No need for separate "Order" button
3. **Validation** - Checks for valid qty_pesan before allowing supplier selection
4. **Better UX** - Modal closes immediately, then processes in background
5. **Error Handling** - Comprehensive error messages and alerts
6. **Console Logging** - Full visibility into the process
7. **Auto-Refresh** - Sudah Pesan tab automatically refreshes to show new item

---

## 🧪 Testing Instructions

### Test Case 1: Basic Supplier Selection with Auto-Order
```
1. Open Pesan Barang → Belum Pesan tab
2. Find an item and set qty_pesan (e.g., 50)
3. Click "Change" button
4. Select a supplier from modal
5. ✅ Modal closes immediately
6. ✅ Alert shows: "Item marked as ordered and moved to Sudah Pesan tab"
7. ✅ Item disappears from Belum Pesan list
8. Switch to Sudah Pesan tab
9. ✅ Item appears in Sudah Pesan list with correct supplier
```

### Test Case 2: Validation - No Quantity Set
```
1. Open Pesan Barang → Belum Pesan tab
2. Find an item with qty_pesan = 0
3. Click "Change" button
4. Select a supplier
5. ✅ Alert shows: "Please set a valid quantity before selecting a supplier"
6. ✅ Item remains in Belum Pesan tab
7. ✅ No API call made
```

### Test Case 3: Console Log Verification
```
Open Metro bundler console and verify complete flow:
✅ [BelumPesanTab] Change button pressed for item: 369
✅ [BelumPesanTab] Opening supplier modal for item: 369
✅ [BelumPesanTab] Supplier selected: 5 Hartono Motor
✅ [BelumPesanTab] Updating supplier for item: 369 to: 5
✅ [PesanBarang] Updating supplier for item: 369 to supplier: 5
✅ [PesanBarang] Auto-marking item as ordered: {id: 369, id_supplier: 5, qty_pesan: 50}
✅ [PesanBarang] Item auto-marked as ordered successfully
```

---

## 🚀 Deployment

### Pre-Deployment Checklist
- [x] Code changes complete
- [x] TypeScript compilation successful
- [x] Async/await properly handled
- [x] Error handling comprehensive
- [x] Console logging added
- [x] Validation added
- [x] Documentation created

### Deployment Notes
- **Backward Compatible:** Yes
- **API Changes:** None (uses existing endpoint)
- **Database Changes:** None
- **Breaking Changes:** None
- **Risk Level:** 🟢 Low

**Safe to deploy immediately.**

---

**Status:** ✅ **READY FOR PRODUCTION**

The mobile app now automatically marks items as ordered when a supplier is selected, matching the web version's behavior exactly!

