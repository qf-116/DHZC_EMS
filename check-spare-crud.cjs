// 备件档案新增 / 编辑 / 删除 的端到端验证（演示态）
const { chromium } = require('playwright-core');
const path = require('path');
const dist = path.resolve(__dirname, 'dist', 'index.html');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('file:///' + dist.split('\\').join('/'));
  await p.waitForTimeout(1200);
  const btn = await p.$('text=一键登录'); if (btn) { await btn.click(); await p.waitForTimeout(800); }
  await p.evaluate(() => { location.hash = '#/spare-parts-archive'; });
  await p.waitForTimeout(900);

  // 打开新增弹窗
  await p.evaluate(() => {
    const b0 = [...document.querySelectorAll('.ant-btn')].find(e => e.innerText.trim() === '新增');
    b0.click();
  });
  await p.waitForTimeout(800);
  const codeVal = await p.evaluate(() => {
    const inputs = [...document.querySelectorAll('.ant-modal input')];
    return inputs.map(i => `${i.getAttribute('placeholder') || ''}=${i.value}`).slice(0, 6);
  });
  console.log('弹窗字段:', JSON.stringify(codeVal));

  // 填写名称/规格/安全库存
  await p.evaluate(() => {
    const inputs = [...document.querySelectorAll('.ant-modal input')];
    const set = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(inputs[0], '测试滤芯');   // 名称
    set(inputs[2], 'TEST-01');    // 规格型号
    set(inputs[5], '15');         // 寿命时长
    set(inputs[6], '20');         // 安全库存数量
    set(inputs[7], '60');         // 最高库存数量
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const b0 = [...document.querySelectorAll('.ant-modal button')].find(e => e.innerText.replace(/\s/g, '') === '确认');
    b0.click();
  });
  await p.waitForTimeout(1000);
  const after = await p.evaluate(() => document.body.innerText);
  console.log('新增后含「测试滤芯」:', after.includes('测试滤芯'));
  const newRow = await p.$$eval('.ant-table-tbody tr.ant-table-row', trs => {
    const tr = trs.find(t => t.innerText.includes('测试滤芯'));
    return tr ? tr.innerText.replace(/\n/g, ' | ') : 'NOT FOUND';
  });
  console.log('新行:', newRow);

  // 编辑：改安全库存
  await p.evaluate(() => {
    const tr = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')].find(t => t.innerText.includes('测试滤芯'));
    [...tr.querySelectorAll('button')].find(b => b.innerText.trim() === '编辑').click();
  });
  await p.waitForTimeout(700);
  await p.evaluate(() => {
    const inputs = [...document.querySelectorAll('.ant-modal input')];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inputs[6], '25');
    inputs[6].dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const b0 = [...document.querySelectorAll('.ant-modal button')].find(e => e.innerText.replace(/\s/g, '') === '确认');
    b0.click();
  });
  await p.waitForTimeout(900);
  const edited = await p.$$eval('.ant-table-tbody tr.ant-table-row', trs => {
    const tr = trs.find(t => t.innerText.includes('测试滤芯'));
    return tr ? tr.innerText.replace(/\n/g, ' | ') : 'NOT FOUND';
  });
  console.log('编辑后行:', edited);

  // 删除（现存量为 0，允许删除）
  await p.evaluate(() => {
    const tr = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')].find(t => t.innerText.includes('测试滤芯'));
    [...tr.querySelectorAll('button')].find(b => b.innerText.trim() === '删除').click();
  });
  await p.waitForTimeout(700);
  await p.evaluate(() => {
    const b0 = [...document.querySelectorAll('.ant-modal button')].find(e => e.innerText.replace(/\s/g, '') === '删 除' || e.innerText.replace(/\s/g, '') === '删除');
    if (b0) b0.click();
  });
  await p.waitForTimeout(900);
  console.log('确认弹窗按钮:', JSON.stringify(await p.$$eval('.ant-modal button, .ant-popover button, button', bs => bs.map(b=>b.innerText.trim()).filter(Boolean).slice(0,30))));
  console.log('提示:', (await p.evaluate(()=>document.body.innerText)).slice(-300));
  const gone = await p.evaluate(() => !document.body.innerText.includes('测试滤芯'));
  console.log('删除后仍存在:', !gone);
  await b.close();
})();
