The editor.js bundle contains CodeMirror 6, the Python language package and
One Dark theme, all MIT licensed. See LICENSES.txt for exact package versions
and license texts. Source is source.js. Build with the versions recorded there
and esbuild 0.25.5: esbuild source.js --bundle --format=esm --minify --outfile=editor.js
The bundle is self-hosted and loaded only by Python Playground; if unavailable,
the playground falls back to its plain-text editor.
