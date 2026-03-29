import {
  useState,
  useCallback,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import {
  Save,
  RotateCcw,
  Play,
  Check,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Endpoint } from "@/lib/api";
import { updateEndpoint as updateEndpointFn } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import { DEFAULT_SCRIPT } from "@/lib/script-constants";
import { getWebhookUrl } from "@/lib/url";
import { ScriptReference } from "@/components/script/ScriptReference";
import styles from "./ScriptEditor.module.css";

interface ScriptEditorProps {
  endpoint: Endpoint;
  onUpdate: (endpoint: Endpoint) => void;
}

export function ScriptEditor({ endpoint, onUpdate }: ScriptEditorProps) {
  const [script, setScript] = useState(endpoint.script || DEFAULT_SCRIPT);
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: number;
    body: string;
    error?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineNumbers = useMemo(
    () => Array.from({ length: script.split("\n").length }, (_, i) => i + 1),
    [script]
  );

  const webhookUrl = getWebhookUrl(endpoint.id);

  const handleScriptChange = useCallback((value: string) => {
    setScript(value);
    setIsSaved(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal =
          ta.value.substring(0, start) + "  " + ta.value.substring(end);
        setScript(newVal);
        setIsSaved(false);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updated = await updateEndpointFn(endpoint.id, {
        script,
      });
      onUpdate(updated);
      setIsSaved(true);
      toast.success("Script saved");
    } catch {
      toast.error("Failed to save script");
    } finally {
      setIsSaving(false);
    }
  }, [endpoint.id, script, onUpdate]);

  const handleReset = useCallback(() => {
    setScript(DEFAULT_SCRIPT);
    setIsSaved(false);
    toast.info("Script reset to default");
  }, []);

  const handleTest = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test: true,
          message: "Test from script editor",
          timestamp: new Date().toISOString(),
        }),
      });
      const text = await res.text();
      setTestResult({ status: res.status, body: text });
      toast.success("Test completed");
    } catch (err) {
      setTestResult({
        status: 0,
        body: "",
        error: err instanceof Error ? err.message : "Unknown error",
      });
      toast.error("Test failed");
    } finally {
      setIsTesting(false);
    }
  }, [webhookUrl]);

  const handleLoadExample = useCallback((code: string) => {
    setScript(code);
    setIsSaved(false);
    toast.info("Example loaded");
  }, []);

  const formatBody = (body: string) => {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  };

  return (
    <div className="script-editor">
      {/* LEFT -- Editor column */}
      <div className={styles.scriptEditorMain}>
        {/* Toolbar */}
        <div className={styles.scriptEditorToolbar}>
          <div className={styles.scriptEditorToolbarLeft}>
            <span className={styles.scriptEditorToolbarTitle}>Script Editor</span>
            {isSaved ? (
              <span className={cn(styles.scriptEditorStatus, styles.scriptEditorStatusSaved)}>
                <Check className={styles.scriptEditorStatusIcon} />
                Saved
              </span>
            ) : (
              <span className={cn(styles.scriptEditorStatus, styles.scriptEditorStatusUnsaved)}>
                <AlertCircle className={styles.scriptEditorStatusIcon} />
                Unsaved
              </span>
            )}
          </div>
          <div className={styles.scriptEditorToolbarRight}>
            <button
              onClick={handleReset}
              disabled={isSaving}
              className={cn(styles.scriptEditorBtn, styles.scriptEditorBtnOutline)}
            >
              <RotateCcw className={styles.scriptEditorBtnIcon} />
              Reset
            </button>
            <button
              onClick={handleTest}
              disabled={isTesting || isSaving}
              className={cn(styles.scriptEditorBtn, styles.scriptEditorBtnOutline)}
            >
              <Play className={styles.scriptEditorBtnIcon} />
              {isTesting ? "Testing..." : "Test"}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaved || isSaving}
              className={cn(styles.scriptEditorBtn, styles.scriptEditorBtnPrimary)}
            >
              <Save className={styles.scriptEditorBtnIcon} />
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Code editor */}
        <div className={styles.scriptEditorCodeWrap}>
          {/* Line numbers */}
          <div className={styles.scriptEditorLineNumbers}>
            <div
              className={styles.scriptEditorLineNumbersInner}
              style={{
                fontFamily:
                  '"JetBrains Mono","Fira Code","Cascadia Code",ui-monospace,monospace',
              }}
            >
              {lineNumbers.map((n) => (
                <div key={n}>{n}</div>
              ))}
            </div>
          </div>
          {/* Code area */}
          <textarea
            ref={textareaRef}
            value={script}
            onChange={(e) => handleScriptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.scriptEditorTextarea}
            style={{
              fontFamily:
                '"JetBrains Mono","Fira Code","Cascadia Code",ui-monospace,monospace',
              tabSize: 2,
            }}
            spellCheck={false}
            placeholder="Write your script here..."
          />
        </div>

        {/* Test Results -- below editor */}
        {testResult && (
          <div className={styles.scriptEditorTestResult}>
            <div className={styles.scriptEditorTestHeader}>
              <span className={styles.scriptEditorTestLabel}>Test Result</span>
              <Badge
                variant={
                  testResult.status >= 200 && testResult.status < 300
                    ? "default"
                    : "destructive"
                }
              >
                {testResult.status || "Error"}
              </Badge>
            </div>
            {testResult.error ? (
              <pre className={styles.scriptEditorTestError}>
                {testResult.error}
              </pre>
            ) : (
              <pre className={styles.scriptEditorTestOutput}>
                {formatBody(testResult.body)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* RIGHT -- Instructions column */}
      <ScriptReference onLoadExample={handleLoadExample} />
    </div>
  );
}
