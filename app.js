const tools = [
  {name:'Percentage Calculator',category:'Calculators',icon:'%',description:'Calculate a percentage of any number.',path:'tools/percentage-calculator/',featured:true},
  {name:'Percentage Change',category:'Calculators',icon:'↕',description:'Calculate percentage increase or decrease between two values.',path:'tools/percentage-change/',featured:true},
  {name:'Word Counter',category:'Text',icon:'Aa',description:'Count words, characters, sentences and paragraphs.',path:'tools/word-counter/',featured:true},
  {name:'JSON Formatter',category:'Developer',icon:'{}',description:'Format and validate JSON instantly.',path:'tools/json-formatter/',featured:true},
  {name:'Image Compressor',category:'Image',icon:'▧',description:'Compress an image directly in your browser.',path:'tools/image-compressor/',featured:true},
  {name:'Age Calculator',category:'Calculators',icon:'⌛',description:'Calculate your age from your date of birth.',path:'tools/age-calculator/'},
  {name:'Discount Calculator',category:'Calculators',icon:'%',description:'Calculate sale price, savings and final price.',path:'tools/discount-calculator/'},
  {name:'EMI Calculator',category:'Calculators',icon:'₹',description:'Calculate monthly EMI, total interest and repayment.',path:'tools/emi-calculator/'},
  {name:'Base64 Encoder & Decoder',category:'Developer',icon:'64',description:'Encode and decode Base64 text locally.',path:'tools/base64/',featured:true},
  {name:'URL Encoder & Decoder',category:'Developer',icon:'URL',description:'Encode and decode URL components locally.',path:'tools/url-encoder/'},
  {name:'UUID Generator',category:'Developer',icon:'ID',description:'Generate random UUIDs in your browser.',path:'tools/uuid-generator/'},
  {name:'Timestamp Converter',category:'Developer',icon:'TS',description:'Convert Unix timestamps to readable dates.',path:'tools/timestamp-converter/'},
  {name:'Password Generator',category:'Security',icon:'••',description:'Generate cryptographically strong passwords locally.',path:'tools/password-generator/'},
  {name:'Date Difference',category:'Date & Time',icon:'◷',description:'Calculate the number of days between two dates.',path:'tools/date-difference/'},
  {name:'JPG to PNG',category:'Image',icon:'JPG',description:'Convert JPG images to PNG in your browser.',path:'tools/jpg-to-png/'},
  {name:'Image Resizer',category:'Image',icon:'↗',description:'Resize an image to exact pixel dimensions.',path:'tools/image-resizer/'},
  {name:'PDF Merge',category:'PDF & Documents',icon:'PDF',description:'Combine PDF files in your browser.',path:'#'},
  {name:'PDF Split',category:'PDF & Documents',icon:'✂',description:'Split or extract selected PDF pages.',path:'#'},
  {name:'Character Counter',category:'Text',icon:'123',description:'Count characters with or without spaces.',path:'tools/character-counter/'},
  {name:'Case Converter',category:'Text',icon:'Tt',description:'Convert text between lower, upper, title and sentence case.',path:'tools/case-converter/'},
  {name:'Remove Duplicate Lines',category:'Text',icon:'≡',description:'Remove repeated lines from text.',path:'tools/remove-duplicate-lines/'},
  {name:'CSV to JSON',category:'Data',icon:'CSV',description:'Convert CSV rows into JSON.',path:'tools/csv-to-json/'},
  {name:'JSON to CSV',category:'Data',icon:'↳',description:'Convert JSON arrays into CSV.',path:'tools/json-to-csv/'},
  {name:'Markdown Preview',category:'Text',icon:'MD',description:'Preview Markdown with readable formatting.',path:'#'},
  {name:'HEX RGB Converter',category:'Color',icon:'#',description:'Convert HEX, RGB and HSL color values.',path:'tools/hex-rgb-converter/'}
];

const categories = [
  ['PDF & Documents','📄','2 available • more planned'],['Image','🖼️','3 available'],['Video','🎬','Planned'],['Audio','🎵','Planned'],
  ['Text','📝','4 available'],['Calculators','🔢','4 available'],['Converters','🔄','Available in Image/Data/Dev'],['Developer','💻','5 available'],
  ['Security','🔐','1 available'],['Web & SEO','🌐','Planned'],['Color','🎨','1 available'],['Data','📊','2 available'],
  ['Math','∑','Planned'],['Date & Time','🕐','2 available'],['Student','📚','Planned'],['Miscellaneous','🧰','Planned']
]

const $ = (selector) => document.querySelector(selector);
function card(tool){
  const disabled = tool.path === '#';
  return `<article class="tool-card${disabled?' is-disabled':''}" data-name="${tool.name.toLowerCase()}" data-category="${tool.category.toLowerCase()}"><div class="tool-icon">${tool.icon}</div><h3>${tool.name}</h3><p>${tool.description}</p>${disabled?'<span class="tool-action disabled-action">Coming soon</span>':`<a class="tool-action" href="${tool.path}">Open tool →</a>`}</article>`;
}
function renderTools(list=tools){$('#tool-grid').innerHTML=list.map(card).join('');$('#result-count').textContent=`${list.filter(t=>t.path!=='#').length} live • ${list.filter(t=>t.path==='#').length} planned`;$('#empty-state').hidden=list.length!==0;}
function renderFeatured(){$('#featured-grid').innerHTML=tools.filter(t=>t.featured).map(card).join('');}
function renderCategories(){$('#category-grid').innerHTML=categories.map(([name,icon,count])=>`<button class="category-card" type="button" data-category-button="${name}"><span class="category-icon">${icon}</span><span><strong>${name}</strong><small>${count}</small></span></button>`).join('');document.querySelectorAll('[data-category-button]').forEach(button=>button.addEventListener('click',()=>{const category=button.dataset.categoryButton;renderTools(tools.filter(t=>t.category===category));$('#tool-search').value=category;$('#all-tools').scrollIntoView({behavior:'smooth',block:'start'});}));}
$('#tool-search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();renderTools(!q?tools:tools.filter(t=>`${t.name} ${t.category} ${t.description}`.toLowerCase().includes(q)));});
renderFeatured();renderCategories();renderTools();
