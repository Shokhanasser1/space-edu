import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * The text of a lesson.
 *
 * `TopicLesson.content` has existed since ADR 0001, is described in the model as
 * "Lesson text/markdown content", is editable in the admin panel and is sent by
 * the API — and until now **nothing rendered it**. A lesson was a title and, if
 * somebody had pasted one, a YouTube embed. An administrator could write a
 * lesson, save it, open the page and find their work nowhere on it. That is the
 * same defect ADR 0001 was written to fix; the tree was corrected and the body
 * was left behind.
 *
 * Markdown, because the model said so before anyone asked: the field's own help
 * text called it markdown. What was missing was the half that reads it.
 *
 * **Raw HTML is deliberately not rendered.** `react-markdown` ignores HTML nodes
 * unless `rehype-raw` is added, and it is not added here. Lesson text is written
 * by administrators and read by ten-to-eighteen-year-olds; one mistaken paste,
 * or one borrowed admin account, should not put a script on every pupil's
 * screen. If a lesson ever genuinely needs an HTML embed, add it as a field with
 * its own validation rather than opening this door.
 */

const link = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    // noopener: a page opened this way can otherwise reach back through
    // window.opener. noreferrer keeps the pupil's page out of the other site's
    // logs.
    rel="noopener noreferrer"
    className="underline underline-offset-2 transition-colors"
    style={{ color: '#c4b5fd', textDecorationColor: 'rgba(196,181,253,0.4)' }}
  >
    {children}
  </a>
);

const COMPONENTS = {
  h1: ({ children }) => (
    <h2 className="text-[22px] md:text-[26px] font-[800] text-white tracking-tight mt-8 mb-3 first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-[19px] md:text-[22px] font-[800] text-white tracking-tight mt-7 mb-3 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-[16px] md:text-[18px] font-[700] mt-6 mb-2 first:mt-0" style={{ color: '#c4b5fd' }}>{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="text-[15px] font-[700] mt-5 mb-2 first:mt-0" style={{ color: 'rgba(255,255,255,0.75)' }}>{children}</h5>
  ),
  p: ({ children }) => (
    <p className="text-[15px] md:text-[16px] leading-[1.8] mb-4" style={{ color: 'rgba(255,255,255,0.72)' }}>{children}</p>
  ),
  strong: ({ children }) => <strong className="font-[800] text-white">{children}</strong>,
  em: ({ children }) => <em className="italic" style={{ color: 'rgba(255,255,255,0.85)' }}>{children}</em>,
  a: link,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1.5">{children}</ol>,
  li: ({ children }) => (
    <li className="text-[15px] md:text-[16px] leading-[1.75]" style={{ color: 'rgba(255,255,255,0.72)' }}>{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="pl-4 my-5 italic"
      style={{ borderLeft: '3px solid rgba(167,139,250,0.4)', color: 'rgba(255,255,255,0.6)' }}
    >
      {children}
    </blockquote>
  ),
  // One `code` component for both uses. react-markdown dropped the `inline`
  // prop in v9, and sniffing for it — a `language-` class, or a newline in the
  // text — gets a one-line indented code block wrong. The block case is handled
  // where it is actually known: inside `pre`, which unsets the chip styling for
  // the code element it wraps.
  code: ({ children }) => (
    <code
      className="px-1.5 py-0.5 rounded-md text-[13px] font-mono"
      style={{ background: 'rgba(139,92,246,0.14)', color: '#ddd6fe' }}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre
      className="p-4 rounded-2xl mb-5 overflow-x-auto text-[13px] leading-[1.7]
        [&_code]:bg-transparent [&_code]:p-0 [&_code]:block [&_code]:rounded-none"
      style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(139,92,246,0.15)' }}
    >
      {children}
    </pre>
  ),
  hr: () => <hr className="my-8" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />,
  // Wide content scrolls inside itself. A table that widens the page turns every
  // lesson on a phone into a horizontal scroll.
  table: ({ children }) => (
    <div className="overflow-x-auto mb-5">
      <table className="w-full text-[14px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-2 font-[800] text-white"
      style={{ borderBottom: '1px solid rgba(139,92,246,0.25)' }}>{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2" style={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{children}</td>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt || ''} loading="lazy"
      className="max-w-full h-auto rounded-2xl my-5"
      style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
  ),
};

export default function LessonBody({ markdown }) {
  const text = typeof markdown === 'string' ? markdown.trim() : '';
  if (!text) return null;

  return (
    <div className="max-w-[68ch]">
      {/* GFM for tables — a physics lesson listing units or constants wants one,
          and plain CommonMark has no table syntax, so the pipes rendered as
          pipes. It also brings strikethrough and task lists. */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>{text}</ReactMarkdown>
    </div>
  );
}
