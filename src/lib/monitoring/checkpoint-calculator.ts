/**
 * ===================================================================
 * HELPER: CHECKPOINT CALCULATOR
 * ===================================================================
 * Mô tả:
 * Tính toán checkpoint (D+1, D+3, D+7) dựa trên ngày thực thi.
 * Xác định có cần ghi observation tại thời điểm hiện tại không.
 * 
 * Logic:
 * - D+1: 1 ngày sau execution
 * - D+3: 3 ngày sau execution  
 * - D+7: 7 ngày sau execution (cuối cùng)
 * 
 * Sử dụng:
 * const checkpoint = calculateCheckpoint('2026-02-01T10:00:00Z');
 * // Returns: 'D1' | 'D3' | 'D7' | null
 * 
 * Tác giả: AI Campaign Guardian System
 * Ngày tạo: 2026-02-05
 * ===================================================================
 */

// ===================================================================
// TYPES
// ===================================================================

export type Checkpoint = 'D1' | 'D3' | 'D7';

// ===================================================================
// MAIN FUNCTION
// ===================================================================

/**
 * Tính checkpoint cần ghi observation
 * 
 * @param executedDateString - ISO date string của thời điểm thực thi
 * @returns Checkpoint cần ghi, hoặc null nếu chưa đến checkpoint nào
 */
export function calculateCheckpoint(executedDateString: string): Checkpoint | null {
    const executedDate = new Date(executedDateString);
    const now = new Date();

    // Calculate days difference
    const diffMs = now.getTime() - executedDate.getTime();
    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Determine checkpoint based on days passed
    // We check in order: D7 → D3 → D1
    // Trả về checkpoint gần nhất mà đã đến

    if (daysPassed >= 7) {
        return 'D7';
    } else if (daysPassed >= 3) {
        return 'D3';
    } else if (daysPassed >= 1) {
        return 'D1';
    }

    return null; // Chưa đến checkpoint nào
}

/**
 * Check xem đã đến checkpoint cụ thể chưa
 * 
 * @param executedDateString - ISO date string
 * @param targetCheckpoint - Checkpoint muốn check
 * @returns true nếu đã đến checkpoint này
 */
export function hasReachedCheckpoint(
    executedDateString: string,
    targetCheckpoint: Checkpoint
): boolean {
    const executedDate = new Date(executedDateString);
    const now = new Date();

    const diffMs = now.getTime() - executedDate.getTime();
    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const requiredDays = targetCheckpoint === 'D1' ? 1 : targetCheckpoint === 'D3' ? 3 : 7;

    return daysPassed >= requiredDays;
}

/**
 * Lấy tất cả checkpoints đã qua
 * 
 * @param executedDateString - ISO date string
 * @returns Array các checkpoint đã qua
 */
export function getAllPassedCheckpoints(executedDateString: string): Checkpoint[] {
    const executedDate = new Date(executedDateString);
    const now = new Date();

    const diffMs = now.getTime() - executedDate.getTime();
    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const passed: Checkpoint[] = [];

    if (daysPassed >= 1) passed.push('D1');
    if (daysPassed >= 3) passed.push('D3');
    if (daysPassed >= 7) passed.push('D7');

    return passed;
}

/**
 * Lấy checkpoint tiếp theo cần ghi
 * 
 * @param executedDateString - ISO date string
 * @param recordedCheckpoints - Array checkpoints đã ghi
 * @returns Checkpoint tiếp theo, hoặc null nếu đã hoàn thành
 */
export function getNextCheckpoint(
    executedDateString: string,
    recordedCheckpoints: Checkpoint[]
): Checkpoint | null {
    const allPassed = getAllPassedCheckpoints(executedDateString);

    // Tìm checkpoint đã qua nhưng chưa record
    const pending = allPassed.filter(cp => !recordedCheckpoints.includes(cp));

    if (pending.length === 0) return null;

    // Return checkpoint sớm nhất chưa record
    const order: Checkpoint[] = ['D1', 'D3', 'D7'];
    for (const cp of order) {
        if (pending.includes(cp)) {
            return cp;
        }
    }

    return null;
}

/**
 * Calculate số ngày còn lại đến checkpoint tiếp theo
 * 
 * @param executedDateString - ISO date string
 * @param currentCheckpoint - Checkpoint hiện tại (đã record)
 * @returns Số ngày còn lại, hoặc 0 nếu đã hết
 */
export function daysUntilNextCheckpoint(
    executedDateString: string,
    currentCheckpoint: Checkpoint | null
): number {
    const executedDate = new Date(executedDateString);
    const now = new Date();

    const diffMs = now.getTime() - executedDate.getTime();
    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (!currentCheckpoint) {
        // Chưa có checkpoint nào → next là D1
        return Math.max(0, 1 - daysPassed);
    }

    if (currentCheckpoint === 'D1') {
        return Math.max(0, 3 - daysPassed);
    }

    if (currentCheckpoint === 'D3') {
        return Math.max(0, 7 - daysPassed);
    }

    // D7 là cuối cùng
    return 0;
}
