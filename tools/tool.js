const $ = (s) => document.querySelector(s);
const out = $('#output');
const input = $('#input');
const status = $('#status');

function setOutput(value, ok = true) {
  out.textContent = value;
  status.textContent = ok ? 'Ready' : 'Check your input';
}

const tool = document.body.dataset.tool;

function percentage() {
  const a = Number($('#a').value), b = Number($('#b').value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return setOutput('Enter both numbers.', false);
  setOutput(`${b}% of ${a} = ${(a * b / 100).toLocaleString()}`);
}

function wordCounter() {
  const text = input.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const noSpaces = text.replace(/\s/g, '').length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;
  setOutput(`Words: ${words}\nCharacters: ${chars}\nCharacters (no spaces): ${noSpaces}\nSentences: ${sentences}`);
}

function jsonFormatter() {
  try { setOutput(JSON.stringify(JSON.parse(input.value), null, 2)); }
  catch (e) { setOutput(`Invalid JSON: ${e.message}`, false); }
}

function ageCalculator() {
  const birth = new Date($('#date').value + 'T00:00:00');
  if (Number.isNaN(birth.getTime())) return setOutput('Select your date of birth.', false);
  const now = new Date();
  if (birth > now) return setOutput('Date of birth cannot be in the future.', false);
  let years = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) years--;
  const lastBirthday = new Date(now.getFullYear() - (beforeBirthday ? 1 : 0), birth.getMonth(), birth.getDate());
  const days = Math.floor((now - lastBirthday) / 86400000);
  setOutput(`Age: ${years} years\nDays since last birthday: ${days}`);
}

function discount() {
  const price = Number($('#price').value), pct = Number($('#discount').value);
  if (!(price >= 0) || !(pct >= 0)) return setOutput('Enter valid price and discount.', false);
  const saved = price * pct / 100;
  setOutput(`Original price: ₹${price.toFixed(2)}\nDiscount: ₹${saved.toFixed(2)}\nFinal price: ₹${(price-saved).toFixed(2)}`);
}

function imageCompressor() {
  const file = $('#file').files[0];
  if (!file) return setOutput('Choose an image first.', false);
  const quality = Number($('#quality').value) / 100;
  const img = new Image();
  const reader = new FileReader();
  reader.onload = () => {
    img.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob); const link = document.createElement('a');
        link.href = url; link.download = `compressed-${file.name.replace(/\.[^.]+$/, '')}.jpg`; link.textContent = `Download compressed image (${(blob.size/1024).toFixed(1)} KB)`;
        out.replaceChildren(link); status.textContent = `${(file.size/1024).toFixed(1)} KB → ${(blob.size/1024).toFixed(1)} KB`;
      }, 'image/jpeg', quality);
    }; img.src = reader.result;
  }; reader.readAsDataURL(file);
}

const actions = { percentage: percentage, 'word-counter': wordCounter, 'json-formatter': jsonFormatter, 'age-calculator': ageCalculator, 'discount-calculator': discount, 'image-compressor': imageCompressor };
$('#run').addEventListener('click', actions[tool]);
if (input) input.addEventListener('input', () => { if (tool === 'word-counter') wordCounter(); });
