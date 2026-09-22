# Bao cao phan tich: Mo phong Two-Phase Commit (2PC) trong dat ve tau hoa

**Mon hoc:** IT214 - Session 15 - Bai 1
**Tac gia:** Gaabuto

---

## 1. Boi canh va bai toan

Khi mot khach hang dat ve tau, giao dich thuc chat lien quan den **hai dich vu doc lap**,
moi dich vu co du lieu va co so du lieu rieng:

| Dich vu | Trach nhiem | Hanh dong can thuc hien |
|---|---|---|
| **TrainService** | Quan ly cho ngoi tren tau | Giu cho (hold seat) cho booking |
| **WalletService** | Quan ly vi dien tu cua khach hang | Tru tien thanh toan ve |

Neu chi goi tuan tu hai service ma khong co co che dieu phoi, he thong se roi vao trang thai
**khong nhat quan** khi mot trong hai buoc that bai. Vi du: da giu cho tau thanh cong nhung
vi khong du tien de tru -> khach hang co cho nhung khong tra tien (hoac nguoc lai, tru tien
roi nhung het cho -> mat tien oan). Day chinh la ly do can mot **giao dich phan tan (distributed
transaction)** duoc dieu phoi boi mot **Coordinator** theo giao thuc **Two-Phase Commit (2PC)**.

## 2. Mo ta quy trinh 2PC duoc mo phong

2PC gom **mot Coordinator** va **cac Participant** (o day la `TrainService` va `WalletService`),
van hanh qua 2 pha:

### Pha 1 - PREPARE (bo phieu)

Coordinator gui lenh `PREPARE` den **tung** participant kem theo du lieu giao dich
(`bookingData`). Moi participant tu kiem tra dieu kien nghiep vu cua rieng minh **nhung chua
thuc thi thay doi that su** (chi "khoa tam thoi" tai nguyen), roi tra loi mot trong hai trang
thai:

- **READY** - san sang commit (VD: `TrainService` con cho trong; `WalletService` du so du).
- **ABORT** - khong the thuc hien (VD: het cho; vi khong du tien).

Coordinator thu thap **tat ca** phan hoi truoc khi sang pha 2 (khong quyet dinh som).

### Pha 2 - COMMIT hoac ROLLBACK (quyet dinh)

Coordinator tong hop toan bo phieu bau roi ra quyet dinh theo nguyen tac **"tat ca hoac
khong"** (all-or-nothing):

- **Neu TAT CA participant deu tra loi `READY`** -> Coordinator gui lenh `COMMIT` den tat ca
  participant. Moi participant thuc thi that su thay doi (giu cho vinh vien / tru tien that su).
- **Neu CO IT NHAT MOT participant tra loi `ABORT`** -> Coordinator gui lenh `ROLLBACK` den
  **TAT CA** participant da tham gia (khong chi rieng participant bi loi), de dam bao khong
  co ben nao giu lai thay doi mot phan (vi du: `TrainService` da giu cho nhung `WalletService`
  bi loi thi cho tau giu tam thoi cung phai duoc tra lai).

So do luong xu ly:

```
        Coordinator
             |
   +----PREPARE----+
   |               |
TrainService   WalletService
   |               |
 READY/ABORT   READY/ABORT
   |               |
   +-------+-------+
           |
   Tat ca READY?  --- Khong ---> ROLLBACK toi tat ca participant
           |
          Co
           |
   COMMIT toi tat ca participant
```

## 3. Ma gia (pseudocode) cho ham `coordinator(bookingData)`

File nguon day du: [`coordinator-2pc.js`](coordinator-2pc.js) (chay duoc bang Node.js de kiem
chung dung output). Phan cot loi:

```js
function coordinator(bookingData) {
    const participants = [TrainService, WalletService];

    // ---------- PHASE 1: PREPARE ----------
    const votes = [];
    for (const participant of participants) {
        const vote = participant.prepare(bookingData);   // "READY" | "ABORT"
        votes.push({ participant, vote });
    }

    // ---------- PHASE 2: QUYET DINH ----------
    const hasAbort = votes.some(v => v.vote === "ABORT");

    if (hasAbort) {
        // Co it nhat 1 participant ABORT -> ROLLBACK toan bo, khong chi rieng ben loi
        for (const participant of participants) {
            participant.rollback(bookingData);
        }
        return { status: "ROLLED_BACK", bookingId: bookingData.bookingId };
    }

    // Tat ca deu READY -> COMMIT toan bo
    for (const participant of participants) {
        participant.commit(bookingData);
    }
    return { status: "COMMITTED", bookingId: bookingData.bookingId };
}
```

`TrainService` va `WalletService` moi ben deu cai dat 3 ham theo dung hop dong cua mot
participant trong 2PC: `prepare()` (kiem tra + khoa tam thoi), `commit()` (thuc thi that su),
`rollback()` (huy khoa, khong ap dung thay doi).

## 4. Ket qua chay thu

### Kich ban 1 - Du lieu dau vao cua de bai (vi du du tien, 5.000.000 VND)

```json
{
  "bookingId": "TRAIN-2024-089",
  "trainCode": "SE5",
  "customerWalletId": "W-456",
  "price": 1200000
}
```

**Output mong doi / thuc te (khop 100%):**

```
=== COORDINATOR: bat dau giao dich cho booking TRAIN-2024-089 ===

[Phase 1] Gui PREPARE den tat ca participant:
  [TrainService]  PREPARE nhan booking TRAIN-2024-089 (tau SE5)
  [TrainService]  -> giu cho tam thoi (hold seat) thanh cong => READY
  [WalletService] PREPARE nhan yeu cau tru 1200000 tu vi W-456 (so du hien tai: 5000000)
  [WalletService] -> khoa tam thoi so tien 1200000 => READY

[Phase 2] Tat ca participant deu READY => gui COMMIT den tat ca:
  [TrainService]  COMMIT: xac nhan giu cho vinh vien cho booking TRAIN-2024-089
  [WalletService] COMMIT: tru 1200000 khoi vi W-456, so du con lai: 3800000

=== KET QUA: GIAO DICH THANH CONG - booking TRAIN-2024-089 da duoc COMMIT ===

Ket qua tra ve tu coordinator(): {"status":"COMMITTED","bookingId":"TRAIN-2024-089"}
```

Ca hai participant deu `READY` (con cho + du tien) nen Coordinator gui `COMMIT` cho ca hai:
ve duoc giu that su, tien duoc tru that su.

### Kich ban 2 - Vi khong du tien (800.000 VND < gia ve 1.200.000 VND)

Giu nguyen `bookingData`, chi thay doi so du gia lap cua vi `W-456` de mo phong dieu kien
loi ma de bai yeu cau ("neu mot trong hai dich vu tra ve Abort").

**Output thuc te:**

```
=== COORDINATOR: bat dau giao dich cho booking TRAIN-2024-089 ===

[Phase 1] Gui PREPARE den tat ca participant:
  [TrainService]  PREPARE nhan booking TRAIN-2024-089 (tau SE5)
  [TrainService]  -> giu cho tam thoi (hold seat) thanh cong => READY
  [WalletService] PREPARE nhan yeu cau tru 1200000 tu vi W-456 (so du hien tai: 800000)
  [WalletService] -> khong du tien => ABORT

[Phase 2] Phat hien it nhat 1 participant ABORT => gui ROLLBACK den TAT CA participant:
  [TrainService]  ROLLBACK: huy giu cho tam thoi, tra lai ghe cho booking TRAIN-2024-089
  [WalletService] ROLLBACK: mo khoa so tien da giu, khong tru tien cua vi W-456

=== KET QUA: GIAO DICH THAT BAI - booking TRAIN-2024-089 da bi ROLLBACK ===

Ket qua tra ve tu coordinator(): {"status":"ROLLED_BACK","bookingId":"TRAIN-2024-089"}
```

Diem mau chot: mac du `TrainService` tra loi `READY` (van con cho), Coordinator van gui
`ROLLBACK` cho **ca `TrainService` lan `WalletService`**, dung theo yeu cau (b) cua de bai -
khong duoc chi rollback rieng dich vu bi loi, ma phai rollback toan bo cac dich vu da tham gia
de tranh cho tau bi giu "ao" trong khi khach khong thanh toan duoc.

## 5. Giai thich cach chuong trinh quyet dinh COMMIT hay ROLLBACK

Coordinator luu toan bo phieu bau (`votes`) tu pha PREPARE truoc khi ra quyet dinh, ap dung
dung ngu nghia ACID **atomicity** cho giao dich phan tan:

1. **Khong quyet dinh som**: du `TrainService` tra loi truoc va la `READY`, Coordinator van
   phai doi `WalletService` phan hoi roi moi xet toan cuc.
2. **Dieu kien COMMIT**: chi khi `votes.every(v => v.vote === "READY")` (tuong duong
   `!hasAbort`) - tuc **100% participant dong y** - Coordinator moi phat lenh `COMMIT`.
3. **Dieu kien ROLLBACK**: chi can `votes.some(v => v.vote === "ABORT")` - tuc **it nhat 1
   phieu ABORT** - la du de Coordinator huy toan bo giao dich, bat ke cac participant con lai
   co dong y hay khong.
4. **Pham vi ap dung lenh quyet dinh**: ca `COMMIT` lan `ROLLBACK` deu duoc gui **dong loat
   den tat ca participant** (khong phai chi rieng ben "co van de") de dam bao trang thai cuoi
   cung dong nhat giua `TrainService` va `WalletService` - hoac ca hai cung thanh cong, hoac
   ca hai cung khong co gi thay doi.

Nho co che nay, he thong dat ve tau tranh duoc tinh trang du lieu "nua vac nua chai" (mot ben
da tru tien nhung ben kia mat cho, hoac nguoc lai) du hai dich vu chay hoan toan doc lap.
