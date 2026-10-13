// Nội dung bảng "Giải thích" (trang giám sát chuyền treo). Song ngữ VI | EN.
// Mỗi mục: name / meaning / formula / use (chữ) + vars (biến) + live(c) = ví dụ tính bằng số ĐANG XEM.
// c (giam-sat.html gtCtx): L = kết quả lineStatus chuyền đang chọn, cfg, st (ngưỡng), OP (công đoạn mẫu), W (công nhân mẫu),
//   n(v, d) số kiểu vi-VN, p(v) phần trăm, hm(giây) giờ hh:mm, none (dòng báo chưa có dữ liệu).
// Sửa công thức ở phan-tich.js thì sửa lại mục tương ứng ở đây.
(function (root) {
  const tx = (vi, en) => ({ vi, en });
  const groups = [
    { id: 'kh', name: tx('Khái niệm nền', 'Basics') },
    { id: 'w', name: tx('Công nhân', 'Operator') },
    { id: 'op', name: tx('Công đoạn', 'Operation') },
    { id: 'line', name: tx('Cả chuyền', 'Whole line') },
    { id: 'bal', name: tx('Cân bằng chuyền & takt', 'Line balance & takt') },
    { id: 'bn', name: tx('Tắc nghẽn & trạng thái', 'Bottleneck & status') },
    { id: 'thr', name: tx('Ngưỡng trạng thái (⚙ Cài đặt)', 'Status thresholds (⚙ Settings)') },
  ];

  const items = [
    // ---------- Khái niệm nền ----------
    { id: 'sam', g: 'kh', key: 'sam',
      name: tx('SAM (phút/sp)', 'SAM (min/pc)'),
      meaning: tx('Thời gian chuẩn để làm 1 sản phẩm ở 1 công đoạn, do bộ phận IE xác định.', 'Standard time to make 1 piece at 1 operation, set by IE.'),
      formula: tx('SAM lấy theo thứ tự ưu tiên:\n1. SAM nhập tay (⚙ Cài đặt → SAM nhập tay)\n2. File IE (sheet SAM), theo mã công đoạn\n3. SAM ghi trên phiếu ETS', 'SAM priority:\n1. Manual SAM (⚙ Settings → manual SAM)\n2. IE file (SAM sheet), matched by operation code\n3. SAM on the ETS ticket'),
      use: tx('Là chuẩn để so mọi công nhân và công đoạn: làm đúng SAM = 100%. Mọi chỉ số hiệu suất đều quy về SAM.', 'The yardstick for every operator and operation: working exactly to SAM = 100%. All efficiency figures are based on SAM.'),
      example: tx('May cổ SAM 0,50 phút/sp: làm 1 sp mất 0,5 phút chuẩn.', 'Neck sewing SAM 0.50 min/pc: 1 piece = 0.5 standard minutes.'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        return [tx(`Công đoạn ${O.op}${O.name ? ' ' + O.name : ''}: SAM ${c.n(O.sam, 3)} phút/sp (nguồn: ${O.samSrc || '–'})`, `Operation ${O.op}${O.name ? ' ' + O.name : ''}: SAM ${c.n(O.sam, 3)} min/pc (source: ${O.samSrc || '–'})`)]; } },

    { id: 'earned', g: 'kh', key: null,
      name: tx('Phút chuẩn', 'Standard minutes (earned)'),
      meaning: tx('Thời gian chuẩn mà sản lượng đã làm ra được, cộng qua mọi công đoạn người đó làm trong ngày.', 'Standard time earned by the output made, summed over every operation the person worked on today.'),
      formula: tx('Phút chuẩn = Σ (SL × SAM) của từng phiếu trong ngày', 'Standard minutes = Σ (output × SAM) over the day\'s tickets'),
      use: tx('Là đại lượng gốc: từ đây ra SAH, %EFF công nhân và hiệu suất chuyền.', 'The base quantity: SAH, operator %EFF and line efficiency all come from it.'),
      example: tx('Làm 300 sp SAM 0,5 + 50 sp SAM 0,3 = 150 + 15 = 165 phút chuẩn.', '300 pcs at SAM 0.5 + 50 pcs at SAM 0.3 = 150 + 15 = 165 standard min.'),
      live: c => { if (!c.W) return c.none; const W = c.W;
        return [tx(`${W.name || W.emp}: ${c.n(W.earned, 1)} phút chuẩn hôm nay`, `${W.name || W.emp}: ${c.n(W.earned, 1)} standard min today`)]; } },

    { id: 'sah', g: 'kh', key: null,
      name: tx('SAH (giờ chuẩn)', 'SAH (standard allowed hours)'),
      meaning: tx('Phút chuẩn đổi ra giờ. Cách tính của nhà máy: "số giờ làm việc mà sản lượng đó đáng giá theo SAM".', 'Standard minutes converted to hours. The factory\'s measure: "how many working hours the output is worth at SAM".'),
      formula: tx('SAH = Phút chuẩn ÷ 60', 'SAH = Standard minutes ÷ 60'),
      use: tx('Đơn vị chung để cộng người và công đoạn, và so với giờ làm thực tế. 1 người làm đúng 100% SAM trong 8 giờ thì được 8 SAH.', 'A common unit to add up people and operations and compare with actual hours. One person at exactly 100% SAM for 8 hours earns 8 SAH.'),
      example: tx('150 phút chuẩn = 2,5 SAH. Làm đủ 2,5 giờ thì hiệu suất 100%.', '150 standard min = 2.5 SAH. Working 2.5 hours gives 100% efficiency.'),
      live: c => { if (!c.W || !c.L) return c.none; const W = c.W, L = c.L;
        return [tx(`${W.name || W.emp}: ${c.n(W.earned, 1)} ÷ 60 = ${c.n(W.sah, 2)} SAH`, `${W.name || W.emp}: ${c.n(W.earned, 1)} ÷ 60 = ${c.n(W.sah, 2)} SAH`),
          tx(`Cả chuyền: ${c.n(L.sah, 1)} SAH`, `Whole line: ${c.n(L.sah, 1)} SAH`)]; } },

    { id: 'workh', g: 'kh', key: null,
      name: tx('Giờ đã làm và giờ làm cả ngày', 'Hours worked and day hours'),
      meaning: tx('Giờ đã làm: từ giờ vào ca tới giờ dữ liệu (lần đồng bộ ETS mới nhất), đã trừ giờ nghỉ. Giờ làm cả ngày: cả ca, đã trừ giờ nghỉ.', 'Hours worked: from shift start to the data time (latest ETS sync), breaks removed. Day hours: the whole shift, breaks removed.'),
      formula: tx('Giờ đã làm = (giờ dữ liệu − giờ vào ca − giờ nghỉ đã qua) ÷ 60\nGiờ cả ngày = (giờ tan ca − giờ vào ca − giờ nghỉ) ÷ 60', 'Hours worked = (data time − shift start − breaks passed) ÷ 60\nDay hours = (shift end − shift start − breaks) ÷ 60'),
      use: tx('Mẫu số của gần như mọi %EFF và sp/giờ; còn là cơ sở để chia kế hoạch theo giờ.', 'The denominator of almost every %EFF and pcs/h figure; also the basis for splitting the plan by hour.'),
      example: tx('Ca 7:30–20:30, nghỉ 11:35–12:35 và 16:30–17:00 → giờ cả ngày 11,5 giờ. Lúc 10:30 → giờ đã làm 3 giờ.', 'Shift 7:30–20:30, breaks 11:35–12:35 and 16:30–17:00 → day hours 11.5. At 10:30 → 3 hours worked.'),
      live: c => { if (!c.L) return c.none; const L = c.L;
        return [tx(`Giờ đã làm: ${c.n(L.workHours, 2)} giờ (tới ${c.hm(L.dataAt)}); giờ làm cả ngày: ${c.n(L.totalMin / 60, 2)} giờ`, `Hours worked: ${c.n(L.workHours, 2)} h (up to ${c.hm(L.dataAt)}); day hours: ${c.n(L.totalMin / 60, 2)} h`)]; } },

    { id: 'factor', g: 'kh', key: null,
      name: tx('Hệ số đường cong học', 'Learning-curve factor'),
      meaning: tx('Mã mới chưa đạt ngay hiệu suất mục tiêu. Hệ số giảm kế hoạch trong những ngày đầu chạy mã. Mức và % là số ước tính, sửa được trong ⚙ Cài đặt.', 'A new style does not reach the target efficiency on day 1. The factor lowers the plan for the first days. Levels and percentages are estimates, editable in ⚙ Settings.'),
      formula: tx('Hệ số = % của mức (Mã mới / Mã lặp lại) ứng với ngày thứ N của mã\nNgày thứ N đếm theo ngày làm việc (bỏ Chủ nhật), ngày bắt đầu mã = ngày 1', 'Factor = % of the level (New / Repeat style) for style day N\nDay N counts working days (Sundays excluded), the start day = day 1'),
      use: tx('Làm kế hoạch ngày và target theo SAM thực tế hơn cho mã mới: không đòi chuyền chạy 80% ngay từ ngày đầu.', 'Makes the daily plan and SAM-based target realistic for a new style: the line is not asked for 80% from day one.'),
      example: tx('Mã lặp lại, ngày 2: hệ số 0,85 → hiệu suất mục tiêu 80% × 0,85 = 68%.', 'Repeat style, day 2: factor 0.85 → target efficiency 80% × 0.85 = 68%.'),
      live: c => { if (!c.L || !c.L.styles || !c.L.styles.length) return c.none;
        return c.L.styles.map(s => tx(`Mã ${s.style}: ${s.day > 0 ? `ngày thứ ${s.day}` : 'chưa có ngày bắt đầu'}${s.level ? `, mức "${s.level}"` : ''} → hệ số ${c.n(s.factor, 2)}`,
          `Style ${s.style}: ${s.day > 0 ? `day ${s.day}` : 'no start date'}${s.level ? `, level "${s.level}"` : ''} → factor ${c.n(s.factor, 2)}`)); } },

    // ---------- Công nhân ----------
    { id: 'weff', g: 'w', key: 'w_eff',
      name: tx('%EFF công nhân', 'Operator %EFF'),
      meaning: tx('Người đó làm nhanh bằng bao nhiêu % so với SAM, tính trên tất cả công đoạn người đó làm.', 'How fast the operator works compared with SAM, across all operations they did.'),
      formula: tx('%EFF công nhân = SAH ÷ giờ đã làm', 'Operator %EFF = SAH ÷ hours worked'),
      vars: [['SAH', tx('Phút chuẩn ÷ 60, mọi công đoạn của người đó', 'Standard min ÷ 60, all of the operator\'s operations')], ['giờ đã làm', tx('Từ giờ vào ca tới giờ dữ liệu, trừ nghỉ', 'From shift start to data time, breaks removed')]],
      use: tx('Xem ai làm tốt, ai cần hỗ trợ. Màu chữ % trên thẻ sàn và bảng công nhân theo ngưỡng trong ⚙ Cài đặt.', 'See who is doing well and who needs help. The colour of the % on the floor tag and the operator table follows the thresholds in ⚙ Settings.'),
      example: tx('Lan làm 2,75 SAH trong 3 giờ → 2,75 ÷ 3 = 91,7%.', 'Lan made 2.75 SAH in 3 hours → 2.75 ÷ 3 = 91.7%.'),
      note: tx('Màu chữ (cài đặt): đỏ < 50%, vàng 50–60%, xanh dương 60–80%, tím ≥ 80%. Người không có SAM: chữ xám.', 'Colour (settings): red < 50%, yellow 50–60%, blue 60–80%, purple ≥ 80%. No SAM: grey.'),
      live: c => { if (!c.W || !c.L) return c.none; const W = c.W;
        return [tx(`${W.name || W.emp}: %EFF = ${c.n(W.sah, 2)} SAH ÷ ${c.n(W.workHours, 2)} giờ = ${c.p(W.eff)}`, `${W.name || W.emp}: %EFF = ${c.n(W.sah, 2)} SAH ÷ ${c.n(W.workHours, 2)} h = ${c.p(W.eff)}`),
          tx(`Màu: ${c.colorName(W.eff).vi}`, `Colour: ${c.colorName(W.eff).en}`)]; } },

    { id: 'wrate', g: 'w', key: 'w_rate',
      name: tx('sp/giờ công nhân', 'Operator pcs/h'),
      meaning: tx('Tốc độ ra hàng của 1 người, tính ở công đoạn chính của họ.', 'The output rate of 1 operator, at their main operation.'),
      formula: tx('sp/giờ = SL công đoạn chính ÷ giờ đã làm', 'pcs/h = main-operation output ÷ hours worked'),
      use: tx('Nhìn nhanh năng suất một người. Chỉ so được giữa những người cùng công đoạn; khác công đoạn thì dùng %EFF.', 'A quick view of one person\'s output. Compare only within the same operation; across operations use %EFF.'),
      example: tx('Hoa: 360 sp ở may cổ ÷ 3 giờ = 120 sp/giờ.', 'Hoa: 360 pcs at neck sewing ÷ 3 h = 120 pcs/h.'),
      live: c => { if (!c.W) return c.none; const W = c.W;
        return [tx(`${W.name || W.emp}: ${c.n(W.primaryQty)} sp ÷ ${c.n(W.workHours, 2)} giờ = ${c.n(W.rate, 1)} sp/giờ`, `${W.name || W.emp}: ${c.n(W.primaryQty)} pcs ÷ ${c.n(W.workHours, 2)} h = ${c.n(W.rate, 1)} pcs/h`)]; } },

    { id: 'wprim', g: 'w', key: null,
      name: tx('Công đoạn chính', 'Main operation'),
      meaning: tx('Công đoạn mà người đó làm ra nhiều phút chuẩn nhất trong ngày. Dùng để gán trạm 3D và tính sp/giờ.', 'The operation where the operator earned the most standard minutes today. Used to place them on the 3D line and to compute pcs/h.'),
      formula: tx('Công đoạn chính = công đoạn có Σ (SL × SAM) lớn nhất của người đó', 'Main operation = the operation with the largest Σ (output × SAM) for that person'),
      use: tx('Khi một người làm nhiều công đoạn, trang coi họ thuộc công đoạn chính; còn công đoạn phụ vẫn tính vào %EFF của họ.', 'When someone works several operations, the page counts them under their main one; the other operations still count toward their %EFF.'),
      example: tx('Lan: may cổ 150 phút chuẩn > diễu vai 15 phút chuẩn → công đoạn chính là may cổ.', 'Lan: neck sewing 150 std min > shoulder hemming 15 → main operation is neck sewing.'),
      live: c => { if (!c.W) return c.none; const W = c.W;
        return [tx(`${W.name || W.emp} → công đoạn chính ${W.primary || '–'} (SL ${c.n(W.primaryQty)})`, `${W.name || W.emp} → main operation ${W.primary || '–'} (output ${c.n(W.primaryQty)})`)]; } },

    // ---------- Công đoạn ----------
    { id: 'fte', g: 'op', key: null,
      name: tx('Người quy đổi (FTE)', 'Full-time equivalent (FTE)'),
      meaning: tx('Số người thực sự dồn sức cho công đoạn. Người làm 2 công đoạn được chia theo thời gian, không đếm 2 lần.', 'How many people actually work on the operation. Someone on 2 operations is split by time, not counted twice.'),
      formula: tx('Với mỗi người: phần ở công đoạn A = (SL ở A × SAM A) ÷ tổng phút chuẩn cả ngày của người đó\nNgười quy đổi của A = Σ các phần đó\nCông đoạn chưa có SAM tính tạm 0,1 phút/sp', 'For each person: share at operation A = (output at A × SAM A) ÷ the person\'s total standard min today\nFTE of A = Σ of those shares\nOperations without SAM use 0.1 min/pc'),
      use: tx('Mẫu số của năng lực chuẩn, và cơ sở để biết công đoạn có đủ người không.', 'The base of standard capacity, and the basis for judging whether an operation has enough people.'),
      example: tx('Lan: may cổ 0,91 (91% thời gian) + Hoa: may cổ 1,00 → 1,91 người quy đổi, dù đếm đầu là 2.', 'Lan: neck sewing 0.91 (91% of her time) + Hoa 1.00 → 1.91 FTE, though the head count is 2.'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        return [tx(`CĐ ${O.op}${O.name ? ' ' + O.name : ''}: ${O.people} người đếm đầu → ${c.n(O.fte, 2)} người quy đổi`, `Operation ${O.op}${O.name ? ' ' + O.name : ''}: ${O.people} heads → ${c.n(O.fte, 2)} FTE`)]; } },

    { id: 'oprate', g: 'op', key: 'op_rate',
      name: tx('sp/giờ TB công đoạn', 'Operation average pcs/h'),
      meaning: tx('Tốc độ ra hàng trung bình của cả công đoạn từ lúc công đoạn bắt đầu chạy tới giờ dữ liệu.', 'Average output rate of the whole operation, from its first data to the data time.'),
      formula: tx('sp/giờ TB = SL cả công đoạn ÷ giờ đã chạy (từ phiếu đầu tiên của công đoạn tới giờ dữ liệu)', 'avg pcs/h = operation output ÷ hours run (from its first ticket to data time)'),
      use: tx('Là tử số của %EFF công đoạn và mẫu số của CT.', 'The numerator of operation %EFF and the basis of CT.'),
      example: tx('May cổ: 660 sp ÷ 3 giờ = 220 sp/giờ.', 'Neck sewing: 660 pcs ÷ 3 h = 220 pcs/h.'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        return [tx(`CĐ ${O.op}: ${c.n(O.qty)} sp ÷ ${c.n((O.runMin || 0) / 60, 2)} giờ = ${c.n(O.rate, 1)} sp/giờ`, `Operation ${O.op}: ${c.n(O.qty)} pcs ÷ ${c.n((O.runMin || 0) / 60, 2)} h = ${c.n(O.rate, 1)} pcs/h`)]; } },

    { id: 'oprate60', g: 'op', key: 'op_rate60',
      name: tx('sp/giờ 60′ gần nhất', 'Pcs/h, last 60′'),
      meaning: tx('Tốc độ hiện tại: chỉ đếm sản lượng trong 60 phút làm việc gần nhất trước giờ dữ liệu (không tính giờ nghỉ).', 'Current pace: only the output in the latest 60 working minutes before the data time (breaks excluded).'),
      formula: tx('sp/giờ 60′ = SL trong 60 phút gần nhất ÷ số giờ của cửa sổ\nCông đoạn mới chạy dưới 60 phút: cửa sổ = số giờ đã chạy', 'pcs/h 60′ = output in the last 60 min ÷ window hours\nIf the operation has run less than 60 min: window = hours run'),
      use: tx('Thấy công đoạn đang nhanh lên hay chậm đi so với trung bình cả ngày.', 'Shows whether the operation is speeding up or slowing down compared with the day average.'),
      example: tx('Từ 9:30 đến 10:30 làm được 230 sp → 230 sp/giờ; trung bình cả ngày 220 → đang tăng tốc.', 'From 9:30 to 10:30: 230 pcs → 230 pcs/h; day average 220 → speeding up.'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        return [tx(`CĐ ${O.op}: ${c.n(O.rate60, 1)} sp/giờ (60′ gần nhất), trung bình cả ngày ${c.n(O.rate, 1)}`, `Operation ${O.op}: ${c.n(O.rate60, 1)} pcs/h (last 60′), day average ${c.n(O.rate, 1)}`)]; } },

    { id: 'opcap', g: 'op', key: 'op_cap',
      name: tx('Năng lực chuẩn công đoạn', 'Operation standard capacity'),
      meaning: tx('Sản lượng công đoạn làm được trong 1 giờ nếu mọi người chạy đúng 100% SAM với số người đang bố trí. Là công suất danh nghĩa.', 'Output per hour if everyone works at exactly 100% SAM with the people currently assigned. The nameplate capacity.'),
      formula: tx('Năng lực chuẩn (sp/giờ) = Người quy đổi × 60 ÷ SAM', 'Standard capacity (pcs/h) = FTE × 60 ÷ SAM'),
      use: tx('Mẫu số của %EFF công đoạn. Nếu năng lực chuẩn thấp hơn nhịp cần thì nguyên nhân tắc nghẽn là thiếu người.', 'The denominator of operation %EFF. If standard capacity is below the required pace, the bottleneck cause is too few people.'),
      example: tx('May cổ: 1,91 × 60 ÷ 0,50 = 229 sp/giờ. Dùng đếm đầu người (2) sẽ ra 240 — lệch vì người làm 2 công đoạn.', 'Neck sewing: 1.91 × 60 ÷ 0.50 = 229 pcs/h. Counting heads (2) would give 240 — the difference comes from people on 2 operations.'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        return [tx(`CĐ ${O.op}: ${c.n(O.fte, 2)} × 60 ÷ ${c.n(O.sam, 2)} = ${c.n(O.cap, 0)} sp/giờ`, `Operation ${O.op}: ${c.n(O.fte, 2)} × 60 ÷ ${c.n(O.sam, 2)} = ${c.n(O.cap, 0)} pcs/h`)]; } },

    { id: 'opload', g: 'op', key: 'op_load',
      name: tx('%EFF công đoạn', 'Operation %EFF'),
      meaning: tx('Cả công đoạn đang chạy bằng bao nhiêu % tốc độ SAM. Trên 100% = phải làm nhanh hơn SAM mới theo kịp.', 'How much of the SAM speed the whole operation runs at. Above 100% = must go faster than SAM to keep up.'),
      formula: tx('%EFF công đoạn = sp/giờ TB ÷ năng lực chuẩn\n(tương đương SAH mỗi giờ ÷ người quy đổi)', 'Operation %EFF = avg pcs/h ÷ standard capacity\n(equivalent to SAH per hour ÷ FTE)'),
      use: tx('Tìm công đoạn gồng nhất. ≥ 90% là sát nhịp, ít dư sức. ≥ 130% với ≤ 2 người là phụ thuộc tay nghề.', 'Find the most stretched operation. ≥ 90% = near the limit, little spare capacity. ≥ 130% with ≤ 2 people = skill-dependent.'),
      example: tx('May cổ: 220 ÷ 229 = 96% (sát nhịp). Tra tay: 200 ÷ 120 = 167% (phụ thuộc tay nghề).', 'Neck sewing: 220 ÷ 229 = 96% (near limit). Tack: 200 ÷ 120 = 167% (skill-dependent).'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        return [tx(`CĐ ${O.op}: ${c.n(O.rate, 1)} ÷ ${c.n(O.cap, 0)} = ${c.p(O.load)}`, `Operation ${O.op}: ${c.n(O.rate, 1)} ÷ ${c.n(O.cap, 0)} = ${c.p(O.load)}`)]; } },

    { id: 'opload60', g: 'op', key: 'op_load60',
      name: tx('%EFF công đoạn 60′ gần nhất', 'Operation %EFF, last 60′'),
      meaning: tx('Như %EFF công đoạn, nhưng dùng tốc độ 60 phút gần nhất: mức hiện tại.', 'Like operation %EFF, but using the last-60′ pace: the current level.'),
      formula: tx('%EFF 60′ = sp/giờ 60′ ÷ năng lực chuẩn', '%EFF 60′ = pcs/h last 60′ ÷ standard capacity'),
      use: tx('So với %EFF cả ngày để thấy công đoạn đang tốt lên hay xấu đi.', 'Compare with the day %EFF to see whether the operation is getting better or worse.'),
      example: tx('230 ÷ 229 = 100%: hiện tại đang đúng SAM, cao hơn trung bình ngày (96%).', '230 ÷ 229 = 100%: right at SAM now, above the day average (96%).'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        return [tx(`CĐ ${O.op}: ${c.n(O.rate60, 1)} ÷ ${c.n(O.cap, 0)} = ${c.p(O.load60)}`, `Operation ${O.op}: ${c.n(O.rate60, 1)} ÷ ${c.n(O.cap, 0)} = ${c.p(O.load60)}`)]; } },

    { id: 'opct', g: 'op', key: 'op_ct',
      name: tx('CT (Cycle Time)', 'CT (cycle time)'),
      meaning: tx('Khoảng cách giữa 2 sản phẩm ra khỏi công đoạn. CT càng lớn thì công đoạn càng chậm (theo giáo trình Nike).', 'Time between 2 pieces leaving the operation. Larger CT = slower operation (Nike training).'),
      formula: tx('CT (phút/sp) = 60 ÷ sp/giờ TB', 'CT (min/pc) = 60 ÷ avg pcs/h'),
      use: tx('Chọn công đoạn chậm nhất (CT lớn nhất) để báo "bottleneck theo Nike", và làm đầu vào của LBR.', 'Pick the slowest operation (largest CT) for the "Nike bottleneck", and as an input to LBR.'),
      example: tx('May cổ: 60 ÷ 220 = 0,273 phút/sp (cứ ~16 giây ra 1 cổ). Tra tay: 60 ÷ 200 = 0,300 → chậm nhất.', 'Neck sewing: 60 ÷ 220 = 0.273 min/pc (one neck every ~16 s). Tack: 60 ÷ 200 = 0.300 → slowest.'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        return [tx(`CĐ ${O.op}: 60 ÷ ${c.n(O.rate, 1)} = ${c.n(O.ct, 3)} phút/sp`, `Operation ${O.op}: 60 ÷ ${c.n(O.rate, 1)} = ${c.n(O.ct, 3)} min/pc`)]; } },

    { id: 'opwl', g: 'op', key: 'op_wl',
      name: tx('Phút chuẩn mỗi người', 'Standard min per person'),
      meaning: tx('Mỗi người ở công đoạn phải gánh bao nhiêu phút chuẩn cho 1 sản phẩm. Không cần sản lượng, chỉ cần SAM và số người.', 'How many standard minutes each person carries per piece. Needs no output, only SAM and headcount.'),
      formula: tx('Phút chuẩn mỗi người = SAM ÷ người quy đổi', 'Std min per person = SAM ÷ FTE'),
      use: tx('Đo việc có được chia đều giữa các công đoạn không (LBR theo SAM).', 'Shows whether the work is split evenly among operations (LBR by SAM).'),
      example: tx('Tra tay: 0,60 ÷ 1,20 = 0,500, gấp đôi may cổ (0,262) → gánh nặng nhất.', 'Tack: 0.60 ÷ 1.20 = 0.500, double neck sewing (0.262) → heaviest load.'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        return [tx(`CĐ ${O.op}: ${c.n(O.sam, 2)} ÷ ${c.n(O.fte, 2)} = ${c.n(O.wl, 3)} phút/người`, `Operation ${O.op}: ${c.n(O.sam, 2)} ÷ ${c.n(O.fte, 2)} = ${c.n(O.wl, 3)} min/person`)]; } },

    { id: 'opgap', g: 'op', key: null,
      name: tx('Hàng dồn (WIP)', 'WIP piling up'),
      meaning: tx('Công đoạn này ra ít hơn công đoạn đứng trước: hàng đang dồn lại trước nó.', 'This operation outputs less than the one before it: work is piling up in front of it.'),
      formula: tx('Khoảng hụt = 1 − (SL lũy kế công đoạn này) ÷ (SL lũy kế công đoạn đứng trước)\nBáo khi khoảng hụt ≥ 10% (cài đặt)', 'Gap = 1 − (cumulative output here) ÷ (cumulative output of the previous operation)\nFlagged when gap ≥ 10% (setting)'),
      use: tx('Là 1 trong 2 điều kiện để một công đoạn thành ứng viên tắc nghẽn.', 'One of the two conditions that make an operation a bottleneck candidate.'),
      example: tx('Công đoạn A 500 sp, công đoạn trước 600 sp → hụt 1 − 500 ÷ 600 = 16,7% ≥ 10% → hàng dồn.', 'Operation A 500 pcs, previous 600 pcs → gap 1 − 500 ÷ 600 = 16.7% ≥ 10% → WIP piling up.'),
      live: c => { if (!c.OP) return c.none; const O = c.OP;
        if (!isFinite(O.gap) || !O.prevOp) return [tx(`CĐ ${O.op}: chưa có công đoạn đứng trước để so`, `Operation ${O.op}: no previous operation to compare`)];
        return [tx(`CĐ ${O.op}: ${c.n(O.qty + (O.carry || 0))} sp so với CĐ ${O.prevOp}; hụt ${c.p(O.gap)} (ngưỡng ${c.p(c.st.gapPct)})`, `Operation ${O.op}: ${c.n(O.qty + (O.carry || 0))} pcs vs op ${O.prevOp}; gap ${c.p(O.gap)} (threshold ${c.p(c.st.gapPct)})`)]; } },

    // ---------- Cả chuyền ----------
    { id: 'lineeff', g: 'line', key: 'line_eff',
      name: tx('Hiệu suất chuyền', 'Line efficiency'),
      meaning: tx('Hiệu suất bình quân của cả chuyền: SAH mọi người làm ra so với giờ họ đã làm.', 'Average efficiency of the whole line: SAH everyone made against the hours they worked.'),
      formula: tx('Hiệu suất chuyền = ΣSAH ÷ (số người × giờ đã làm)\nKhi chuyền tính theo OAS (có giờ On Std / Non C&M): ΣSAH ÷ (giờ On Std + giờ Non C&M)', 'Line efficiency = Σ SAH ÷ (people × hours worked)\nWhen the line uses OAS (On-Std / Non-C&M hours): Σ SAH ÷ (On-Std h + Non-C&M h)'),
      use: tx('Đánh giá cả chuyền có đạt mục tiêu hiệu suất không. Dưới mục tiêu × đường cong học thì trạng thái vàng.', 'Judges whether the whole line meets the efficiency target. Below target × learning factor → yellow status.'),
      example: tx('ΣSAH 76,8; 32 người; 3 giờ → 76,8 ÷ (32 × 3) = 80%.', 'Σ SAH 76.8; 32 people; 3 h → 76.8 ÷ (32 × 3) = 80%.'),
      live: c => { if (!c.L) return c.none; const L = c.L;
        const f = L.effBasis === 'oas'
          ? tx(`Hiệu suất = ${c.n(L.sah, 1)} SAH ÷ (${c.n(L.onStdHours, 2)} + ${c.n(L.nonCmHours, 2)} giờ) = ${c.p(L.eff)}`, `Efficiency = ${c.n(L.sah, 1)} SAH ÷ (${c.n(L.onStdHours, 2)} + ${c.n(L.nonCmHours, 2)} h) = ${c.p(L.eff)}`)
          : tx(`Hiệu suất = ${c.n(L.sah, 1)} SAH ÷ (${L.people} người × ${c.n(L.workHours, 2)} giờ) = ${c.p(L.eff)}`, `Efficiency = ${c.n(L.sah, 1)} SAH ÷ (${L.people} people × ${c.n(L.workHours, 2)} h) = ${c.p(L.eff)}`);
        return [f, tx(`Mục tiêu sau hệ số: ${c.p(L.effTarget)}`, `Target after factor: ${c.p(L.effTarget)}`)]; } },

    { id: 'sahout', g: 'line', key: null,
      name: tx('SAH ra chuyền', 'SAH out of the line'),
      meaning: tx('Giờ chuẩn của hàng đã ra khỏi chuyền (công đoạn cuối), để so với kế hoạch.', 'Standard hours of the work that has left the line (last operation), to compare with the plan.'),
      formula: tx('SAH ra chuyền = Σ (SL công đoạn cuối × ΣSAM mã) ÷ 60', 'SAH out = Σ (last-operation output × style ΣSAM) ÷ 60'),
      use: tx('Là tử số của tiến độ. Chỉ tính hàng đã ra, không tính hàng đang dở trên chuyền.', 'The numerator of progress. Counts only finished output, not work in progress on the line.'),
      example: tx('480 sp ra × ΣSAM 9,0 ÷ 60 = 72,0 SAH.', '480 pcs out × ΣSAM 9.0 ÷ 60 = 72.0 SAH.'),
      live: c => { if (!c.L) return c.none; const L = c.L;
        return [tx(`SAH ra chuyền: ${c.n(L.outSAH, 1)} SAH`, `SAH out of the line: ${c.n(L.outSAH, 1)} SAH`)]; } },

    { id: 'plansah', g: 'line', key: 'plan_sah',
      name: tx('Kế hoạch SAH cả ngày', 'Planned SAH for the day'),
      meaning: tx('Tổng giờ chuẩn chuyền phải làm trong cả ca. Nếu quản đốc nhập target thì dùng target, không thì tính theo người và hiệu suất.', 'Total standard hours the line must make in the shift. Uses the supervisor\'s target if entered; otherwise computed from people and efficiency.'),
      formula: tx('Có target quản đốc: KH SAH = Σ (target mã × ΣSAM mã) ÷ 60\nKhông có: KH SAH = người kế hoạch × giờ cả ngày × hiệu suất mục tiêu × hệ số đường cong', 'With supervisor targets: planned SAH = Σ (style target × style ΣSAM) ÷ 60\nWithout: planned SAH = planned people × day hours × target efficiency × learning factor'),
      use: tx('Mẫu số kế hoạch: từ đây ra target theo mã, nhịp cần và kế hoạch tới giờ.', 'The plan base: gives style targets, the required pace and the plan to date.'),
      example: tx('32 người × 11,5 giờ × 80% × 0,85 = 250,2 SAH. Có target quản đốc 2.500 sp, ΣSAM 9,0 → 375 SAH.', '32 people × 11.5 h × 80% × 0.85 = 250.2 SAH. With supervisor target 2,500 pcs, ΣSAM 9.0 → 375 SAH.'),
      live: c => { if (!c.L) return c.none; const L = c.L;
        const qd = L.styles && L.styles.length && L.styles.every(s => s.targetSrc === 'qd');
        const f = qd ? tx(`Theo target quản đốc: KH SAH = ${c.n(L.planSAH, 1)}`, `Supervisor targets: planned SAH = ${c.n(L.planSAH, 1)}`)
          : tx(`${L.peoplePlan} người × ${c.n(L.totalMin / 60, 2)} giờ × ${c.p(c.cfg.effTarget)} × ${c.n(L.factor, 2)} = ${c.n(L.planSAH, 1)} SAH`, `${L.peoplePlan} people × ${c.n(L.totalMin / 60, 2)} h × ${c.p(c.cfg.effTarget)} × ${c.n(L.factor, 2)} = ${c.n(L.planSAH, 1)} SAH`);
        return [f]; } },

    { id: 'plannow', g: 'line', key: 'plan_now_sah',
      name: tx('Kế hoạch SAH tới giờ', 'Planned SAH to data time'),
      meaning: tx('Phần kế hoạch phải đạt tới giờ dữ liệu, chia đều theo thời gian làm việc.', 'The part of the plan due by the data time, spread evenly over working time.'),
      formula: tx('KH SAH tới giờ = KH SAH cả ngày × giờ đã làm ÷ giờ cả ngày', 'Planned SAH to now = planned SAH for the day × hours worked ÷ day hours'),
      use: tx('Mẫu số của tiến độ: đây là "đúng ra lúc này phải làm được bao nhiêu".', 'The denominator of progress: "how much should be done by now".'),
      example: tx('250,2 × 3 ÷ 11,5 = 65,3 SAH.', '250.2 × 3 ÷ 11.5 = 65.3 SAH.'),
      live: c => { if (!c.L) return c.none; const L = c.L;
        return [tx(`${c.n(L.planSAH, 1)} × ${c.n(L.workHours, 2)} ÷ ${c.n(L.totalMin / 60, 2)} = ${c.n(L.planNowSAH, 1)} SAH`, `${c.n(L.planSAH, 1)} × ${c.n(L.workHours, 2)} ÷ ${c.n(L.totalMin / 60, 2)} = ${c.n(L.planNowSAH, 1)} SAH`)]; } },

    { id: 'progress', g: 'line', key: 'progress',
      name: tx('Tiến độ chuyền', 'Line progress'),
      meaning: tx('Hàng đã ra chuyền so với kế hoạch tới giờ. 100% = đúng tiến độ.', 'Finished output against the plan to date. 100% = on schedule.'),
      formula: tx('Tiến độ = SAH ra chuyền ÷ KH SAH tới giờ', 'Progress = SAH out of the line ÷ planned SAH to now'),
      use: tx('Quyết định màu chuyền: < 85% đỏ, 85–95% vàng, ≥ 95% xanh (ngưỡng trong ⚙ Cài đặt).', 'Sets the line colour: < 85% red, 85–95% yellow, ≥ 95% green (thresholds in ⚙ Settings).'),
      example: tx('72,0 ÷ 65,3 = 110% → vượt kế hoạch → xanh.', '72.0 ÷ 65.3 = 110% → ahead of plan → green.'),
      live: c => { if (!c.L) return c.none; const L = c.L;
        return [tx(`${c.n(L.outSAH, 1)} ÷ ${c.n(L.planNowSAH, 1)} = ${c.p(L.progress)} (xanh ≥ ${c.p(c.st.green)}, đỏ < ${c.p(c.st.red)})`, `${c.n(L.outSAH, 1)} ÷ ${c.n(L.planNowSAH, 1)} = ${c.p(L.progress)} (green ≥ ${c.p(c.st.green)}, red < ${c.p(c.st.red)})`)]; } },

    { id: 'target', g: 'line', key: 'style_target',
      name: tx('Target mã hàng (sp/ngày)', 'Style target (pcs/day)'),
      meaning: tx('Số sp mỗi mã phải ra trong ngày. Có target quản đốc thì dùng target đó.', 'Pieces each style must make in the day. The supervisor target is used when entered.'),
      formula: tx('Target mã (không có quản đốc) = làm tròn( KH SAH cả ngày × 60 × tỉ trọng mã ÷ ΣSAM mã )\nTỉ trọng mã = phút chuẩn ra chuyền của mã ÷ tổng phút chuẩn ra chuyền', 'Style target (no supervisor target) = round( planned SAH × 60 × style share ÷ style ΣSAM )\nStyle share = the style\'s standard min out ÷ total standard min out'),
      use: tx('Từ target mã ra nhịp cần (sp/giờ) và ứng viên tắc nghẽn.', 'From the style target come the required pace (pcs/h) and the bottleneck candidates.'),
      example: tx('250,2 × 60 × 1 ÷ 9,0 = 1.668 sp/ngày (một mã).', '250.2 × 60 × 1 ÷ 9.0 = 1,668 pcs/day (one style).'),
      live: c => { if (!c.L || !c.L.styles || !c.L.styles.length) return c.none; const L = c.L;
        return L.styles.map(s => tx(`Mã ${s.style}: ${s.targetSrc === 'qd' ? 'target quản đốc' : `round(${c.n(L.planSAH, 1)} × 60 × ${c.p(L.outEM ? s.out * s.sumSam / L.outEM : 1)} ÷ ${c.n(s.sumSam, 2)})`} = ${c.n(s.target, 0)} sp`,
          `Style ${s.style}: ${s.targetSrc === 'qd' ? 'supervisor target' : `round(${c.n(L.planSAH, 1)} × 60 × ${c.p(L.outEM ? s.out * s.sumSam / L.outEM : 1)} ÷ ${c.n(s.sumSam, 2)})`} = ${c.n(s.target, 0)} pcs`)); } },

    { id: 'forecast', g: 'line', key: null,
      name: tx('Dự báo cuối ca', 'End-of-shift forecast'),
      meaning: tx('Ước tính cuối ca chuyền ra được bao nhiêu sp, so với target ngày. Chỉ là ước tính theo tốc độ hiện tại.', 'Estimate of the output at shift end versus the day target. Only an estimate based on the current pace.'),
      formula: tx('Dự báo cuối ca = SL ra hiện tại + tốc độ × giờ còn lại\nTốc độ = sp/giờ 60′ của công đoạn cuối (nếu chưa có thì sp/giờ TB)\nCần thêm mỗi giờ = (target − SL ra) ÷ giờ còn lại', 'End forecast = current output + pace × remaining hours\nPace = last-60′ pcs/h of the last operation (or average if not available)\nRequired per hour = (target − output) ÷ remaining hours'),
      use: tx('Trả lời câu sếp hay hỏi: "cuối ngày có đạt không?". Nếu thiếu, cho biết cần tăng tốc độ bao nhiêu mỗi giờ.', 'Answers the usual question "will we hit the target today?". If short, shows how much faster per hour is needed.'),
      example: tx('Ra 3.000 + 214 sp/giờ × 3 giờ = 3.642; target 3.900 → thiếu 258; cần thêm 300 sp mỗi giờ.', 'Out 3,000 + 214 pcs/h × 3 h = 3,642; target 3,900 → short 258; need 300 pcs per hour more.'),
      live: c => { if (!c.L || !c.L.forecast) return c.none; const F = c.L.forecast;
        const gap = F.gap, short = gap < 0;
        return [tx(`Ra ${c.n(F.out)} + ${c.n(F.pace, 1)} sp/giờ × ${c.n(F.remH, 1)} giờ = ${c.n(F.end)}; target ${c.n(F.target)} → ${short ? 'thiếu' : 'dư'} ${c.n(Math.abs(gap))}`,
          `Out ${c.n(F.out)} + ${c.n(F.pace, 1)} pcs/h × ${c.n(F.remH, 1)} h = ${c.n(F.end)}; target ${c.n(F.target)} → ${short ? 'short' : 'over'} ${c.n(Math.abs(gap))}`),
          tx(`Cần ${isFinite(F.need) ? c.n(F.need, 0) : '–'} sp mỗi giờ còn lại để đạt target`, `Need ${isFinite(F.need) ? c.n(F.need, 0) : '–'} pcs per remaining hour to hit target`)]; } },

    { id: 'carry', g: 'line', key: null,
      name: tx('Hàng tồn ca trước', 'Carry-over from previous shift'),
      meaning: tx('Phiếu đồng bộ trước giờ vào ca + 25 phút là hàng làm ở ca trước (tăng ca). Không tính vào sản lượng hôm nay.', 'Tickets synced before shift start + 25 min are work from the previous shift (overtime). Not counted in today\'s output.'),
      formula: tx('Tồn ca trước = phiếu có giờ đồng bộ < giờ vào ca + 25 phút (cài đặt "Tồn ca trước")', 'Carry-over = tickets synced before shift start + 25 min (setting "Carry-over")'),
      use: tx('Tránh tính hàng hôm qua vào hôm nay làm tiến độ đẹp giả tạo.', 'Prevents yesterday\'s output from making today\'s progress look better than it is.'),
      example: tx('Đồng bộ 7:40 (vào ca 7:30) → 7:40 < 7:55 → là hàng tồn ca trước.', 'Synced 7:40 (shift start 7:30) → 7:40 < 7:55 → carry-over.'),
      live: c => { if (!c.L) return c.none; return [tx(`Tồn ca trước đang tính riêng: ${c.n(c.L.carry)} sp (không tính vào hôm nay)`, `Carry-over counted separately: ${c.n(c.L.carry)} pcs (not in today's output)`)]; } },

    { id: 'lbr', g: 'line', key: 'lbr',
      name: tx('LBR (cân bằng chuyền, Nike)', 'LBR (line balancing rate, Nike)'),
      meaning: tx('Các công đoạn ra hàng có đều nhau không. 100% = mọi công đoạn có CT bằng nhau. Chuyền treo kéo mọi công đoạn cùng nhịp nên thường cao.', 'Whether operations output evenly. 100% = every operation has the same CT. A hanger line pulls everything at one pace, so this is usually high.'),
      formula: tx('LBR = Σ CT ÷ (CT lớn nhất × số công đoạn)', 'LBR = Σ CT ÷ (largest CT × number of operations)'),
      use: tx('Nhìn tổng quan cân bằng. Muốn biết việc có chia đều người không thì xem LBR theo SAM.', 'Overall balance view. For whether people are evenly loaded, see LBR by SAM.'),
      example: tx('ΣCT 1,113; CT lớn nhất 0,300; 4 công đoạn → 1,113 ÷ 1,200 = 92,7%.', 'Σ CT 1.113; largest CT 0.300; 4 ops → 1.113 ÷ 1.200 = 92.7%.'),
      live: c => { if (!c.L) return c.none; const L = c.L;
        return [tx(`LBR = ${c.p(L.lbr)} (${L.lbrN || 0} công đoạn có CT)`, `LBR = ${c.p(L.lbr)} (${L.lbrN || 0} operations with CT)`)]; } },

    { id: 'lbrsam', g: 'line', key: 'lbr_sam',
      name: tx('LBR theo SAM (chia việc)', 'LBR by SAM (workload split)'),
      meaning: tx('Việc có được chia đều giữa người và công đoạn không, tính theo phút chuẩn mỗi người.', 'Whether the work is split evenly across people and operations, using standard minutes per person.'),
      formula: tx('LBR theo SAM = Σ phút chuẩn mỗi người ÷ (lớn nhất × số công đoạn)', 'LBR by SAM = Σ std min per person ÷ (largest × number of operations)'),
      use: tx('Thấp = có công đoạn gánh nặng hơn hẳn các công đoạn khác → nên chuyển người hoặc cải tiến thao tác.', 'Low = one operation carries far more than the others → move people or improve the method.'),
      example: tx('Σ 1,243; lớn nhất 0,500; 4 công đoạn → 1,243 ÷ 2,000 = 62,1%: tra tay gánh gấp đôi.', 'Σ 1.243; largest 0.500; 4 ops → 1.243 ÷ 2.000 = 62.1%: tack carries double.'),
      live: c => { if (!c.L) return c.none; return [tx(`LBR theo SAM = ${c.p(c.L.lbrSam)}`, `LBR by SAM = ${c.p(c.L.lbrSam)}`)]; } },

    // ---------- Tắc nghẽn & trạng thái ----------
    { id: 'bn', g: 'bn', key: null,
      name: tx('Tắc nghẽn (đỏ)', 'Bottleneck (red)'),
      meaning: tx('Công đoạn đang hãm sản lượng cả chuyền. Không phải công đoạn %EFF cao nhất: %EFF cao mà vẫn theo kịp thì là người giỏi.', 'The operation limiting the whole line\'s output. Not the highest %EFF: high %EFF that keeps up is just a good operator.'),
      formula: tx('Bước 1, chọn ứng viên: CĐ có SAM, đã chạy ≥ 60 phút, VÀ (hàng dồn ≥ 10% HOẶC sp/giờ < nhịp cần)\nHàng dồn không xét cho mã của đơn cũ (đang ra dần / đã hết): hàng của mã đó còn nằm giữa các CĐ trên đường chuyền\nNhịp cần = target của mã ÷ giờ làm cả ngày (target chia theo tỷ trọng từng mã)\nBước 2: trong ứng viên, chọn CT lớn nhất (mỗi chuyền tối đa 1)', 'Step 1, candidates: operations with SAM, running ≥ 60 min, AND (WIP piling ≥ 10% OR pcs/h < required pace)\nWIP piling is not checked for styles of an old order (ramping down / finished): their pieces are still in transit between operations\nRequired pace = style target ÷ day hours (target split by the share of each style)\nStep 2: among candidates, the largest CT (at most 1 per line)'),
      use: tx('Chỉ cho quản lý biết công đoạn cần xử lý trước. Rê chuột lên trạm 3D để xem nguyên nhân.', 'Tells the manager which operation to fix first. Hover the 3D station to see the cause.'),
      example: tx('Target 2.500 → nhịp cần 2.500 ÷ 11,5 = 217 sp/giờ. Tra tay 200 < 217 là ứng viên; CT 0,300 lớn nhất → tắc nghẽn.', 'Target 2,500 → required pace 2,500 ÷ 11.5 = 217 pcs/h. Tack 200 < 217 is a candidate; CT 0.300 largest → bottleneck.'),
      live: c => { if (!c.L) return c.none; const B = c.L.ops && c.L.ops.find(o => o.key === c.L.bottleneck);
        if (!B) return [tx('Hiện không có tắc nghẽn: chuyền không có công đoạn nào dồn hàng hoặc chậm hơn nhịp cần.', 'No bottleneck now: no operation is piling up or slower than the required pace.')];
        return [tx(`CĐ ${B.op}${B.name ? ' ' + B.name : ''}: ${c.n(B.rate, 1)} sp/giờ, nhịp cần ${isFinite(B.need) ? c.n(B.need, 0) : '–'}, CT ${c.n(B.ct, 3)}`,
          `Operation ${B.op}${B.name ? ' ' + B.name : ''}: ${c.n(B.rate, 1)} pcs/h, required ${isFinite(B.need) ? c.n(B.need, 0) : '–'}, CT ${c.n(B.ct, 3)}`)]; } },

    { id: 'bncause', g: 'bn', key: null,
      name: tx('Nguyên nhân tắc nghẽn: thiếu người hay tay nghề', 'Bottleneck cause: too few people or skill'),
      meaning: tx('Khi đã có tắc nghẽn, trang xác định vì sao: năng lực người không đủ, hay người đủ mà làm chậm.', 'Once a bottleneck is found, the page works out why: not enough capacity from the people, or enough capacity but slow work.'),
      formula: tx('Năng lực chuẩn < nhịp cần → THIẾU NGƯỜI. Cần thêm ≈ nhịp cần × SAM ÷ 60 − người quy đổi\nNăng lực chuẩn ≥ nhịp cần mà vẫn chậm → TAY NGHỀ: nêu tên người có %EFF thấp nhất có công đoạn chính ở đây', 'Capacity < required pace → TOO FEW PEOPLE. Add ≈ required × SAM ÷ 60 − FTE\nCapacity ≥ required pace but still slow → SKILL: name the lowest-%EFF operator whose main operation is here'),
      use: tx('Quyết định hành động: thêm người (cân bằng lại) hay đào tạo / đổi người (tay nghề).', 'Decides the action: add people (rebalance) or train / swap people (skill).'),
      example: tx('Nhịp cần 217, năng lực tra tay 120 → thiếu. Cần thêm 217 × 0,60 ÷ 60 − 1,20 ≈ 1,0 người.', 'Required 217, tack capacity 120 → short. Add 217 × 0.60 ÷ 60 − 1.20 ≈ 1.0 person.'),
      live: c => { if (!c.L) return c.none; const B = c.L.ops && c.L.ops.find(o => o.key === c.L.bottleneck);
        if (!B || !B.why) return [tx('Chưa có tắc nghẽn nên chưa có nguyên nhân.', 'No bottleneck, so no cause to show.')];
        if (B.why.kind === 'people') return [tx(`Năng lực ${c.n(B.cap, 0)} < nhịp cần ${c.n(B.need, 0)} → thiếu ~${c.n(Math.ceil(B.why.add * 10) / 10, 1)} người quy đổi`, `Capacity ${c.n(B.cap, 0)} < required ${c.n(B.need, 0)} → short ~${c.n(Math.ceil(B.why.add * 10) / 10, 1)} FTE`)];
        return [tx(`Năng lực ${c.n(B.cap, 0)} ≥ nhịp cần ${c.n(B.need, 0)} → tay nghề. %EFF thấp nhất: ${B.why.name || B.why.emp || '–'} ${c.p(B.why.eff)}`, `Capacity ${c.n(B.cap, 0)} ≥ required ${c.n(B.need, 0)} → skill. Lowest %EFF: ${B.why.name || B.why.emp || '–'} ${c.p(B.why.eff)}`)]; } },

    { id: 'skill', g: 'bn', key: null,
      name: tx('Phụ thuộc tay nghề (cam)', 'Skill-dependent (orange)'),
      meaning: tx('Công đoạn đang theo kịp chuyền nhờ 1–2 người chạy rất nhanh. Chưa phải tắc nghẽn, nhưng 1 người vắng là thành tắc nghẽn.', 'Operation keeping up only because 1–2 people run very fast. Not a bottleneck yet, but one absence makes it one.'),
      formula: tx('%EFF công đoạn ≥ 130% (cài đặt) VÀ số người ≤ 2 (cài đặt), và công đoạn đã chạy đủ thời gian', 'Operation %EFF ≥ 130% (setting) AND people ≤ 2 (setting), and the operation has run long enough'),
      use: tx('Cảnh báo rủi ro: cần người dự phòng hoặc đào tạo thêm.', 'Risk warning: needs backup people or more training.'),
      example: tx('Tra tay %EFF 167%, 2 người → phụ thuộc tay nghề.', 'Tack %EFF 167%, 2 people → skill-dependent.'),
      live: c => { if (!c.L || !c.L.ops) return c.none; const S = c.L.ops.filter(o => o.status === 'skill');
        if (!S.length) return [tx('Hiện không có công đoạn phụ thuộc tay nghề.', 'No skill-dependent operation right now.')];
        return S.map(o => tx(`CĐ ${o.op}${o.name ? ' ' + o.name : ''}: %EFF ${c.p(o.load)}, ${o.people} người`, `Operation ${o.op}${o.name ? ' ' + o.name : ''}: %EFF ${c.p(o.load)}, ${o.people} people`)); } },

    { id: 'opstatus', g: 'bn', key: null,
      name: tx('Trạng thái từng công đoạn (màu ô)', 'Operation status (tile colour)'),
      meaning: tx('Mỗi công đoạn có 1 trạng thái. Nếu khớp nhiều điều kiện thì lấy điều kiện đứng trước trong danh sách.', 'Each operation has one status. If several rules match, the first in the list wins.'),
      formula: tx('Theo thứ tự ưu tiên:\n1. Ngừng: có sản lượng nhưng ≥ 60 phút không có dữ liệu mới\n2. Tắc nghẽn (đỏ)\n3. Phụ thuộc tay nghề (cam)\n4. Khởi động: chạy chưa đủ 60 phút\n5. Sát nhịp: %EFF ≥ 90%\n6. Ổn: còn lại', 'In priority order:\n1. Stopped: has output but no new data for ≥ 60 min\n2. Bottleneck (red)\n3. Skill-dependent (orange)\n4. Starting: running < 60 min\n5. Near limit: %EFF ≥ 90%\n6. OK: the rest'),
      use: tx('Nhìn màu từng ô trên 3D và trong bảng công đoạn để biết chỗ nào cần xem.', 'Read the colour of each tile on the 3D view and in the operation table to see where to look.'),
      example: tx('CĐ 42 may cổ %EFF 96% → sát nhịp (vàng). CĐ 50 tra tay 167% → phụ thuộc tay nghề (cam).', 'Operation 42 neck sewing %EFF 96% → near limit (yellow). Operation 50 tack 167% → skill-dependent (orange).'),
      live: c => { if (!c.L || !c.L.ops) return c.none; const cnt = {};
        c.L.ops.forEach(o => { cnt[o.status] = (cnt[o.status] || 0) + 1; });
        const lab = { stall: tx('Ngừng', 'Stopped'), bn: tx('Tắc nghẽn', 'Bottleneck'), skill: tx('Tay nghề', 'Skill'), start: tx('Khởi động', 'Starting'), near: tx('Sát nhịp', 'Near limit'), ok: tx('Ổn', 'OK') };
        return Object.keys(lab).filter(k => cnt[k]).map(k => tx(`${lab[k].vi}: ${cnt[k]} công đoạn`, `${lab[k].en}: ${cnt[k]} operations`)); } },

    { id: 'linestate', g: 'bn', key: null,
      name: tx('Trạng thái chuyền (xanh / vàng / đỏ / xám)', 'Line status (green / yellow / red / grey)'),
      meaning: tx('Màu của cả chuyền, lấy theo tiến độ, người, hàng ra và hiệu suất.', 'Colour of the whole line, based on progress, people, output and efficiency.'),
      formula: tx('XÁM: chưa có dữ liệu, hoặc dữ liệu mới nhất cũ ≥ 90 phút\nKHỞI ĐỘNG: chưa đủ 60 phút dữ liệu\nĐỎ (chỉ cần 1): tiến độ < 85%; ≥ 60 phút không có hàng ra; số người < người kế hoạch × 90%\nVÀNG (chỉ cần 1): tiến độ < 95%; có công đoạn ngừng; hiệu suất < mục tiêu × hệ số\nXANH: không rơi vào các trường hợp trên', 'GREY: no data, or latest data ≥ 90 min old\nSTARTING: less than 60 min of data\nRED (any one): progress < 85%; ≥ 60 min without output; people < planned × 90%\nYELLOW (any one): progress < 95%; an operation stopped; efficiency < target × factor\nGREEN: none of the above'),
      use: tx('Màu đại diện cho lãnh đạo nhìn từ xa. Mở phần "Lý do" trên trang để biết vì sao.', 'The colour leaders see at a glance. Open the "reasons" on the page to see why.'),
      example: tx('Tiến độ 110%, có hàng ra, đủ 32 người, hiệu suất 80% ≥ 68% → XANH.', 'Progress 110%, output flowing, 32 of 32 people, efficiency 80% ≥ 68% → GREEN.'),
      live: c => { if (!c.L) return c.none; const L = c.L, lab = { green: tx('XANH', 'GREEN'), yellow: tx('VÀNG', 'YELLOW'), red: tx('ĐỎ', 'RED'), gray: tx('XÁM', 'GREY'), start: tx('KHỞI ĐỘNG', 'STARTING') };
        const out = [tx(`Trạng thái hiện tại: ${lab[L.state] ? lab[L.state].vi : L.state}`, `Current status: ${lab[L.state] ? lab[L.state].en : L.state}`)];
        (L.why || []).forEach(w => out.push(tx(w.vi, w.en)));
        return out; } },

    // ---------- Cân bằng chuyền & takt (biểu đồ Yamazumi, PT.lineBalance) ----------
    { id: 'takt', g: 'bal', key: null,
      name: tx('Takt time', 'Takt time'),
      meaning: tx('Nhịp phải ra 1 sản phẩm để kịp target cả ngày. Là nhịp CẦN đạt, do nhu cầu và thời gian làm việc quyết định (khác CT là nhịp đang làm được).', 'The pace at which one piece must come out to meet the full-day target. It is the pace REQUIRED, set by demand and working time (CT is the pace actually achieved).'),
      formula: tx('Takt (phút/sp) = phút làm cả ngày ÷ target cả ngày của chuyền\nphút làm cả ngày = giờ làm theo lịch − giờ nghỉ\ntarget cả ngày = Σ target các mã hàng của chuyền', 'Takt (min/pc) = working minutes in the day ÷ the line full-day target\nworking minutes = scheduled hours − breaks\nfull-day target = Σ target of the line styles'),
      vars: [['phút làm cả ngày', tx('L.totalMin, từ lịch giờ làm của chuyền', 'L.totalMin, from the line working schedule')], ['target', tx('Σ target các mã hàng (nhập tay hoặc tính theo SAM)', 'Σ style targets (entered or computed from SAM)')]],
      use: tx('Là mốc so với CT từng công đoạn: CT lớn hơn takt thì công đoạn không theo kịp. Cũng là gốc để tính đường giới hạn và số người cần.', 'The yardstick for each operation CT: CT above takt means the operation cannot keep up. Also the basis for the limit line and the people needed.'),
      example: tx('480 phút ÷ 960 sp = 0,5 phút/sp (cứ 30 giây ra 1 sản phẩm).', '480 min ÷ 960 pcs = 0.5 min/pc (one piece every 30 s).'),
      live: c => { if (!c.L || !window.PT) return c.none; const B = PT.lineBalance(c.L);
        if (!isFinite(B.takt)) return [tx('Chưa có target cả ngày để tính takt', 'No full-day target yet to compute takt')];
        return [tx(`Takt = ${c.n(c.L.totalMin, 0)} phút ÷ ${c.n(B.target)} sp = ${c.n(B.takt, 3)} phút/sp`, `Takt = ${c.n(c.L.totalMin, 0)} min ÷ ${c.n(B.target)} pcs = ${c.n(B.takt, 3)} min/pc`)]; } },

    { id: 'ballim', g: 'bal', key: null,
      name: tx('Đường giới hạn (takt × hiệu suất mục tiêu)', 'Limit line (takt × target efficiency)'),
      meaning: tx('Đường đỏ nét đứt trên biểu đồ cân bằng chuyền. Người làm đúng mục tiêu hiệu suất thì mỗi sản phẩm tốn đúng chừng này phút chuẩn. Đường đen là takt thuần, chỉ làm mốc tham chiếu.', 'The red dashed line on the line-balance chart. A person working exactly at target efficiency uses this many standard minutes per piece. The black line is plain takt, only a reference.'),
      formula: tx('Giới hạn = takt × hiệu suất mục tiêu\nhiệu suất mục tiêu = effTarget (mặc định 80%) × hệ số đường cong học khi đổi mã', 'Limit = takt × target efficiency\ntarget efficiency = effTarget (default 80%) × learning-curve factor when the style changes'),
      vars: [['effTarget', tx('Hiệu suất mục tiêu trong ⚙ Cài đặt (mặc định 0,8)', 'Target efficiency in ⚙ Settings (default 0.8)')]],
      use: tx('Mốc đánh giá mức của mỗi cột (thiếu người, sát giới hạn, ổn, dư người) và để tính số người cần.', 'The yardstick for the level of every bar (short, at the limit, OK, spare) and for the people needed.'),
      example: tx('0,5 × 0,8 = 0,4 phút. Cột nào cao hơn 0,4 là công đoạn mỗi người phải gánh quá mức.', '0.5 × 0.8 = 0.4 min. A bar above 0.4 means each person carries more than the target allows.'),
      live: c => { if (!c.L || !window.PT) return c.none; const B = PT.lineBalance(c.L);
        if (!(B.lim > 0)) return [tx('Chưa có takt nên chưa có giới hạn', 'No takt yet, so no limit')];
        return [tx(`Giới hạn = ${c.n(B.takt, 3)} × ${c.p(B.effTarget)} = ${c.n(B.lim, 3)} phút`, `Limit = ${c.n(B.takt, 3)} × ${c.p(B.effTarget)} = ${c.n(B.lim, 3)} min`)]; } },

    { id: 'balcol', g: 'bal', key: null,
      name: tx('Cột cân bằng chuyền (SAM ÷ người quy đổi)', 'Line-balance bar (SAM ÷ FTE)'),
      meaning: tx('Mỗi cột là 1 cụm công đoạn chuyền, cao bằng số phút chuẩn mỗi người phải làm cho 1 sản phẩm. Bấm cột: camera 3D bay tới trạm đầu của cụm; rê chuột: xem người trong cụm và %EFF từng người.', 'Each bar is one line operation group; its height is the standard minutes each person must do per piece. Click a bar: the 3D camera flies to the first station; hover: operators and their %EFF.'),
      formula: tx('Chiều cao cột = SAM ÷ FTE\nSAM = Σ(SAM mã × sản lượng mã) ÷ Σ sản lượng (khi cùng mã công đoạn có nhiều mã hàng)\nFTE = Σ trọng số w của những người làm công đoạn đó', 'Bar height = SAM ÷ FTE\nSAM = Σ(style SAM × style output) ÷ Σ output (when several styles share the operation code)\nFTE = Σ weight w of the people on that operation'),
      vars: [['SAM', tx('Phút chuẩn của công đoạn cho 1 sản phẩm (file IE)', 'Standard minutes of the operation per piece (IE file)')], ['FTE', tx('Người quy đổi: người làm 1 nửa thời gian cho công đoạn tính 0,5', 'Full-time equivalents: a person spending half the time counts 0.5')], ['LBR', tx('Σ chiều cao ÷ (số cột × cột cao nhất); 100% = mọi cột bằng nhau', 'Σ heights ÷ (bars × tallest bar); 100% = all bars equal')]],
      use: tx('Thấy ngay công đoạn nào mỗi người gánh nặng hơn giới hạn (thiếu người) và công đoạn nào nhẹ (dư người), để chuyển người.', 'Shows at once which operations load each person above the limit (short of people) and which are light (spare), so people can be moved.'),
      example: tx('Tra tay: SAM 0,60 ÷ FTE 1,20 = 0,500, cao hơn giới hạn 0,4 nhiều → thiếu người.', 'Tack: SAM 0.60 ÷ FTE 1.20 = 0.500, well above the 0.4 limit → short of people.'),
      live: c => { if (!c.L || !window.PT) return c.none; const B = PT.lineBalance(c.L), x = (c.OP && B.items.find(i => PT.codeKey(i.op) === PT.codeKey(c.OP.op))) || B.items[0];
        if (!x) return c.none;
        return [tx(`CĐ ${x.op}: ${c.n(x.sam, 3)} ÷ ${c.n(x.fte, 2)} = ${c.n(x.wl, 3)} phút/người`, `Operation ${x.op}: ${c.n(x.sam, 3)} ÷ ${c.n(x.fte, 2)} = ${c.n(x.wl, 3)} min/person`), tx(`LBR cả chuyền = ${c.p(B.lbr)}`, `Line LBR = ${c.p(B.lbr)}`)]; } },

    { id: 'balneed', g: 'bal', key: null,
      name: tx('Người cần và chênh người', 'People needed and difference'),
      meaning: tx('Công đoạn cần bao nhiêu người quy đổi để mỗi người không vượt đường giới hạn, và đang thừa hay thiếu bao nhiêu.', 'How many FTE the operation needs for each person to stay under the limit line, and how many are spare or missing.'),
      formula: tx('Người cần = SAM ÷ giới hạn\nChênh = FTE hiện có − người cần (âm = thiếu người)', 'People needed = SAM ÷ limit\nDifference = current FTE − people needed (negative = short)'),
      use: tx('Số cụ thể để chuyển người giữa các công đoạn. Chênh âm: cần thêm; chênh dương lớn: có thể rút bớt cho công đoạn khác.', 'A concrete number for moving people between operations. Negative: add people; large positive: people can be moved elsewhere.'),
      example: tx('SAM 0,60 ÷ giới hạn 0,4 = cần 1,5 người; có 1,2 → chênh −0,3 (thiếu 0,3 người).', 'SAM 0.60 ÷ limit 0.4 = 1.5 people needed; has 1.2 → difference −0.3 (0.3 short).'),
      live: c => { if (!c.L || !window.PT) return c.none; const B = PT.lineBalance(c.L), x = (c.OP && B.items.find(i => PT.codeKey(i.op) === PT.codeKey(c.OP.op))) || B.items[0];
        if (!x || !isFinite(x.need)) return c.none;
        return [tx(`CĐ ${x.op}: cần ${c.n(x.sam, 3)} ÷ ${c.n(B.lim, 3)} = ${c.n(x.need, 2)} người; có ${c.n(x.fte, 2)} → chênh ${c.n(x.diff, 2)}`, `Operation ${x.op}: needs ${c.n(x.sam, 3)} ÷ ${c.n(B.lim, 3)} = ${c.n(x.need, 2)} people; has ${c.n(x.fte, 2)} → difference ${c.n(x.diff, 2)}`)]; } },

    { id: 'ballv', g: 'bal', key: null,
      name: tx('Màu mức của cột (thiếu / sát / ổn / dư người)', 'Bar level colour (short / at limit / OK / spare)'),
      meaning: tx('Mỗi cột được so với đường giới hạn để biết công đoạn đang thiếu người, sát giới hạn, ổn hay dư người.', 'Each bar is compared with the limit line to see whether the operation is short, at the limit, OK or has spare people.'),
      formula: tx('Thiếu người: chiều cao > giới hạn × 1,03\nSát giới hạn: từ giới hạn × 0,97 đến × 1,03\nDư người: chiều cao < giới hạn × 0,70\nỔn: còn lại', 'Short of people: height > limit × 1.03\nAt the limit: between limit × 0.97 and × 1.03\nSpare people: height < limit × 0.70\nOK: the rest'),
      use: tx('Đọc nhanh biểu đồ: cột thiếu người cần xử lý trước, cột dư người là nguồn để chuyển người.', 'Quick reading of the chart: short bars need action first, spare bars are the source of people to move.'),
      example: tx('Giới hạn 0,4: cột 0,45 → thiếu người; 0,39 → sát giới hạn; 0,35 → ổn; 0,25 → dư người.', 'Limit 0.4: bar 0.45 → short; 0.39 → at the limit; 0.35 → OK; 0.25 → spare.'),
      live: c => { if (!c.L || !window.PT) return c.none; const B = PT.lineBalance(c.L), L = { bad: ['thiếu người', 'short'], near: ['sát giới hạn', 'at limit'], ok: ['ổn', 'OK'], low: ['dư người', 'spare'], na: ['chưa đủ dữ liệu', 'no data'] }, cnt = {};
        B.items.forEach(i => { cnt[i.lv] = (cnt[i.lv] || 0) + 1; });
        const k = Object.keys(cnt); if (!k.length) return c.none;
        return [tx(k.map(z => `${cnt[z]} cột ${L[z][0]}`).join(' · '), k.map(z => `${cnt[z]} bars ${L[z][1]}`).join(' · '))]; } },

    { id: 'balorder', g: 'bal', key: null,
      name: tx('Khi đổi đơn: 2 biểu đồ "Cân bằng chuyền" và "Sản lượng TB (sp/giờ)" gộp các đơn thế nào', 'When the order changes: how the "Line balance" and "Avg output (pcs/h)" charts merge the orders'),
      meaning: tx('Lúc đổi đơn, cùng 1 mã công đoạn có 2 dòng dữ liệu: đơn cũ (đang ra dần) và đơn mới (đang lên). Mỗi cột của 2 biểu đồ luôn là 1 CÔNG ĐOẠN, nên 2 dòng được gộp lại thành 1 cột.', 'During a changeover the same operation code has 2 data rows: the old order (tailing off) and the new order (ramping up). Each bar of the 2 charts is always ONE operation, so the 2 rows are merged into one bar.'),
      formula: tx('CÂN BẰNG CHUYỀN (cột = SAM ÷ FTE)\n  SAM = Σ(SAM đơn × SL đơn) ÷ Σ SL (bình quân theo sản lượng)\n  FTE = Σ FTE của các dòng (người làm đơn cũ + người làm đơn mới)\n  takt = phút làm cả ngày ÷ Σ target các đơn (cộng target đơn cũ + đơn mới)\nSẢN LƯỢNG TB (sp/giờ)\n  sp/giờ = Σ SL các đơn ÷ giờ chạy dài nhất (từ phiếu đầu tiên của đơn sớm nhất tới giờ đang xem)\n  KHÔNG cộng giờ của 2 dòng (2 đơn chạy chồng thời gian, cộng giờ sẽ đếm trùng và làm sp/giờ thấp giả)\n  mốc so sánh = Σ target các đơn ÷ giờ làm cả ngày\n  Chỉ tính khi có ít nhất 1 dòng đang chạy; công đoạn mà mọi dòng đã ngừng thì không có sp/giờ', 'LINE BALANCE (bar = SAM ÷ FTE)\n  SAM = Σ(order SAM × order output) ÷ Σ output (output-weighted average)\n  FTE = Σ FTE of the rows (people on the old order + people on the new order)\n  takt = working minutes ÷ Σ targets of all orders (old + new)\nAVG OUTPUT (pcs/h)\n  pcs/h = Σ output of the orders ÷ the longest run time (from the earliest first ticket to the viewed time)\n  Hours of the 2 rows are NOT added (the orders overlap in time; adding would double count and understate pcs/h)\n  reference = Σ order targets ÷ full-day working hours\n  Only computed while at least 1 row is running; an operation whose rows have all stopped has no pcs/h'),
      use: tx('Đọc đúng biểu đồ lúc đổi đơn: cột không "nhảy" khi một đơn mới bắt đầu, và sp/giờ phản ánh tốc độ thực của công đoạn chứ không bị kéo thấp vì đếm trùng giờ. Muốn xem từng đơn riêng: rê chuột vào công nhân, khối "Cả công đoạn" có ghi (style …) đơn cũ / đơn mới đang lên.', 'Reading the charts correctly during a changeover: bars do not jump when a new order starts, and pcs/h shows the real pace instead of being dragged down by double-counted hours. To see each order alone: hover a worker, the "Whole operation" block says (style …) old order / new order ramping up.'),
      example: tx('Chuyền 201S01, CĐ 46, đang đổi N278 → N389:\n• N278 (đơn cũ): 1.544 sp, FTE 3,37, chạy 275 phút\n• N389 (đơn mới): 287 sp, FTE 0,63, chạy 60 phút, cùng SAM 0,45\nCân bằng: SAM 0,45 ÷ (3,37 + 0,63 = 4,00 FTE) = 0,113 phút/người; giới hạn 0,125 → ỔN.\nSản lượng TB: (1.544 + 287 = 1.831 sp) ÷ 4,58 giờ (275 phút) = 400 sp/giờ, mốc cần 384 → ỔN.\nCách cũ cộng giờ (275 + 60 = 335 phút = 5,58 giờ): 1.831 ÷ 5,58 = 328 sp/giờ → báo THẤP sai.', 'Line 201S01, op 46, changing N278 → N389:\n• N278 (old): 1,544 pcs, FTE 3.37, ran 275 min\n• N389 (new): 287 pcs, FTE 0.63, ran 60 min, same SAM 0.45\nBalance: SAM 0.45 ÷ (3.37 + 0.63 = 4.00 FTE) = 0.113 min/person; limit 0.125 → OK.\nAvg output: (1,544 + 287 = 1,831 pcs) ÷ 4.58 h (275 min) = 400 pcs/h, required 384 → OK.\nThe old way added hours (275 + 60 = 335 min = 5.58 h): 1,831 ÷ 5.58 = 328 pcs/h → wrongly reported LOW.'),
      live: c => { if (!c.L || !window.PT) return c.none; const L = c.L, k = c.OP ? PT.codeKey(c.OP.op) : null;
        const rowsOf = op => (L.ops || []).filter(o => o.kind === 'line' && o.qty > 0 && PT.codeKey(o.op) === op);
        const op = k && rowsOf(k).length > 1 ? k : [...new Set((L.ops || []).filter(o => o.kind === 'line').map(o => PT.codeKey(o.op)))].find(z => rowsOf(z).length > 1);
        if (!op) return [tx('Chuyền này đang chạy 1 đơn: mỗi công đoạn chỉ có 1 dòng, không phải gộp', 'This line runs one order: each operation has a single row, nothing to merge')];
        const rs = rowsOf(op), B = PT.lineBalance(L), x = B.items.find(i => PT.codeKey(i.op) === op), q = rs.reduce((a, o) => a + o.qty, 0), hmax = Math.max(...rs.map(o => o.runMin)) / 60, hsum = rs.reduce((a, o) => a + o.runMin, 0) / 60;
        const head = (L.orders || []).find(o => L.orderPhase && o.key === L.orderPhase.head), chg = L.orderPhase && L.orderPhase.phase === 'change';
        const tg = o => !chg ? ['', ''] : (head && o.style in (head.sq || {})) ? [' (đơn mới)', ' (new)'] : [' (đơn cũ)', ' (old)'];
        const out = rs.map(o => tx(`CĐ ${o.op} · ${PT.styleCore(o.style).toUpperCase()}${tg(o)[0]}: ${c.n(o.qty)} sp, FTE ${c.n(o.fte, 2)}, chạy ${c.n(o.runMin, 0)} phút`, `Op ${o.op} · ${PT.styleCore(o.style).toUpperCase()}${tg(o)[1]}: ${c.n(o.qty)} pcs, FTE ${c.n(o.fte, 2)}, ran ${c.n(o.runMin, 0)} min`));
        if (x) out.push(tx(`Cột cân bằng: ${c.n(x.sam, 3)} ÷ ${c.n(x.fte, 2)} = ${c.n(x.wl, 3)} phút/người`, `Balance bar: ${c.n(x.sam, 3)} ÷ ${c.n(x.fte, 2)} = ${c.n(x.wl, 3)} min/person`));
        out.push(tx(`Sản lượng TB: ${c.n(q)} sp ÷ ${c.n(hmax, 2)} giờ = ${c.n(q / hmax, 0)} sp/giờ (cộng giờ sai sẽ ra ${c.n(q / hsum, 0)})`, `Avg output: ${c.n(q)} pcs ÷ ${c.n(hmax, 2)} h = ${c.n(q / hmax, 0)} pcs/h (adding hours wrongly gives ${c.n(q / hsum, 0)})`));
        return out; } },

    { id: 'balold', g: 'bal', key: null,
      name: tx('Cân bằng ở trang Chuyền may (so với trang này)', 'Balance on the Sewing-line page (vs this page)'),
      meaning: tx('Trang "Chuyền may" (chuyen-may.html) phân tích cân bằng theo SAM và số người nhập tay, không cần dữ liệu ETS. Cùng takt nhưng không nhân hiệu suất mục tiêu.', 'The "Sewing line" page (chuyen-may.html) analyses balance from SAM and typed headcount, without ETS data. Same takt but without the target efficiency.'),
      formula: tx('Takt = phút ca ÷ target\nCT công đoạn = SAM ÷ w (w = số người)\nTải = CT ÷ takt\nTắc nghẽn: tải > 100% hoặc CT lớn nhất; Sát nhịp: tải ≥ 90%; Dư thừa: tải < ngưỡng dư thừa; Ổn: còn lại\nHiệu suất chuyền = ΣSAM ÷ (số người × CT lớn nhất)\nNgười cần = SAM ÷ takt', 'Takt = shift minutes ÷ target\nOperation CT = SAM ÷ w (w = headcount)\nLoad = CT ÷ takt\nBottleneck: load > 100% or the largest CT; Near takt: load ≥ 90%; Surplus: load < surplus threshold; OK: the rest\nLine efficiency = ΣSAM ÷ (headcount × largest CT)\nPeople needed = SAM ÷ takt'),
      use: tx('Dùng để thiết kế và cân bằng chuyền trước khi chạy. Trang Visual Line (giám sát) dùng đường giới hạn takt × hiệu suất mục tiêu nên đòi hỏi nhiều người hơn khoảng 1 ÷ hiệu suất mục tiêu (≈ 25% khi 80%).', 'Used to design and balance a line before it runs. The Visual Line monitoring page uses the takt × target-efficiency limit, so it asks for about 1 ÷ target efficiency more people (≈ 25% at 80%).'),
      example: tx('SAM 0,60, takt 0,5: trang Chuyền may cần 0,60 ÷ 0,5 = 1,2 người; trang Visual Line cần 0,60 ÷ 0,4 = 1,5 người.', 'SAM 0.60, takt 0.5: the Sewing-line page needs 0.60 ÷ 0.5 = 1.2 people; Visual Line needs 0.60 ÷ 0.4 = 1.5 people.'),
      live: c => { if (!c.L || !window.PT) return c.none; const B = PT.lineBalance(c.L), x = (c.OP && B.items.find(i => PT.codeKey(i.op) === PT.codeKey(c.OP.op))) || B.items[0];
        if (!x || !(B.takt > 0)) return c.none;
        return [tx(`CĐ ${x.op}: cần ${c.n(x.sam / B.takt, 2)} người theo takt (kiểu Chuyền may) so với ${c.n(x.need, 2)} người theo giới hạn (kiểu Visual Line)`, `Operation ${x.op}: ${c.n(x.sam / B.takt, 2)} people by takt (Sewing-line style) vs ${c.n(x.need, 2)} by limit (Visual Line style)`)]; } },

    // ---------- Ngưỡng trạng thái (⚙ Cài đặt → Ngưỡng trạng thái) ----------
    { id: 'thrall', g: 'thr', key: null,
      name: tx('Tất cả ngưỡng trạng thái', 'All status thresholds'),
      meaning: tx('13 ô trong ⚙ Cài đặt → "Ngưỡng trạng thái" quyết định khi nào chuyền, công đoạn, công nhân đổi màu. Sửa ô nào thì trang tính lại ngay theo số mới. Mỗi chuyền có thể cài riêng.', 'The 13 boxes in ⚙ Settings → "Status thresholds" decide when a line, operation or operator changes colour. Change a box and the page recomputes at once. Each line can have its own values.'),
      formula: tx('Tiến độ: Xanh khi ≥ · Đỏ khi <\nThời gian: Ngừng sau · Dữ liệu cũ sau · Khởi động\nNgười: Đỏ khi thiếu người >\nTắc nghẽn: SL thấp hơn CĐ trước ≥\nTay nghề: %EFF công đoạn ≥ · số người ≤\n%EFF công nhân: đỏ < · vàng < · xanh dương < (từ đó trở lên = tím)\nTồn ca trước: đồng bộ trước giờ vào ca + (phút)', 'Progress: green when ≥ · red when <\nTime: stopped after · stale after · warm-up\nPeople: red when short of people >\nBottleneck: output below previous op ≥\nSkill: op %EFF ≥ · people ≤\nOperator %EFF: red < · yellow < · blue < (at or above = purple)\nCarry-over: synced before shift start + (min)'),
      use: tx('Chỉnh cho đúng thực tế xưởng: ngưỡng chặt thì báo nhiều, ngưỡng lỏng thì báo ít. Từng ngưỡng có mục giải thích riêng trong nhóm này; tay nghề, %EFF công nhân và tồn ca trước xem ở các mục có sẵn.', 'Tune to the factory reality: tight thresholds raise more alerts, loose ones fewer. Each threshold has its own item in this group; skill, operator %EFF and carry-over are explained in their existing items.'),
      example: tx('Đang cài: Xanh ≥ 90%, Đỏ < 85%, ngừng 60 phút, dữ liệu cũ 90 phút, thiếu người > 10%, khởi động 60 phút, tắc nghẽn 10%, tay nghề 130% / 2 người, %EFF công nhân 50 / 60 / 80%, tồn ca 25 phút.', 'Currently set: green ≥ 90%, red < 85%, stopped 60 min, stale 90 min, short > 10%, warm-up 60 min, bottleneck 10%, skill 130% / 2 people, operator %EFF 50 / 60 / 80%, carry-over 25 min.'),
      live: c => { if (!c.st) return c.none; const t = c.st, q = v => c.n(Math.round(v * 100));
        return [tx(`Tiến độ: xanh ≥ ${q(t.green)}%, đỏ < ${q(t.red)}% · ngừng ${t.stallMin} phút · dữ liệu cũ ${t.staleMin} phút · khởi động ${t.warmupMin} phút`, `Progress: green ≥ ${q(t.green)}%, red < ${q(t.red)}% · stopped ${t.stallMin} min · stale ${t.staleMin} min · warm-up ${t.warmupMin} min`),
          tx(`Thiếu người > ${q(t.shortPeople)}% · tắc nghẽn ${q(t.gapPct)}% · tay nghề ≥ ${q(t.skillEff)}% / ≤ ${t.skillPeople} người`, `Short of people > ${q(t.shortPeople)}% · bottleneck ${q(t.gapPct)}% · skill ≥ ${q(t.skillEff)}% / ≤ ${t.skillPeople} people`),
          tx(`%EFF công nhân: đỏ < ${q(t.wRed)}%, vàng < ${q(t.wYel)}%, xanh dương < ${q(t.wBlue)}%, tím ≥ ${q(t.wBlue)}% · tồn ca +${c.cfg.carryMin} phút`, `Operator %EFF: red < ${q(t.wRed)}%, yellow < ${q(t.wYel)}%, blue < ${q(t.wBlue)}%, purple ≥ ${q(t.wBlue)}% · carry-over +${c.cfg.carryMin} min`)]; } },

    { id: 'thrprog', g: 'thr', key: null,
      name: tx('Màu chuyền theo tiến độ (như OAS): đỏ < 90% · vàng < 100% · xanh < 110% · tím ≥ 110%', 'Line colour by progress (as OAS): red < 90% · yellow < 100% · green < 110% · purple ≥ 110%'),
      meaning: tx('Màu của chuyền (thẻ 3D, chip, trang chủ) giống màn hình OAS: chỉ do tiến độ = Actual SAH ÷ Accumulate target (kế hoạch SAH tới giờ). Không phải %EFF: chuyền %EFF 129% vẫn đỏ nếu SAH làm được mới đạt 73% kế hoạch tới giờ. Các cảnh báo khác (ngừng, thiếu người, hiệu suất) vẫn nằm ở danh sách lý do nhưng không đổi màu.', 'The line colour (3D card, chips, home page) follows the OAS screen: it depends only on progress = Actual SAH ÷ accumulate target (planned SAH to now). It is NOT %EFF: a line at 129% EFF is still red if the earned SAH is only 73% of the plan to now. Other warnings (stopped, short of people, efficiency) stay in the reason list but do not change the colour.'),
      formula: tx('Tiến độ = Actual SAH (Σ SAM × SL phiếu ETS ÷ 60) ÷ Accumulate target tới GIỜ HIỆN TẠI (đồng hồ, như OAS; xem lại thì tới giờ đang xem)\nTiến độ < ngưỡng Đỏ (90%) → ĐỎ\nĐỎ ≤ tiến độ < ngưỡng Xanh (100%) → VÀNG\nXanh ≤ tiến độ < ngưỡng Tím (110%) → XANH\nTiến độ ≥ ngưỡng Tím → TÍM (vượt kế hoạch)', 'Progress = Actual SAH (Σ SAM × qty of ETS tickets ÷ 60) ÷ accumulate target to the CURRENT CLOCK TIME (as OAS; in replay, to the viewed time)\nProgress < Red threshold (90%) → RED\nRed ≤ progress < Green threshold (100%) → YELLOW\nGreen ≤ progress < Purple threshold (110%) → GREEN\nProgress ≥ Purple threshold → PURPLE (above plan)'),
      use: tx('Mốc sửa trong ⚙ Cài đặt → Ngưỡng trạng thái. Kế hoạch SAH lấy từ file SAH_TARGET của OAS (thư mục Sah target): mục tiêu SAH, giờ bắt đầu, tổng giờ làm và giờ ăn của từng chuyền theo ngày. Accumulate target = mục tiêu × giờ đã làm ÷ tổng giờ làm. Ngày chưa có trong file thì dùng kế hoạch từ target mã hàng.', 'Edit the marks in ⚙ Settings → Status thresholds. The planned SAH comes from the OAS SAH_TARGET file (Sah target folder): daily SAH target, start time, total working hours and breaks per line. Accumulate target = target × hours worked ÷ total hours. Days not in the file use the plan from the style targets.'),
      example: tx('OAS 201S01: Actual 31,4 SAH ÷ Accumulate 64 SAH = 49% → ĐỎ (dù %EFF 112%). 201S07: 44,5 ÷ 51 = 87,5% → ĐỎ. Nếu 44,5 ÷ 40 = 111% → TÍM.', 'OAS 201S01: Actual 31.4 SAH ÷ accumulate 64 SAH = 49% → RED (even at 112% EFF). 201S07: 44.5 ÷ 51 = 87.5% → RED. If it were 44.5 ÷ 40 = 111% → PURPLE.'),
      live: c => { if (!c.L || !c.st) return c.none; const t = c.st, q = v => c.n(Math.round(v * 100)), pr = c.L.progress, pu = isFinite(t.purple) ? t.purple : 1.1;
        const lv = pr < t.red ? tx('ĐỎ', 'RED') : pr < t.green ? tx('VÀNG', 'YELLOW') : pr < pu ? tx('XANH', 'GREEN') : tx('TÍM', 'PURPLE');
        return [tx(c.n(c.L.sah, 1) + ' SAH ÷ ' + c.n(c.L.planNowSAH, 1) + ' SAH = ' + c.p(pr) + ' → ' + lv.vi + ' (đỏ < ' + q(t.red) + '%, xanh ≥ ' + q(t.green) + '%, tím ≥ ' + q(pu) + '%)', c.n(c.L.sah, 1) + ' SAH ÷ ' + c.n(c.L.planNowSAH, 1) + ' SAH = ' + c.p(pr) + ' → ' + lv.en + ' (red < ' + q(t.red) + '%, green ≥ ' + q(t.green) + '%, purple ≥ ' + q(pu) + '%)')]; } },

    { id: 'sahgap', g: 'thr', key: null,
      name: tx('SAH − Target (thẻ chuyền)', 'SAH − Target (line card)'),
      meaning: tx('Số SAH còn thiếu (âm) hoặc dư (dương) so với mục tiêu SAH cả ngày của OAS. Giống cột "Shortages" trên OAS. Ngay từ đầu ca số này âm lớn vì mục tiêu là cả ngày; muốn biết có đang theo kịp không thì xem tiến độ (màu chuyền), tức SAH thực tế so với Accumulate target tới giờ.', 'The SAH still missing (negative) or in surplus (positive) against the OAS full-day SAH target. Same as the "Shortages" column in OAS. Early in the shift it is strongly negative because the target is for the whole day; to know whether the line is on pace see progress (line colour), i.e. Actual SAH versus the accumulate target to now.'),
      formula: tx('SAH − Target = SAH thực tế − mục tiêu SAH cả ngày\nSo với tới giờ = SAH thực tế − Accumulate target (rê chuột lên thẻ chuyền)', 'SAH − Target = Actual SAH − full-day SAH target\nVersus now = Actual SAH − accumulate target (hover the line card)'),
      use: tx('Cho biết còn phải làm thêm bao nhiêu SAH để đạt mục tiêu ngày. Trang chủ và thẻ chuyền dùng cùng cách tính.', 'Shows how much more SAH is needed to reach the day target. The home page and the line cards use the same calculation.'),
      example: tx('201S01: 43,3 − 385 = −342 SAH cả ngày; so với tới giờ 43,3 − 64,6 = −21 SAH.', '201S01: 43.3 − 385 = −342 SAH for the day; versus now 43.3 − 64.6 = −21 SAH.'),
      live: c => { if (!c.L || !(c.L.planSAH > 0)) return c.none; const L = c.L;
        return [tx(c.n(L.sah, 1) + ' − ' + c.n(L.planSAH, 0) + ' = ' + c.n(L.sah - L.planSAH, 0) + ' SAH cả ngày; so với tới giờ ' + c.n(L.sah, 1) + ' − ' + c.n(L.planNowSAH, 1) + ' = ' + c.n(L.sah - L.planNowSAH, 1) + ' SAH', c.n(L.sah, 1) + ' − ' + c.n(L.planSAH, 0) + ' = ' + c.n(L.sah - L.planSAH, 0) + ' SAH for the day; versus now ' + c.n(L.sah, 1) + ' − ' + c.n(L.planNowSAH, 1) + ' = ' + c.n(L.sah - L.planNowSAH, 1) + ' SAH')]; } },

    { id: 'thrstall', g: 'thr', key: null,
      name: tx('Ngừng khi không có Data ETS mới (phút)', 'Stopped when no new ETS data for (min)'),
      meaning: tx('Công đoạn (hoặc cả chuyền) đã có sản lượng nhưng quá số phút này không có phiếu ETS mới thì coi là ngừng.', 'An operation (or the whole line) that already had output but has no new ETS ticket for longer than this is treated as stopped.'),
      formula: tx('Công đoạn ngừng = có sản lượng VÀ (giờ dữ liệu − phiếu cuối của công đoạn) ≥ ngưỡng\nChuyền ĐỎ khi không có hàng ra chuyền ≥ ngưỡng này\nCông nhân ngừng = (giờ dữ liệu − phiếu cuối của người đó) ≥ ngưỡng', 'Operation stopped = has output AND (data time − its last ticket) ≥ threshold\nLine RED when no output leaves the line for ≥ this threshold\nOperator stopped = (data time − their last ticket) ≥ threshold'),
      use: tx('Phát hiện hết hàng, máy hỏng, người rời chỗ hoặc quên quét. Nhỏ quá thì báo nhầm lúc nghỉ ngắn; lớn quá thì báo trễ.', 'Detects missing work, broken machines, people away or missed scans. Too small gives false alarms on short breaks; too large reports late.'),
      example: tx('Ngưỡng 60: phiếu cuối lúc 9:10, giờ dữ liệu 10:15 → 65 phút ≥ 60 → công đoạn ngừng.', 'Threshold 60: last ticket 9:10, data time 10:15 → 65 min ≥ 60 → operation stopped.'),
      live: c => { if (!c.L || !c.st) return c.none; const S = (c.L.ops || []).filter(o => o.status === 'stall');
        return [tx(`Ngưỡng ${c.st.stallMin} phút; hiện ${S.length ? S.length + ' công đoạn ngừng: ' + S.map(o => o.op).join(', ') : 'không có công đoạn ngừng'}`, `Threshold ${c.st.stallMin} min; now ${S.length ? S.length + ' stopped operations: ' + S.map(o => o.op).join(', ') : 'no stopped operation'}`)]; } },

    { id: 'thrstale', g: 'thr', key: null,
      name: tx('Dữ liệu cũ sau (phút)', 'Stale data after (min)'),
      meaning: tx('Nếu phiếu ETS mới nhất của chuyền đã cũ hơn số phút này so với giờ hiện tại thì chuyền chuyển XÁM (không còn đáng tin).', 'If the line newest ETS ticket is older than this many minutes compared with the current time, the line turns GREY (no longer reliable).'),
      formula: tx('Giờ hiện tại − giờ dữ liệu mới nhất ≥ ngưỡng → chuyền XÁM (kiểm tra trước các màu khác)', 'Current time − latest data time ≥ threshold → line GREY (checked before the other colours)'),
      use: tx('Nhắc cần xuất ETS lại. Khi xem lại số liệu cũ (ngày đã qua) thì không áp dụng vì giờ so với giờ dữ liệu.', 'A reminder to export ETS again. Not applied when replaying old data because the comparison uses the data time.'),
      example: tx('Ngưỡng 90: dữ liệu mới nhất 9:00, bây giờ 10:45 → 105 phút ≥ 90 → XÁM.', 'Threshold 90: latest data 9:00, now 10:45 → 105 min ≥ 90 → GREY.'),
      live: c => { if (!c.L || !c.st) return c.none; return [tx(`Ngưỡng ${c.st.staleMin} phút; dữ liệu mới nhất lúc ${c.hm(c.L.dataAt)}`, `Threshold ${c.st.staleMin} min; latest data at ${c.hm(c.L.dataAt)}`)]; } },

    { id: 'thrshort', g: 'thr', key: null,
      name: tx('Đỏ khi thiếu người > (%)', 'Red when short of people > (%)'),
      meaning: tx('Chuyền thiếu người so với kế hoạch quá tỷ lệ này thì chuyền ĐỎ.', 'The line turns RED when it is short of people against the plan by more than this share.'),
      formula: tx('ĐỎ khi số người đang làm < người kế hoạch × (1 − ngưỡng)', 'RED when people working < planned people × (1 − threshold)'),
      use: tx('Báo sớm vắng mặt, thiếu người để quản đốc điều người từ chuyền khác hoặc đổi kế hoạch.', 'Early warning for absence so the supervisor can borrow people from another line or change the plan.'),
      example: tx('Kế hoạch 32 người, ngưỡng 10%: dưới 28,8 (tức ≤ 28 người) → ĐỎ.', 'Plan 32 people, threshold 10%: below 28.8 (i.e. ≤ 28 people) → RED.'),
      live: c => { if (!c.L || !c.st) return c.none; const lim = c.L.peoplePlan * (1 - c.st.shortPeople);
        return [tx(`${c.L.people} / ${c.L.peoplePlan} người; ĐỎ khi dưới ${c.n(lim, 1)} → ${c.L.people < lim ? 'ĐỎ' : 'đạt'}`, `${c.L.people} / ${c.L.peoplePlan} people; RED below ${c.n(lim, 1)} → ${c.L.people < lim ? 'RED' : 'OK'}`)]; } },

    { id: 'thrwarm', g: 'thr', key: null,
      name: tx('Khởi động chuyền (phút)', 'Line warm-up (min)'),
      meaning: tx('Số phút đầu sau khi chuyền / công đoạn bắt đầu chạy, chưa đủ dữ liệu để đánh giá nên chưa tô đỏ / vàng.', 'The first minutes after a line / operation starts running: too little data to judge, so it is not coloured red / yellow yet.'),
      formula: tx('Chuyền KHỞI ĐỘNG khi dữ liệu < ngưỡng\nCông đoạn KHỞI ĐỘNG khi chạy < ngưỡng (không xét tắc nghẽn / tay nghề)\nTốc độ sp/giờ 60 phút gần nhất dùng cửa sổ = ngưỡng này', 'Line STARTING when data < threshold\nOperation STARTING when running < threshold (not judged for bottleneck / skill)\nThe last-60-min pcs/h uses a window equal to this threshold'),
      use: tx('Tránh báo đỏ nhầm đầu ca hoặc khi mã hàng mới vào chuyền giữa ca.', 'Avoids false red at shift start or when a new style enters mid-shift.'),
      example: tx('Ngưỡng 60: công đoạn mới vào chạy lúc 9:00 → tới 10:00 mới được đánh giá tắc nghẽn.', 'Threshold 60: an operation that started at 9:00 is only judged for bottleneck from 10:00.'),
      live: c => { if (!c.L || !c.st) return c.none; const S = (c.L.ops || []).filter(o => o.status === 'start');
        return [tx(`Ngưỡng ${c.st.warmupMin} phút; hiện ${S.length} công đoạn đang khởi động`, `Threshold ${c.st.warmupMin} min; now ${S.length} operations warming up`)]; } },

    { id: 'thrgap', g: 'thr', key: null,
      name: tx('Tắc nghẽn: SL thấp hơn CĐ trước ≥ (%)', 'Bottleneck: output below previous op ≥ (%)'),
      meaning: tx('Hàng dồn trước công đoạn: sản lượng lũy kế của nó thấp hơn công đoạn đứng trước từ tỷ lệ này trở lên thì được coi là ứng viên tắc nghẽn.', 'Work piling up in front of an operation: when its cumulative output is below the previous operation by at least this share, it becomes a bottleneck candidate.'),
      formula: tx('Hàng dồn = (SL công đoạn trước − SL công đoạn này) ÷ SL công đoạn trước\nỨng viên khi hàng dồn ≥ ngưỡng (hoặc sp/giờ < nhịp cần); không xét mã hàng của đơn cũ', 'Piling = (previous op output − this op output) ÷ previous op output\nCandidate when piling ≥ threshold (or pcs/h < required pace); old-order styles are not checked'),
      use: tx('Nhỏ thì nhạy (báo nhiều ứng viên), lớn thì chỉ báo khi hàng dồn rõ rệt. Chốt tắc nghẽn là ứng viên có CT lớn nhất.', 'Small = sensitive (more candidates), large = only obvious piling. The bottleneck is the candidate with the largest CT.'),
      example: tx('CĐ trước ra 1.000, CĐ này ra 880 → dồn 12% ≥ 10% → ứng viên.', 'Previous op 1,000, this op 880 → piling 12% ≥ 10% → candidate.'),
      live: c => { if (!c.L || !c.st) return c.none; const H = (c.L.ops || []).filter(o => o.gap >= c.st.gapPct && o.running);
        return [tx(`Ngưỡng ${c.n(Math.round(c.st.gapPct * 100))}%; ${H.length ? 'đang dồn hàng: ' + H.map(o => 'CĐ ' + o.op + ' (' + c.p(o.gap) + ')').join(', ') : 'không công đoạn nào dồn hàng ≥ ngưỡng'}`, `Threshold ${c.n(Math.round(c.st.gapPct * 100))}%; ${H.length ? 'piling up: ' + H.map(o => 'op ' + o.op + ' (' + c.p(o.gap) + ')').join(', ') : 'no operation piling at or above the threshold'}`)]; } },
  ];

  root.GIAI = { groups, items };
})(this);
