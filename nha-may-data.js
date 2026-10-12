// Cấu trúc nhà máy Tinh Lợi: Block → Xưởng (10/10/2026). Dùng cho trang chủ phân cấp (visualization.html) và may/giam-sat.html?xuong=…
// Thêm xưởng: ghi mã xưởng vào xuong của block (VD { id: '2U02' }). Chuyền KHÔNG khai báo ở đây: lấy theo mã tổ trong dữ liệu ETS.
// File .js (không phải .json) để mở trang bằng file:// vẫn đọc được (giống may/giai-thich-data.js).
(function (root) {
  const nm = (vi, en) => ({ vi, en });
  // kind: may (chuyền may, có mô hình 3D) | cat | in | giat (chưa có mô hình); link: trang mở khi bấm (nếu có)
  const blocks = [
    { id: 'B1', name: nm('Block 1', 'Block 1'), kind: 'may', xuong: [{ id: '2U01' }] },
    { id: 'B2', name: nm('Block 2', 'Block 2'), kind: 'may', xuong: [] },
    { id: 'B3', name: nm('Block 3', 'Block 3'), kind: 'may', xuong: [] },
    { id: 'B4', name: nm('Block 4', 'Block 4'), kind: 'cat', xuong: [] },
    { id: 'B5', name: nm('Block 5', 'Block 5'), kind: 'may', xuong: [] },
    { id: 'B6', name: nm('Block 6', 'Block 6'), kind: 'may', xuong: [] },
    { id: 'B7', name: nm('Block 7', 'Block 7'), kind: 'may', xuong: [] },
    { id: 'B8', name: nm('Block 8', 'Block 8'), kind: 'may', xuong: [] },
    { id: 'B9', name: nm('Block 9', 'Block 9'), kind: 'may', xuong: [] },
    { id: 'IN', name: nm('Nhà in', 'Printing'), kind: 'in', xuong: [] },
    { id: 'GIAT', name: nm('Nhà giặt', 'Laundry'), kind: 'giat', xuong: [], link: 'giat/belli.html' },
  ];
  const KIND = { may: nm('May', 'Sewing'), cat: nm('Cắt', 'Cutting'), in: nm('In', 'Printing'), giat: nm('Giặt', 'Laundry') };
  // Tổ ETS → xưởng: 201S01 → 2U01 (chữ số đầu + "U" + 2 số tiếp). Người dùng xác nhận với xưởng 2U01; xưởng khác chờ xác nhận.
  const xuongOf = g => { const m = /^(\d)(\d\d)/.exec(String(g || '').trim()); return m ? m[1] + 'U' + m[2] : ''; };
  const blockOfXuong = x => blocks.find(b => b.xuong.some(q => q.id === x)) || null;
  const blockOfGroup = g => blockOfXuong(xuongOf(g));
  root.NHA_MAY = { blocks, KIND, xuongOf, blockOfXuong, blockOfGroup };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NHA_MAY;
})(typeof window !== 'undefined' ? window : globalThis);
