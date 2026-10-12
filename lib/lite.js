// Chế độ nhẹ cho máy yếu (card onboard, trình duyệt chạy WebGL bằng CPU) dùng chung cho các trang 3D.
// - Bật: tắt bóng đổ, render 1x (không nhân theo màn hình độ phân giải cao), tắt khử răng cưa.
//   Khử răng cưa chỉ đổi được khi tạo renderer, nên đổi nút thì có hiệu lực khi mở lại trang.
// - Lựa chọn lưu localStorage 'sam3d-lite'. Chưa chọn lần nào thì tự bật khi WebGL đang chạy bằng phần mềm.
// Dùng: new THREE.WebGLRenderer({ canvas, antialias: !Lite3D.on }); ... Lite3D.attach(renderer, scene, nút, resize);
(function(){
  'use strict';
  const KEY = 'sam3d-lite';
  function softwareGL(){
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return /swiftshader|llvmpipe|software|basic render/i.test(name);
    } catch(e){ return false; }
  }
  // 3 mức: 'high' (cao) / 'mid' (trung bình: tắt bóng, 1x, giới hạn 30 khung/s) / 'low' (thấp: thêm LOD gần, 20 khung/s, 0,75x).
  // Khóa 'sam3d-quality'; chưa chọn thì suy từ khóa cũ 'sam3d-lite' (1 = trung bình), hoặc tự chọn thấp khi WebGL chạy bằng phần mềm.
  const QK = 'sam3d-quality';
  let saved = null, q = null;
  try { saved = localStorage.getItem(KEY); q = localStorage.getItem(QK); } catch(e){}
  let level = (q === 'high' || q === 'mid' || q === 'low') ? q : saved === '1' ? 'mid' : saved === '0' ? 'high' : softwareGL() ? 'low' : matchMedia('(max-width:700px)').matches ? 'mid' : 'high';
  let on = level !== 'high';

  window.Lite3D = {
    get on(){ return on; },
    get level(){ return level; },
    set(v){
      if (v !== 'high' && v !== 'mid' && v !== 'low') return;
      level = v; on = v !== 'high';
      try { localStorage.setItem(QK, v); localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){}
    },
    attach(renderer, scene, btn, onResize){
      const apply = first => {
        renderer.setPixelRatio(level === 'low' ? 0.75 : on ? 1 : Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = !on;
        if (btn){ btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
        if (first) return;
        scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });   // biên dịch lại shader có / không bóng
        if (onResize) onResize();
      };
      if (btn) btn.addEventListener('click', () => {
        on = !on; level = on ? 'mid' : 'high';
        try { localStorage.setItem(KEY, on ? '1' : '0'); localStorage.removeItem(QK); } catch(e){}
        apply(false);
      });
      apply(true);
    },
  };
})();
