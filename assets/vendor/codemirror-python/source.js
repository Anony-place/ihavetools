import {EditorState, Compartment} from '@codemirror/state';
import {EditorView, keymap} from '@codemirror/view';
import {indentWithTab} from '@codemirror/commands';
import {basicSetup} from 'codemirror';
import {python} from '@codemirror/lang-python';
import {oneDark} from '@codemirror/theme-one-dark';

export function mountPythonEditor(parent, text, onChange, onRun) {
  const tabKeys = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({doc:text, extensions:[
      basicSetup, python(), oneDark, EditorState.tabSize.of(4),
      EditorView.contentAttributes.of({'aria-label':'Python code', 'aria-multiline':'true'}),
      EditorView.lineWrapping,
      tabKeys.of([]),
      keymap.of([{key:'Mod-Enter', run:() => { onRun(); return true; }}]),
      EditorView.updateListener.of(update => { if(update.docChanged) onChange(update.state.doc.toString()); })
    ]})
  });
  return {destroy:() => view.destroy(), setTabMode:enabled => view.dispatch({effects:tabKeys.reconfigure(enabled ? keymap.of([indentWithTab]) : [])})};
}
