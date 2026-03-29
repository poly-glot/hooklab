import { BookOpen } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { EXAMPLE_SCRIPTS } from '@/lib/script-constants';
import styles from './ScriptReference.module.css';

interface ScriptReferenceProps {
  onLoadExample: (code: string) => void;
}

export function ScriptReference({ onLoadExample }: ScriptReferenceProps) {
  return (
    <div className={styles.scriptEditorReference}>
      <div className={styles.scriptEditorReferenceHeader}>
        <div className={styles.scriptEditorReferenceTitleWrap}>
          <BookOpen className={styles.scriptEditorReferenceIcon} />
          <span className={styles.scriptEditorReferenceTitle}>Reference</span>
        </div>
      </div>

      <div className={styles.scriptEditorReferenceBody}>
        {/* Request Object */}
        <div>
          <h3 className={styles.scriptEditorRefHeading}>Request Object</h3>
          <p className={styles.scriptEditorRefText}>
            Your script receives a <code className={styles.scriptEditorRefCode}>request</code> object:
          </p>
          <pre className={styles.scriptEditorRefPre}>
            {`{
  method: string,
  url: string,
  headers: object,
  query: object,
  body: string
}`}
          </pre>
        </div>

        <Separator />

        {/* Response Format */}
        <div>
          <h3 className={styles.scriptEditorRefHeading}>Response Format</h3>
          <p className={styles.scriptEditorRefText}>
            Return a response object:
          </p>
          <pre className={styles.scriptEditorRefPre}>
            {`return {
  status: number,
  headers: object,
  body: string
};`}
          </pre>
        </div>

        <Separator />

        {/* Tips */}
        <div>
          <h3 className={styles.scriptEditorRefHeading}>Tips</h3>
          <ul className={styles.scriptEditorTipsList}>
            <li>Sandboxed Deno Worker (no file/network)</li>
            <li>5-second execution timeout</li>
            <li>Use <code className={styles.scriptEditorRefCodeInline}>JSON.stringify()</code> for JSON bodies</li>
            <li>Use <code className={styles.scriptEditorRefCodeInline}>JSON.parse(request.body)</code> for input</li>
            <li>Press Tab for 2-space indent</li>
            <li>Save before testing</li>
          </ul>
        </div>

        <Separator />

        {/* Example Scripts */}
        <div>
          <h3 className={cn(styles.scriptEditorRefHeading, styles.scriptEditorRefHeadingExamples)}>Examples</h3>
          <div className={styles.scriptEditorExamples}>
            {EXAMPLE_SCRIPTS.map((ex, i) => (
              <div key={i}>
                <h4 className={styles.scriptEditorExampleTitle}>{ex.title}</h4>
                <p className={styles.scriptEditorExampleDesc}>{ex.description}</p>
                <pre className={styles.scriptEditorExampleCode}>
                  {ex.code}
                </pre>
                <button
                  className={styles.scriptEditorExampleLoad}
                  onClick={() => onLoadExample(ex.code)}
                >
                  Load Example
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
