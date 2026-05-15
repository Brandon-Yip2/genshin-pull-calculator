// Small inline ⓘ icon with a hover/focus tooltip. Keep tooltip text short:
// one or two sentences plus an optional "see How it works" link is the rule.
// For deeper detail, send users to the Explanation tab.
export default function Info({ children, label }) {
  return (
    <span className="info-wrap" tabIndex={0} role="button" aria-label={label || 'More info'}>
      <span className="info-icon" aria-hidden="true">i</span>
      <span className="info-popup" role="tooltip">{children}</span>
    </span>
  );
}
