'use strict';

const CATEGORIES = [
  { id: 'male-character', name: '男角色', icon: '♙' },
  { id: 'female-character', name: '女角色', icon: '♙' },
  { id: 'male-clothing', name: '男服装', icon: '♧' },
  { id: 'female-clothing', name: '女服装', icon: '♧' },
  { id: 'poster', name: '海报', icon: '▧' }
];
const AGES = { child: '小孩', young: '青年', middle: '中年', old: '老年' };
const PAGE_SIZE = 60;

function filterAssets(assets, category, age = '') {
  return assets.filter(asset => asset.category === category && (
    !age || (age === 'pending' ? asset.category !== 'poster' && asset.age === null : asset.age === age)
  ));
}

function buildStats(assets) {
  const stats = Object.fromEntries(CATEGORIES.map(category => [category.id, {
    total: 0, ages: { child: 0, young: 0, middle: 0, old: 0 }, pending: 0
  }]));
  for (const asset of assets) {
    const group = stats[asset.category];
    group.total++;
    if (asset.category === 'poster') continue;
    if (asset.age === null) group.pending++;
    else group.ages[asset.age]++;
  }
  return stats;
}

function pageAssets(assets, category, age = '', offset = 0) {
  const filtered = filterAssets(assets, category, age);
  return { total: filtered.length, assets: filtered.slice(offset, offset + PAGE_SIZE) };
}

function readSnapshot(value) {
  const invalid = () => { throw new Error('图库资料暂时无法读取，请稍后刷新页面。'); };
  if (!value || value.version !== 1 || !Array.isArray(value.assets) ||
      typeof value.generated_at !== 'string' || !Number.isFinite(Date.parse(value.generated_at))) invalid();
  for (const asset of value.assets) {
    if (!asset || typeof asset.id !== 'string' || typeof asset.name !== 'string' ||
        !CATEGORIES.some(category => category.id === asset.category) ||
        (asset.age !== null && !Object.hasOwn(AGES, asset.age)) ||
        (asset.category === 'poster' && asset.age !== null) ||
        !Number.isInteger(asset.width) || asset.width <= 0 ||
        !Number.isInteger(asset.height) || asset.height <= 0 ||
        typeof asset.image_url !== 'string' || !/^media\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(asset.image_url) ||
        typeof asset.thumb_url !== 'string' || !/^thumbs\/[a-f0-9]{64}\.webp$/.test(asset.thumb_url)) invalid();
  }
  return value;
}

function startGallery() {
  const $ = id => document.getElementById(id);
  let category = 'male-character';
  let age = '';
  let assets = [];
  let stats = buildStats([]);
  let shown = 0;
  const categoryName = id => CATEGORIES.find(item => item.id === id).name;
  const ageName = value => AGES[value] || '待确认';

  function label(text, className = '') {
    const span = document.createElement('span');
    span.textContent = text;
    if (className) span.className = className;
    return span;
  }

  function renderNavigation() {
    const nav = $('categories');
    nav.replaceChildren();
    for (const item of CATEGORIES) {
      const group = stats[item.id];
      const container = document.createElement('div');
      container.className = 'category-item';
      const button = document.createElement('button');
      button.className = 'category-button' + (category === item.id ? ' active' : '');
      button.setAttribute('aria-current', category === item.id ? 'page' : 'false');
      button.setAttribute('aria-label', item.name + '，' + group.total + ' 个资产');
      const icon = label(item.icon, 'nav-icon');
      icon.setAttribute('aria-hidden', 'true');
      button.append(icon, label(item.name), label(group.total, 'nav-count'));
      button.addEventListener('click', () => select(item.id, ''));
      container.append(button);
      if (category === item.id && item.id !== 'poster') {
        const subnav = document.createElement('div');
        subnav.className = 'subnav';
        for (const [id, name] of Object.entries(AGES)) {
          const sub = document.createElement('button');
          sub.className = age === id ? 'active' : '';
          sub.setAttribute('aria-pressed', String(age === id));
          const count = document.createElement('small');
          count.textContent = group.ages[id];
          sub.append(label(name), count);
          sub.addEventListener('click', () => select(item.id, id));
          subnav.append(sub);
        }
        container.append(subnav);
      }
      nav.append(container);
    }
    $('library-total').textContent = assets.length.toLocaleString() + ' 个资产';
    $('category-title').textContent = categoryName(category);
    const tabs = $('ages');
    tabs.replaceChildren();
    const group = stats[category];
    const choices = [['', '全部', group.total]];
    if (category !== 'poster') {
      for (const [id, name] of Object.entries(AGES)) choices.push([id, name, group.ages[id]]);
      if (group.pending) choices.push(['pending', '待确认', group.pending]);
    }
    for (const [id, name, count] of choices) {
      const button = document.createElement('button');
      button.className = 'age-tab' + (age === id ? ' active' : '');
      button.setAttribute('aria-pressed', String(age === id));
      const number = document.createElement('small');
      number.textContent = count;
      button.append(label(name), number);
      button.addEventListener('click', () => select(category, id));
      tabs.append(button);
    }
  }

  function select(nextCategory, nextAge) {
    category = nextCategory;
    age = nextAge;
    shown = 0;
    $('asset-grid').replaceChildren();
    renderNavigation();
    loadMore();
  }

  function loadMore() {
    const page = pageAssets(assets, category, age, shown);
    const fragment = document.createDocumentFragment();
    for (const asset of page.assets) {
      const card = document.createElement('article');
      card.className = 'asset-card';
      const button = document.createElement('button');
      button.className = 'card-button';
      button.setAttribute('aria-label', '查看 ' + asset.name);
      const imageWrap = document.createElement('div');
      imageWrap.className = 'card-image';
      const image = document.createElement('img');
      image.src = asset.thumb_url;
      image.alt = asset.name;
      image.width = asset.width;
      image.height = asset.height;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => { image.alt = '图片暂时无法读取'; });
      imageWrap.append(image);
      const hover = label('⤢', 'card-hover');
      hover.setAttribute('aria-hidden', 'true');
      const info = document.createElement('div');
      info.className = 'card-info';
      const name = document.createElement('strong');
      name.textContent = asset.name;
      name.title = asset.name;
      const bottom = document.createElement('div');
      bottom.className = 'card-bottom';
      const badge = label(asset.category === 'poster' ? '海报' : ageName(asset.age),
        'age-badge' + (asset.age === null && asset.category !== 'poster' ? ' pending' : ''));
      bottom.append(badge, label(asset.width + ' × ' + asset.height));
      info.append(name, bottom);
      button.append(imageWrap, hover, info);
      button.addEventListener('click', () => openPreview(asset));
      card.append(button);
      fragment.append(card);
    }
    $('asset-grid').append(fragment);
    shown += page.assets.length;
    $('category-count').textContent = page.total.toLocaleString() + ' 个资产' + (age ? ' · ' + ageName(age) : '');
    $('empty').hidden = page.total !== 0;
    $('empty-copy').textContent = category === 'poster' ? '共享图库暂时还没有海报。' : '这个分类暂时没有图片。';
    $('load-more').hidden = shown >= page.total;
    $('list-progress').textContent = page.total ? '已显示 ' + shown + ' / ' + page.total + ' 个资产' : '';
  }

  function openPreview(asset) {
    $('preview-name').textContent = asset.name;
    $('preview-image').src = asset.image_url;
    $('preview-image').alt = asset.name;
    $('preview-size').textContent = asset.width + ' × ' + asset.height;
    $('preview-category').textContent = categoryName(asset.category);
    const badges = $('preview-badges');
    badges.replaceChildren(label(categoryName(asset.category), 'age-badge'));
    if (asset.category !== 'poster') badges.append(label(ageName(asset.age), 'age-badge'));
    $('preview-age-note').textContent = asset.category === 'poster' ? '' :
      asset.age === null ? '这张图片的年龄暂时待确认。' : '年龄按图片外观分类，仅供挑选参考。';
    const download = $('download-original');
    download.href = asset.image_url;
    download.download = asset.name + '.' + asset.image_url.split('.').pop();
    $('open-original').href = asset.image_url;
    $('preview-dialog').showModal();
  }

  $('close-preview').addEventListener('click', () => $('preview-dialog').close());
  $('load-more').addEventListener('click', loadMore);
  renderNavigation();
  (async () => {
    try {
      const response = await fetch('assets.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('暂时无法读取图库，请稍后刷新页面。');
      const snapshot = readSnapshot(await response.json());
      assets = snapshot.assets;
      stats = buildStats(assets);
      const date = new Date(snapshot.generated_at);
      $('updated-at').textContent = '更新于 ' + date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
      $('updated-at').dateTime = date.toISOString();
      select(category, age);
    } catch (error) {
      $('page-error').textContent = '暂时无法读取共享图库，请检查网络后刷新页面。';
      $('page-error').hidden = false;
      $('category-count').textContent = '读取失败';
      $('updated-at').textContent = '更新日期暂时无法读取';
    }
  })();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { filterAssets, buildStats, pageAssets, readSnapshot };
}
if (typeof document !== 'undefined') startGallery();
