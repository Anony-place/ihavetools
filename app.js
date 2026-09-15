const tools = [
  {name:'Percentage Calculator',category:'Calculators',icon:'%',description:'Calculate percentages, changes and values quickly.',path:'#',featured:true},
  {name:'Word Counter',category:'Text',icon:'Aa',description:'Count words, characters, sentences and paragraphs.',path:'#',featured:true},
  {name:'JSON Formatter',category:'Developer',icon:'{}',description:'Format, validate and inspect JSON instantly.',path:'#',featured:true},
  {name:'Image Compressor',category:'Image',icon:'▧',description:'Reduce image file size while keeping useful quality.',path:'#',featured:true},
  {name:'PDF Merge',category:'PDF & Documents',icon:'PDF',description:'Combine multiple PDF files into a single document.',path:'#',featured:true},
  {name:'Unit Converter',category:'Converters',icon:'↔',description:'Convert length, weight, temperature, data and more.',path:'#',featured:true},
  {name:'Age Calculator',category:'Calculators',icon:'⌛',description:'Calculate exact age and time since a date.',path:'#'},
  {name:'Discount Calculator',category:'Calculators',icon:'$',description:'Find sale price, savings and discount percentage.',path:'#'},
  {name:'EMI Calculator',category:'Calculators',icon:'₹',description:'Estimate monthly loan payments and interest.',path:'#'},
  {name:'Date Difference',category:'Date & Time',icon:'◷',description:'Find the exact difference between two dates.',path:'#'},
  {name:'Time Zone Converter',category:'Date & Time',icon:'◴',description:'Compare times across time zones.',path:'#'},
  {name:'JPG to PNG',category:'Image',icon:'JPG',description:'Convert JPG images to PNG format in your browser.',path:'#'},
  {name:'Image Resizer',category:'Image',icon:'↗',description:'Resize images to exact pixel dimensions.',path:'#'},
  {name:'PDF Split',category:'PDF & Documents',icon:'✂',description:'Extract selected pages or split a PDF into parts.',path:'#'},
  {name:'PDF Compressor',category:'PDF & Documents',icon:'▤',description:'Shrink PDF file size for easier sharing.',path:'#'},
  {name:'Character Counter',category:'Text',icon:'123',description:'Count characters with or without spaces.',path:'#'},
  {name:'Case Converter',category:'Text',icon:'Tt',description:'Convert text to upper, lower, title or sentence case.',path:'#'},
  {name:'Remove Duplicate Lines',category:'Text',icon:'≡',description:'Clean repeated lines from any text.',path:'#'},
  {name:'Base64 Encoder',category:'Developer',icon:'64',description:'Encode and decode Base64 text locally.',path:'#'},
  {name:'URL Encoder',category:'Developer',icon:'URL',description:'Encode or decode URLs and query strings.',path:'#'},
  {name:'UUID Generator',category:'Developer',icon:'ID',description:'Generate standards-friendly UUIDs instantly.',path:'#'},
  {name:'Timestamp Converter',category:'Developer',icon:'TS',description:'Convert Unix timestamps to readable dates.',path:'#'},
  {name:'QR Code Generator',category:'Miscellaneous',icon:'QR',description:'Create QR codes from text, links and data.',path:'#'},
  {name:'Password Generator',category:'Security',icon:'••',description:'Generate strong random passwords in your browser.',path:'#'},
  {name:'HEX RGB Converter',category:'Color',icon:'#',description:'Convert colors between HEX, RGB and HSL.',path:'#'},
  {name:'CSV to JSON',category:'Data',icon:'CSV',description:'Convert tabular CSV data into JSON.',path:'#'},
  {name:'JSON to CSV',category:'Data',icon:'↳',description:'Turn JSON arrays into downloadable CSV data.',path:'#'},
  {name:'Markdown Preview',category:'Text',icon:'MD',description:'Preview Markdown with clean readable formatting.',path:'#'},
];

const categories = [
  ['PDF & Documents','📄','15+ tools'],['Image','🖼️','15+ tools'],['Video','🎬','Coming soon'],['Audio','🎵','Coming soon'],
  ['Text','📝','10+ tools'],['Calculators','🔢','20+ tools'],['Converters','🔄','15+ tools'],['Developer','💻','20+ tools'],
  ['Security','🔐','10+ tools'],['Web & SEO','🌐','Coming soon'],['Color','🎨','10+ tools'],['Data','📊','10+ tools'],
  ['Math','∑','Coming soon'],['Date & Time','🕐','10+ tools'],['Student','📚','Coming soon'],['Miscellaneous','🧰','10+ tools']
];

const $ = (selector) => document.querySelector(selector);

function card(tool){
  return `<article class="tool-card" data-name="${tool.name.toLowerCase()}" data-category="${tool.category.toLowerCase()}">
    <div class="tool-icon">${tool.icon}</div>
    <h3>${tool.name}</h3>
    <p>${tool.description}</p>
    <a class="tool-action" href="${tool.path}" onclick="return false">Open tool →</a>
  </article>`;
}

function renderTools(list = tools){
  $('#tool-grid').innerHTML = list.map(card).join('');
  $('#result-count').textContent = `${list.length} tools`;
  $('#empty-state').hidden = list.length !== 0;
}

function renderFeatured(){
  $('#featured-grid').innerHTML = tools.filter(t => t.featured).map(card).join('');
}

function renderCategories(){
  $('#category-grid').innerHTML = categories.map(([name,icon,count]) => `
    <button class="category-card" type="button" data-category-button="${name}">
      <span class="category-icon">${icon}</span><span><strong>${name}</strong><small>${count}</small></span>
    </button>`).join('');

  document.querySelectorAll('[data-category-button]').forEach(button => {
    button.addEventListener('click', () => {
      const category = button.dataset.categoryButton;
      const filtered = tools.filter(t => t.category === category);
      $('#all-tools').scrollIntoView({behavior:'smooth', block:'start'});
      renderTools(filtered);
      $('#tool-search').value = category;
    });
  });
}

$('#tool-search').addEventListener('input', (event) => {
  const q = event.target.value.trim().toLowerCase();
  const filtered = !q ? tools : tools.filter(t => `${t.name} ${t.category} ${t.description}`.toLowerCase().includes(q));
  renderTools(filtered);
});

renderFeatured();
renderCategories();
renderTools();
