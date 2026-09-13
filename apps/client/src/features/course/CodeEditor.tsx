import { completeAnyWord } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import {
  indentUnit,
  syntaxHighlighting,
  type LanguageSupport,
} from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

async function loadLanguageSupport(
  languageName: string,
): Promise<LanguageSupport> {
  const language = languageName.toLowerCase();
  if (language.includes("typescript")) {
    const { javascript } = await import("@codemirror/lang-javascript");
    return javascript({ typescript: true });
  }
  if (language.includes("javascript")) {
    const { javascript } = await import("@codemirror/lang-javascript");
    return javascript();
  }
  if (language.includes("python")) {
    const { python } = await import("@codemirror/lang-python");
    return python();
  }
  if (language.includes("java")) {
    const { java } = await import("@codemirror/lang-java");
    return java();
  }
  if (/^go(?:\s|\(|$)/.test(language)) {
    const { go } = await import("@codemirror/lang-go");
    return go();
  }
  if (language.includes("rust")) {
    const { rust } = await import("@codemirror/lang-rust");
    return rust();
  }
  const { cpp } = await import("@codemirror/lang-cpp");
  return cpp();
}

export default function CodeEditor({
  value,
  languageName,
  readOnly,
  onChange,
}: {
  value: string;
  languageName: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const editable = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const applyingExternalValue = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    const language = new Compartment();
    const editor = new EditorView({
      doc: value,
      parent: container.current,
      extensions: [
        basicSetup,
        language.of([]),
        syntaxHighlighting(classHighlighter),
        EditorState.tabSize.of(4),
        indentUnit.of("    "),
        keymap.of([indentWithTab]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": "代码",
          "aria-multiline": "true",
        }),
        editable.current.of([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternalValue.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });
    view.current = editor;
    void loadLanguageSupport(languageName).then((support) => {
      if (disposed) return;
      editor.dispatch({
        effects: language.reconfigure([
          support,
          support.language.data.of({ autocomplete: completeAnyWord }),
        ]),
      });
    });
    return () => {
      disposed = true;
      view.current = null;
      editor.destroy();
    };
  }, [languageName]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    applyingExternalValue.current = true;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
    });
    applyingExternalValue.current = false;
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  return <div className="coding-editor" ref={container} />;
}
