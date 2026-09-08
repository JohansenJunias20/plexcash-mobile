/**
 * Transform technical backend error messages into user-friendly messages.
 * Exact port from web Plexseller (Pesanan.tsx)
 * Removes transaction IDs, database details, rollback status, and other technical information.
 *
 * @param errorMessage - Raw error message from backend
 * @returns User-friendly error message in Indonesian
 */
export function transformErrorMessage(errorMessage: any): string {
    if (!errorMessage) return "Terjadi kesalahan yang tidak diketahui";

    let rawMessage = "";
    if (typeof errorMessage === "object") {
        rawMessage = errorMessage.message || errorMessage.error || errorMessage.reason || JSON.stringify(errorMessage);
    } else {
        rawMessage = String(errorMessage);
    }

    // Remove transaction ID prefix [TX_xxxxx_xxxxx]
    let cleanMessage = rawMessage.replace(/\[TX_\d+_[a-z0-9]+\]\s*/gi, '');

    // Remove "Transaction failed:" prefix
    cleanMessage = cleanMessage.replace(/Transaction failed:\s*/gi, '');

    // Remove "Rollback succeeded" or "Rollback FAILED" suffix
    cleanMessage = cleanMessage.replace(/\.\s*Rollback\s+(succeeded|FAILED)\s*$/gi, '');

    // Specific error mapping: Logistics booking order failure (Shopee pickup)
    if (cleanMessage.includes("logistics.error_booking_order")) {
        return "⚠️ Gagal booking pickup: Kurir tidak bisa menjemput pesanan ini (error_booking_order).";
    }

    // Pattern 1: Foreign key constraint errors (database technical errors)
    if (cleanMessage.match(/foreign key constraint fails|Cannot add or update a child row/i)) {
        return "Terjadi kesalahan sistem. Silakan coba lagi atau hubungi admin.";
    }

    // Pattern 2: Product not found in master barang
    const productNotFoundMatch = cleanMessage.match(/tidak menemukan barang dengan sku:\s*([^,]+),\s*nama:\s*([^\.]+)/i);
    if (productNotFoundMatch) {
        const sku = productNotFoundMatch[1].trim();
        return `Produk ${sku} tidak ditemukan di Master Barang. Silakan tambahkan produk terlebih dahulu.`;
    }

    // Pattern 3: Stock insufficient
    const stockInsufficientMatch = cleanMessage.match(/stok barang\s+([^\s]+)\s+tidak mencukupi/i);
    if (stockInsufficientMatch) {
        const sku = stockInsufficientMatch[1].trim();
        return `Stok ${sku} tidak mencukupi. Silakan update stok terlebih dahulu.`;
    }

    // Pattern 4: Generic "Tidak bisa membuat penjualan" errors
    if (cleanMessage.match(/Tidak bisa membuat penjualan/i)) {
        // Extract the core reason after "Alasan:"
        const reasonMatch = cleanMessage.match(/Alasan:\s*(.+?)(?:\.|$)/i);
        if (reasonMatch) {
            return reasonMatch[1].trim();
        }
        return `Tidak bisa membuat penjualan. Silakan periksa data pesanan: ${cleanMessage}`;
    }

    // Pattern 5: Database name in error (e.g., `database@email.com`.`table`)
    cleanMessage = cleanMessage.replace(/`[^`]*@[^`]*`\./g, '');

    // Pattern 6: SQL-related errors
    if (cleanMessage.match(/SQL|query|database|table|column/i)) {
        return "Terjadi kesalahan database. Silakan coba lagi atau hubungi admin.";
    }

    // Pattern 7: Network/timeout errors
    if (cleanMessage.match(/timeout|network|connection/i)) {
        return "Koneksi terputus. Silakan coba lagi.";
    }

    // Pattern 8: Generic catch-all - if message is too long or contains technical terms
    if (cleanMessage.length > 200 || cleanMessage.match(/Error:|Exception:|Stack trace:/i)) {
        return "Terjadi kesalahan. Silakan coba lagi atau hubungi admin.";
    }

    // Return cleaned message if it's already user-friendly
    return cleanMessage.trim();
}
