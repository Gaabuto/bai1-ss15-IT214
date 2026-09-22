/**
 * Mo phong co che Two-Phase Commit (2PC) cho quy trinh dat ve tau hoa.
 *
 * Coordinator:      dieu phoi giao dich giua 2 dich vu
 * TrainService:     giu cho ve tau      (Participant 1)
 * WalletService:     tru tien vi dien tu (Participant 2)
 *
 * Quy trinh:
 *   Phase 1 (PREPARE) : Coordinator hoi tung participant "co san sang COMMIT khong?"
 *                        Moi participant tra loi READY hoac ABORT.
 *   Phase 2 (DECIDE)   : - Neu TAT CA participant tra loi READY  -> gui COMMIT cho tat ca.
 *                        - Neu CO IT NHAT MOT participant ABORT  -> gui ROLLBACK cho TAT CA
 *                          participant (khong chi rieng participant bi loi).
 */

// ----------------------------------------------------------------------------
// PARTICIPANT 1: TrainService - giu cho ve tau
// ----------------------------------------------------------------------------
const TrainService = {
    name: "TrainService",

    // Gia lap: SE5 con du cho trong (seatAvailable = true)
    seatAvailable: true,

    prepare(bookingData) {
        console.log(`  [TrainService]  PREPARE nhan booking ${bookingData.bookingId} (tau ${bookingData.trainCode})`);
        if (this.seatAvailable) {
            console.log(`  [TrainService]  -> giu cho tam thoi (hold seat) thanh cong => READY`);
            return "READY";
        }
        console.log(`  [TrainService]  -> het cho => ABORT`);
        return "ABORT";
    },

    commit(bookingData) {
        console.log(`  [TrainService]  COMMIT: xac nhan giu cho vinh vien cho booking ${bookingData.bookingId}`);
    },

    rollback(bookingData) {
        console.log(`  [TrainService]  ROLLBACK: huy giu cho tam thoi, tra lai ghe cho booking ${bookingData.bookingId}`);
    },
};

// ----------------------------------------------------------------------------
// PARTICIPANT 2: WalletService - tru tien vi dien tu
// ----------------------------------------------------------------------------
const WalletService = {
    name: "WalletService",

    // So du gia lap cho vi W-456 (thay doi de tao kich ban thanh cong / that bai)
    balances: {
        "W-456": 5000000,
    },

    prepare(bookingData) {
        const balance = this.balances[bookingData.customerWalletId] ?? 0;
        console.log(`  [WalletService] PREPARE nhan yeu cau tru ${bookingData.price} tu vi ${bookingData.customerWalletId} (so du hien tai: ${balance})`);
        if (balance >= bookingData.price) {
            console.log(`  [WalletService] -> khoa tam thoi so tien ${bookingData.price} => READY`);
            return "READY";
        }
        console.log(`  [WalletService] -> khong du tien => ABORT`);
        return "ABORT";
    },

    commit(bookingData) {
        this.balances[bookingData.customerWalletId] -= bookingData.price;
        console.log(`  [WalletService] COMMIT: tru ${bookingData.price} khoi vi ${bookingData.customerWalletId}, so du con lai: ${this.balances[bookingData.customerWalletId]}`);
    },

    rollback(bookingData) {
        console.log(`  [WalletService] ROLLBACK: mo khoa so tien da giu, khong tru tien cua vi ${bookingData.customerWalletId}`);
    },
};

// ----------------------------------------------------------------------------
// COORDINATOR - dieu phoi giao dich 2PC
// ----------------------------------------------------------------------------
function coordinator(bookingData) {
    const participants = [TrainService, WalletService];

    console.log(`\n=== COORDINATOR: bat dau giao dich cho booking ${bookingData.bookingId} ===`);

    // ---------- PHASE 1: PREPARE ----------
    console.log(`\n[Phase 1] Gui PREPARE den tat ca participant:`);
    const votes = [];
    for (const participant of participants) {
        const vote = participant.prepare(bookingData);
        votes.push({ participant, vote });
    }

    // ---------- PHASE 2: QUYET DINH ----------
    const hasAbort = votes.some(v => v.vote === "ABORT");

    if (hasAbort) {
        console.log(`\n[Phase 2] Phat hien it nhat 1 participant ABORT => gui ROLLBACK den TAT CA participant:`);
        for (const participant of participants) {
            participant.rollback(bookingData);
        }
        console.log(`\n=== KET QUA: GIAO DICH THAT BAI - booking ${bookingData.bookingId} da bi ROLLBACK ===\n`);
        return { status: "ROLLED_BACK", bookingId: bookingData.bookingId };
    }

    console.log(`\n[Phase 2] Tat ca participant deu READY => gui COMMIT den tat ca:`);
    for (const participant of participants) {
        participant.commit(bookingData);
    }
    console.log(`\n=== KET QUA: GIAO DICH THANH CONG - booking ${bookingData.bookingId} da duoc COMMIT ===\n`);
    return { status: "COMMITTED", bookingId: bookingData.bookingId };
}

// ----------------------------------------------------------------------------
// DU LIEU DAU VAO & CHAY THU
// ----------------------------------------------------------------------------
const bookingInput = {
    bookingId: "TRAIN-2024-089",
    trainCode: "SE5",
    customerWalletId: "W-456",
    price: 1200000,
};

console.log("##########################################################");
console.log("# KICH BAN 1: Vi du tien (5.000.000) -> ky vong COMMIT     #");
console.log("##########################################################");
const result1 = coordinator(bookingInput);
console.log("Ket qua tra ve tu coordinator():", JSON.stringify(result1));

console.log("\n##########################################################");
console.log("# KICH BAN 2: Vi khong du tien (800.000) -> ky vong ROLLBACK #");
console.log("##########################################################");
WalletService.balances["W-456"] = 800000; // gia lap vi khong du tien
const result2 = coordinator(bookingInput);
console.log("Ket qua tra ve tu coordinator():", JSON.stringify(result2));
